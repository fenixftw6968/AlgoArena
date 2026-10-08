package com.algoarena.competition;

import com.algoarena.competition.service.CompetitionFacade;
import com.algoarena.competition.web.CompetitionController;
import com.algoarena.competition.web.CompetitionDtos.SubmissionResultDto;
import com.algoarena.config.SecurityConfig;
import com.algoarena.entity.User;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
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

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-level behaviour of /api/competitions with the real security configuration. */
@WebMvcTest(CompetitionController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = {"cors.allowed-origins=http://localhost:5173", "competition.enabled=true"})
class CompetitionControllerSecurityTest {

    @Autowired MockMvc mvc;
    @MockBean CompetitionFacade facade;
    @MockBean JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;

    private static UsernamePasswordAuthenticationToken loggedIn(long id) {
        User user = User.builder().id(id).username("user" + id).email("u" + id + "@x.com").build();
        return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private static final String VALID = "{\"questionNumber\":3,\"selectedOption\":2}";

    @Test
    void everyEndpointRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/competitions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/competitions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/competitions/1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/competitions/1/join")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/competitions/1/leave")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/competitions/1/start")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/competitions/1/questions")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/competitions/1/submissions").contentType(MediaType.APPLICATION_JSON).content(VALID)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/competitions/1/finish")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/competitions/1/leaderboard")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/competitions/1/results/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(facade);
    }

    @Test
    void theAuthenticatedUserIsPassedToTheFacadeNeverAnIdFromTheRequest() throws Exception {
        when(facade.submit(anyLong(), any(), anyInt(), anyInt()))
                .thenReturn(new SubmissionResultDto(3, true, 100, 100, 1, false, false, Instant.now()));

        mvc.perform(post("/api/competitions/7/submissions").with(authentication(loggedIn(5)))
                        .contentType(MediaType.APPLICATION_JSON)
                        // an attacker adds fields the API does not know about
                        .content("{\"questionNumber\":3,\"selectedOption\":2,\"userId\":99,\"score\":1000,\"correct\":true,\"submittedAt\":\"2020-01-01T00:00:00Z\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalScore").value(100));

        verify(facade).submit(eq(7L), org.mockito.ArgumentMatchers.argThat(u -> u.getId() == 5L), eq(3), eq(2));
    }

    @Test
    void malformedSubmissionsAreRejectedBeforeReachingTheFacade() throws Exception {
        String[] bad = {"{}", "{\"questionNumber\":3}", "{\"selectedOption\":1}", "{\"questionNumber\":0,\"selectedOption\":1}",
                "{\"questionNumber\":51,\"selectedOption\":1}", "{\"questionNumber\":1,\"selectedOption\":-1}",
                "{\"questionNumber\":1,\"selectedOption\":10}", "{\"questionNumber\":\"x\",\"selectedOption\":1}", "not json", ""};
        for (String body : bad) {
            mvc.perform(post("/api/competitions/7/submissions").with(authentication(loggedIn(5)))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().is4xxClientError());
        }
        verify(facade, never()).submit(anyLong(), any(), anyInt(), anyInt());
    }

    @Test
    void aNonNumericCompetitionIdIsABadRequestNotAServerError() throws Exception {
        mvc.perform(get("/api/competitions/abc").with(authentication(loggedIn(5)))).andExpect(status().isBadRequest());
    }

    @Test
    void forbiddenAndConflictAreMappedToTheirHttpStatuses() throws Exception {
        when(facade.start(eq(7L), any())).thenThrow(new ForbiddenException("Only the host can start"));
        when(facade.join(eq(8L), any())).thenThrow(new ConflictException("full"));

        mvc.perform(post("/api/competitions/7/start").with(authentication(loggedIn(5)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/competitions/8/join").with(authentication(loggedIn(5)))).andExpect(status().isConflict());
    }

    @Test
    void onlyOpenLobbiesCanBeListed() throws Exception {
        mvc.perform(get("/api/competitions?status=FINISHED").with(authentication(loggedIn(5)))).andExpect(status().isBadRequest());
    }
}
