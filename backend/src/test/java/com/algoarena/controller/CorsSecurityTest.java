package com.algoarena.controller;

import com.algoarena.config.SecurityConfig;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * P0.7 - the CORS policy: only the configured frontend origins, never a wildcard, credentials only
 * for those explicit origins, and no blanket method/header allowance.
 */
@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = {
        "cors.allowed-origins=https://app.example.com, http://localhost:5173/",
        "app.frontend-url=https://frontend.example.org/some/path"
})
class CorsSecurityTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserRepository userRepository;

    private MvcResult preflight(String origin, String method, String headers) throws Exception {
        var request = options("/health")
                .header("Origin", origin)
                .header("Access-Control-Request-Method", method);
        if (headers != null) {
            request = request.header("Access-Control-Request-Headers", headers);
        }
        return mockMvc.perform(request).andReturn();
    }

    // ------------------------------------------------------------------ trusted origins

    @Test
    void configuredOriginsAreAllowedWithCredentials() throws Exception {
        for (String origin : new String[]{"https://app.example.com", "http://localhost:5173"}) {
            mockMvc.perform(options("/health")
                            .header("Origin", origin)
                            .header("Access-Control-Request-Method", "POST")
                            .header("Access-Control-Request-Headers", "authorization,content-type"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", origin))
                    .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        }
    }

    @Test
    void theConfiguredFrontendUrlIsTrustedEvenIfNotListedExplicitly() throws Exception {
        // app.frontend-url had a path and trailing content: only its ORIGIN is trusted
        mockMvc.perform(options("/health")
                        .header("Origin", "https://frontend.example.org")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://frontend.example.org"));
    }

    @Test
    void actualRequestFromTrustedOriginGetsTheCorsHeader() throws Exception {
        mockMvc.perform(get("/health").header("Origin", "https://app.example.com"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://app.example.com"));
    }

    // ------------------------------------------------------------------ untrusted origins

    @Test
    void unknownOriginIsRejectedAndNeverEchoed() throws Exception {
        MvcResult result = preflight("https://evil.example", "POST", "authorization");

        assertEquals(403, result.getResponse().getStatus());
        assertNull(result.getResponse().getHeader("Access-Control-Allow-Origin"));
        assertNull(result.getResponse().getHeader("Access-Control-Allow-Credentials"));
    }

    @Test
    void actualRequestFromUnknownOriginIsRejected() throws Exception {
        mockMvc.perform(get("/health").header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void lookAlikeOriginsAreRejected() throws Exception {
        for (String origin : new String[]{
                "https://app.example.com.evil.example",   // suffix trick
                "https://evil-app.example.com",           // subdomain not listed
                "http://app.example.com",                 // wrong scheme
                "https://app.example.com:8443",           // wrong port
                "null"}) {                                // sandboxed iframes / file://
            assertEquals(403, preflight(origin, "GET", null).getResponse().getStatus(), origin);
        }
    }

    @Test
    void wildcardIsNeverReturned() throws Exception {
        for (String origin : new String[]{"https://app.example.com", "https://evil.example"}) {
            MvcResult result = preflight(origin, "GET", null);
            assertEquals(null, "*".equals(result.getResponse().getHeader("Access-Control-Allow-Origin")) ? "wildcard" : null);
        }
    }

    // ------------------------------------------------------------------ methods and headers

    @Test
    void onlyTheAppsMethodsAreAllowed() throws Exception {
        for (String method : new String[]{"GET", "POST", "PUT", "PATCH", "DELETE"}) {
            assertEquals(200, preflight("https://app.example.com", method, null).getResponse().getStatus(), method);
        }
        for (String method : new String[]{"TRACE", "CONNECT", "HEAD"}) {
            assertEquals(403, preflight("https://app.example.com", method, null).getResponse().getStatus(), method);
        }
    }

    @Test
    void onlyTheAppsHeadersAreAllowed() throws Exception {
        assertEquals(200, preflight("https://app.example.com", "POST", "authorization, content-type, accept").getResponse().getStatus());
        assertEquals(403, preflight("https://app.example.com", "POST", "x-evil-header").getResponse().getStatus());
        // Mixed list: Spring answers with ONLY the allowed headers, so the browser refuses the real request.
        MvcResult mixed = preflight("https://app.example.com", "POST", "authorization, x-forwarded-for");
        String allowedHeaders = String.valueOf(mixed.getResponse().getHeader("Access-Control-Allow-Headers")).toLowerCase();
        org.junit.jupiter.api.Assertions.assertTrue(allowedHeaders.contains("authorization"), allowedHeaders);
        org.junit.jupiter.api.Assertions.assertFalse(allowedHeaders.contains("x-forwarded-for"), allowedHeaders);
        org.junit.jupiter.api.Assertions.assertFalse(allowedHeaders.contains("*"), allowedHeaders);
    }

    @Test
    void sameOriginAndNonBrowserRequestsWithoutOriginStillWork() throws Exception {
        mockMvc.perform(get("/health")).andExpect(status().isOk());
    }
}
