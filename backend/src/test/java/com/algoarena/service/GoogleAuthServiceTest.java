package com.algoarena.service;

import com.algoarena.dto.AuthResponse;
import com.algoarena.dto.GoogleAuthRequest;
import com.algoarena.entity.User;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoogleAuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AchievementService achievementService;

    @InjectMocks
    private UserService userService;

    @BeforeEach
    void setUp() {
        lenient().when(jwtUtil.generateToken(any(), any(), any())).thenReturn("mock-jwt-token");
        lenient().when(passwordEncoder.encode(any())).thenReturn("hashed-pwd");
    }

    @Test
    void testGoogleLogin_ExistingUser() {
        User existing = User.builder()
                .id(42L)
                .email("test@gmail.com")
                .username("testuser")
                .password("hashed")
                .xp(100)
                .level(2)
                .coins(50)
                .role("ROLE_USER")
                .build();

        when(userRepository.findByEmail("test@gmail.com")).thenReturn(Optional.of(existing));

        GoogleAuthRequest request = GoogleAuthRequest.builder()
                .email("test@gmail.com")
                .name("Test User")
                .build();

        AuthResponse res = userService.loginWithGoogle(request);

        assertNotNull(res);
        assertEquals("mock-jwt-token", res.getToken());
        assertEquals("testuser", res.getUser().getUsername());
        verify(userRepository, never()).save(any());
    }

    @Test
    void testGoogleLogin_NewUserRegisters() {
        when(userRepository.findByEmail("newbie@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(99L);
            return u;
        });

        GoogleAuthRequest request = GoogleAuthRequest.builder()
                .email("newbie@gmail.com")
                .name("Newbie Coder")
                .build();

        AuthResponse res = userService.loginWithGoogle(request);

        assertNotNull(res);
        assertEquals("mock-jwt-token", res.getToken());
        assertEquals("newbiecoder", res.getUser().getUsername());
        verify(userRepository, times(1)).save(any(User.class));
    }
}

