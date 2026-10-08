package com.algoarena.controller;

import com.algoarena.config.SecurityConfig;
import com.algoarena.dto.MatchAnswerResponse;
import com.algoarena.dto.MatchDto;
import com.algoarena.entity.User;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import com.algoarena.service.MatchService;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P0.4 - HTTP-level behaviour of the match endpoints with the real security configuration:
 * unauthenticated -> 401, non-participant -> 403, participant -> 200, plus request validation.
 */
@WebMvcTest(MatchController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
class MatchControllerSecurityTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private MatchService matchService;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserRepository userRepository;

    private static UsernamePasswordAuthenticationToken loggedIn(long id) {
        User user = User.builder().id(id).username("user" + id).email("u" + id + "@x.com").build();
        return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private static final String INVITE_JSON = "{\"friendId\":2,\"gameSlug\":\"number-detective\",\"difficulty\":\"EASY\"}";
    private static final String ANSWER_JSON = "{\"questionIndex\":0,\"answer\":\"O(1)\"}";
    private static final String SUBMIT_JSON = "{\"score\":3,\"timeTakenSeconds\":20,\"mistakes\":1}";

    private static List<MockHttpServletRequestBuilder> everyMatchRoute() {
        return List.of(
                post("/api/matches/queue").param("gameSlug", "number-detective"),
                post("/api/matches/queue/cancel").param("gameSlug", "number-detective"),
                post("/api/matches/invite").contentType(MediaType.APPLICATION_JSON).content(INVITE_JSON),
                get("/api/matches/invitations/pending"),
                post("/api/matches/m1/accept"),
                post("/api/matches/m1/decline"),
                post("/api/matches/m1/cancel"),
                post("/api/matches/m1/abandon"),
                post("/api/matches/m1/connect-bot"),
                get("/api/matches/m1"),
                post("/api/matches/m1/submit").contentType(MediaType.APPLICATION_JSON).content(SUBMIT_JSON),
                post("/api/matches/m1/answers").contentType(MediaType.APPLICATION_JSON).content(ANSWER_JSON),
                get("/api/matches/active").param("gameSlug", "number-detective"),
                get("/api/matches/recent"));
    }

    // ------------------------------------------------------------------ unauthenticated -> 401

    @Test
    void everyMatchRouteReturns401ForAnonymousUsers() throws Exception {
        for (MockHttpServletRequestBuilder route : everyMatchRoute()) {
            mockMvc.perform(route).andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(matchService);
    }

    @Test
    void everyMatchRouteReturns401ForAnInvalidToken() throws Exception {
        when(jwtUtil.isTokenValid("garbage")).thenReturn(false);

        for (MockHttpServletRequestBuilder route : everyMatchRoute()) {
            mockMvc.perform(route.header("Authorization", "Bearer garbage")).andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(matchService);
    }

    // ------------------------------------------------------------------ non-participant -> 403

    @Test
    void nonParticipantGets403WithStandardErrorBody() throws Exception {
        when(matchService.getMatchStatus("m1", 3L)).thenThrow(new ForbiddenException("You are not a participant in this match"));

        mockMvc.perform(get("/api/matches/m1").with(authentication(loggedIn(3))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").value("You are not a participant in this match"));
    }

    @Test
    void forbiddenFromServiceIsMappedTo403ForEveryMutatingAction() throws Exception {
        when(matchService.submitMatchResult(eq("m1"), eq(3L), any())).thenThrow(new ForbiddenException("no"));
        when(matchService.cancelMatch("m1", 3L)).thenThrow(new ForbiddenException("no"));
        when(matchService.abandonMatch("m1", 3L)).thenThrow(new ForbiddenException("no"));
        when(matchService.acceptFriendMatch("m1", 3L)).thenThrow(new ForbiddenException("no"));
        when(matchService.declineFriendMatch("m1", 3L)).thenThrow(new ForbiddenException("no"));
        when(matchService.connectBotMatch("m1", 3L)).thenThrow(new ForbiddenException("no"));

        mockMvc.perform(post("/api/matches/m1/submit").with(authentication(loggedIn(3)))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT_JSON))
                .andExpect(status().isForbidden());
        for (String action : List.of("cancel", "abandon", "accept", "decline", "connect-bot")) {
            mockMvc.perform(post("/api/matches/m1/" + action).with(authentication(loggedIn(3))))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void conflictFromServiceIsMappedTo409() throws Exception {
        when(matchService.declineFriendMatch("m1", 2L)).thenThrow(new ConflictException("This invitation can no longer be declined"));

        mockMvc.perform(post("/api/matches/m1/decline").with(authentication(loggedIn(2))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    // ------------------------------------------------------------------ participant -> 200

    @Test
    void participantReadsMatchAndServiceReceivesTheJwtUserNotAClientValue() throws Exception {
        when(matchService.getMatchStatus("m1", 1L)).thenReturn(MatchDto.builder().id("m1").status("READY").build());

        mockMvc.perform(get("/api/matches/m1").with(authentication(loggedIn(1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("m1"));
        verify(matchService).getMatchStatus("m1", 1L);
    }

    @Test
    void participantSubmitIsDelegatedWithTheAuthenticatedUserId() throws Exception {
        when(matchService.submitMatchResult(eq("m1"), eq(1L), any()))
                .thenReturn(MatchDto.builder().id("m1").status("READY").build());

        mockMvc.perform(post("/api/matches/m1/submit").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content(SUBMIT_JSON))
                .andExpect(status().isOk());
        verify(matchService).submitMatchResult(eq("m1"), eq(1L), any());
    }

    // ------------------------------------------------------------------ invite validation

    @Test
    void inviteUsesTheJwtUserAsHostAndValidatedBody() throws Exception {
        when(matchService.createFriendMatch(anyLong(), anyLong(), anyString(), any()))
                .thenReturn(MatchDto.builder().id("f1").status("WAITING").build());

        mockMvc.perform(post("/api/matches/invite").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content(INVITE_JSON))
                .andExpect(status().isOk());
        verify(matchService).createFriendMatch(1L, 2L, "number-detective", "EASY");
    }

    @Test
    void inviteWithMissingOrMalformedBodyIs400NotA500() throws Exception {
        mockMvc.perform(post("/api/matches/invite").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"gameSlug\":\"number-detective\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/matches/invite").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"friendId\":2}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/matches/invite").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/matches/invite").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"friendId\":\"abc\",\"gameSlug\":\"x\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(matchService);
    }

    // ------------------------------------------------------------------ P0.6 answer endpoint

    @Test
    void answerIsDelegatedWithTheJwtUserNeverAClientSuppliedUser() throws Exception {
        when(matchService.submitMatchAnswer(eq("m1"), eq(1L), any()))
                .thenReturn(MatchAnswerResponse.builder().correct(true).correctAnswer("O(1)").questionIndex(0).build());

        // a forged "userId"/"score" in the body is simply not part of the contract and is ignored
        mockMvc.perform(post("/api/matches/m1/answers").with(authentication(loggedIn(1)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"questionIndex\":0,\"answer\":\"O(1)\",\"userId\":2,\"score\":99,\"correct\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true));
        verify(matchService).submitMatchAnswer(eq("m1"), eq(1L), any());
    }

    @Test
    void answerValidationRejectsBadInputBeforeReachingTheService() throws Exception {
        for (String body : List.of("{\"answer\":\"x\"}", "{\"questionIndex\":-1}", "{\"questionIndex\":1000}",
                "{\"questionIndex\":\"abc\"}", "{not json", "{\"questionIndex\":0,\"answer\":\"" + "x".repeat(201) + "\"}")) {
            mockMvc.perform(post("/api/matches/m1/answers").with(authentication(loggedIn(1)))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(matchService);
    }

    @Test
    void answerErrorsMapTo403And409() throws Exception {
        when(matchService.submitMatchAnswer(eq("m1"), eq(3L), any())).thenThrow(new ForbiddenException("no"));
        when(matchService.submitMatchAnswer(eq("m1"), eq(2L), any())).thenThrow(new ConflictException("out of order"));

        mockMvc.perform(post("/api/matches/m1/answers").with(authentication(loggedIn(3)))
                        .contentType(MediaType.APPLICATION_JSON).content(ANSWER_JSON))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/matches/m1/answers").with(authentication(loggedIn(2)))
                        .contentType(MediaType.APPLICATION_JSON).content(ANSWER_JSON))
                .andExpect(status().isConflict());
    }

    @Test
    void finishCallStillWorksWithoutAnyBodyBecauseNothingInItIsTrusted() throws Exception {
        when(matchService.submitMatchResult(eq("m1"), eq(1L), any()))
                .thenReturn(MatchDto.builder().id("m1").status("READY").build());

        mockMvc.perform(post("/api/matches/m1/submit").with(authentication(loggedIn(1))))
                .andExpect(status().isOk());
    }
}
