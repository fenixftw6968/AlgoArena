package com.algoarena.controller;

import com.algoarena.config.SecurityConfig;
import com.algoarena.entity.User;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import com.algoarena.service.DailyChallengeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DailyChallengeController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
class DailyChallengeControllerSecurityTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private DailyChallengeService dailyChallengeService;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserRepository userRepository;

    private static UsernamePasswordAuthenticationToken loggedIn() {
        User user = User.builder().id(1L).username("tester").email("t@algoarena.com").build();
        return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void resetEndpointNoLongerExists() throws Exception {
        // Not 2xx: the route is gone. (The global catch-all handler currently maps the framework's
        // "no handler" error to 500 rather than 404 - tracked separately as an error-handling issue.)
        mockMvc.perform(post("/api/games/daily/reset").with(authentication(loggedIn())))
                .andExpect(result -> org.junit.jupiter.api.Assertions.assertTrue(
                        result.getResponse().getStatus() >= 400, "reset endpoint must not be served"));
        verifyNoInteractions(dailyChallengeService);
    }

    @Test
    void attemptRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/games/daily/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userAnswer\":\"O(N)\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(dailyChallengeService);
    }

    @Test
    void authenticatedAttemptIsDelegatedToService() throws Exception {
        when(dailyChallengeService.submitAnswer(eq(1L), any())).thenReturn(Map.of("isCorrect", true));

        mockMvc.perform(post("/api/games/daily/attempts")
                        .with(authentication(loggedIn()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userAnswer\":\"O(N)\"}"))
                .andExpect(status().isOk());
        verify(dailyChallengeService).submitAnswer(eq(1L), eq("O(N)"));
    }

    @Test
    void publicGetStillWorksForAnonymousUsers() throws Exception {
        when(dailyChallengeService.getTodayChallenge(null)).thenReturn(Map.of("title", "x"));

        mockMvc.perform(get("/api/games/daily")).andExpect(status().isOk());
    }
}
