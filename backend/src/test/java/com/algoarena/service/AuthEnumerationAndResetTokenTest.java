package com.algoarena.service;

import com.algoarena.dto.ForgotPasswordRequest;
import com.algoarena.dto.LoginRequest;
import com.algoarena.dto.ResetPasswordRequest;
import com.algoarena.dto.SignupRequest;
import com.algoarena.entity.PasswordResetToken;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.repository.PasswordResetTokenRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** P0.10 - account-existence must not leak through messages or timing; reset tokens are single-use under concurrency. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthEnumerationAndResetTokenTest {

    @Mock private UserRepository userRepository;
    @Mock private JwtUtil jwtUtil;
    @Mock private AchievementService achievementService;
    @Mock private PasswordResetTokenRepository resetTokenRepository;
    @Mock private EmailService emailService;

    private PasswordEncoder encoder;
    private UserService userService;
    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        encoder = spy(new BCryptPasswordEncoder(4)); // low cost: fast tests, same code path
        userService = new UserService(userRepository, encoder, jwtUtil, achievementService);
        passwordResetService = new PasswordResetService(userRepository, resetTokenRepository, encoder, emailService);
    }

    private static LoginRequest login(String email, String password) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword(password);
        return r;
    }

    // ------------------------------------------------------------------ login

    @Test
    void unknownEmailAndWrongPasswordGiveTheIdenticalError() {
        User user = User.builder().id(1L).username("u").email("real@x.com").password(encoder.encode("right-password")).build();
        when(userRepository.findByEmail("real@x.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());

        BadRequestException wrong = assertThrows(BadRequestException.class, () -> userService.login(login("real@x.com", "nope")));
        BadRequestException unknown = assertThrows(BadRequestException.class, () -> userService.login(login("ghost@x.com", "nope")));

        assertEquals(wrong.getMessage(), unknown.getMessage());
        assertEquals("Invalid email or password", unknown.getMessage());
    }

    @Test
    void unknownEmailStillPaysForAPasswordHashCheckSoTimingDoesNotRevealExistence() {
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());
        clearInvocations(encoder);

        assertThrows(BadRequestException.class, () -> userService.login(login("ghost@x.com", "whatever")));

        verify(encoder).matches(eq("whatever"), anyString());
    }

    @Test
    void validLoginStillWorks() {
        User user = User.builder().id(1L).username("u").email("real@x.com").password(encoder.encode("right-password")).build();
        when(userRepository.findByEmail("real@x.com")).thenReturn(Optional.of(user));
        when(jwtUtil.generateToken(any(), any(), any())).thenReturn("token");

        assertEquals("token", userService.login(login("real@x.com", "right-password")).getToken());
    }

    private static String eq(String v) {
        return org.mockito.ArgumentMatchers.eq(v);
    }

    // ------------------------------------------------------------------ signup

    private static SignupRequest signup(String username, String email) {
        return SignupRequest.builder().username(username).email(email).password("Passw0rd!").build();
    }

    @Test
    void registeredEmailIsNotConfirmedByTheSignupError() {
        when(userRepository.existsByUsername("fresh")).thenReturn(false);
        when(userRepository.existsByEmail("taken@x.com")).thenReturn(true);

        BadRequestException e = assertThrows(BadRequestException.class, () -> userService.register(signup("fresh", "taken@x.com")));

        assertFalse(e.getMessage().toLowerCase().contains("already registered"));
        assertFalse(e.getMessage().contains("taken@x.com"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void usernameCollisionKeepsItsHelpfulMessageBecauseUsernamesArePublic() {
        when(userRepository.existsByUsername("popular")).thenReturn(true);

        BadRequestException e = assertThrows(BadRequestException.class, () -> userService.register(signup("popular", "new@x.com")));

        assertEquals("Username is already taken", e.getMessage());
        verify(userRepository, never()).existsByEmail(anyString());
    }

    // ------------------------------------------------------------------ forgot password

    @Test
    void forgotPasswordDoesNothingObservableForUnknownAddresses() {
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("Ghost@X.com");

        assertDoesNotThrow(() -> passwordResetService.processForgotPassword(request));

        verifyNoInteractions(emailService);
        verify(resetTokenRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ reset token redemption

    private PasswordResetToken token(boolean used, LocalDateTime expiry) {
        User user = User.builder().id(1L).username("u").email("u@x.com").password("old").build();
        return PasswordResetToken.builder().user(user).tokenHash("h").used(used).expiryDate(expiry).build();
    }

    private static ResetPasswordRequest reset(String tokenValue) {
        ResetPasswordRequest r = new ResetPasswordRequest();
        r.setToken(tokenValue);
        r.setNewPassword("N3wPassw0rd!");
        return r;
    }

    @Test
    void tokenIsRedeemedThroughTheRowLockedLookupSoConcurrentUseCannotDoubleSpendIt() {
        PasswordResetToken t = token(false, LocalDateTime.now().plusMinutes(5));
        when(resetTokenRepository.findByTokenHashForUpdate(anyString())).thenReturn(Optional.of(t));

        passwordResetService.resetPassword(reset("a".repeat(64)));

        verify(resetTokenRepository).findByTokenHashForUpdate(anyString());
        verify(resetTokenRepository, never()).findByTokenHash(anyString());
        assertTrue(t.isUsed());
        assertTrue(encoder.matches("N3wPassw0rd!", t.getUser().getPassword()));
    }

    @Test
    void usedExpiredAndUnknownTokensAreRejectedAndChangeNothing() {
        PasswordResetToken used = token(true, LocalDateTime.now().plusMinutes(5));
        PasswordResetToken expired = token(false, LocalDateTime.now().minusMinutes(1));
        when(resetTokenRepository.findByTokenHashForUpdate(anyString()))
                .thenReturn(Optional.of(used), Optional.of(expired), Optional.empty());

        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(reset("1".repeat(64))));
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(reset("2".repeat(64))));
        assertThrows(BadRequestException.class, () -> passwordResetService.resetPassword(reset("3".repeat(64))));

        assertEquals("old", used.getUser().getPassword());
        assertEquals("old", expired.getUser().getPassword());
        verify(userRepository, never()).save(any());
    }
}
