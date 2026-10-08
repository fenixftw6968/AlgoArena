package com.algoarena.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** P0.7 - origin list rules (fail fast, no wildcards) and the WebSocket handshake origin check. */
class AllowedOriginsAndWebSocketConfigTest {

    // ------------------------------------------------------------------ AllowedOrigins

    @Test
    void normalisesTrimsDeduplicatesAndStripsPathsAndTrailingSlashes() {
        List<String> origins = AllowedOrigins.resolve(
                " https://App.Example.com/ ,http://localhost:5173, https://app.example.com ,, ", "http://localhost:5173/x");

        assertEquals(List.of("https://app.example.com", "http://localhost:5173"), origins);
    }

    @Test
    void frontendUrlIsAddedAndBlankInputsAreIgnored() {
        assertEquals(List.of("https://front.example"), AllowedOrigins.resolve("", "https://front.example/"));
        assertEquals(List.of(), AllowedOrigins.resolve(null, null));
        assertEquals(List.of(), AllowedOrigins.resolve("  ", "  "));
    }

    @Test
    void wildcardsAreRejectedAtStartup() {
        for (String bad : new String[]{"*", "https://*", "https://*.vercel.app", ".vercel.app,https://*"}) {
            assertThrows(IllegalStateException.class, () -> AllowedOrigins.resolve(bad, null), bad);
        }
        assertThrows(IllegalStateException.class, () -> AllowedOrigins.resolve("https://ok.example", "https://*.evil"));
    }

    @Test
    void malformedOrNonWebOriginsAreRejected() {
        for (String bad : new String[]{"app.example.com", "ftp://app.example.com", "javascript:alert(1)", "https://", "://x"}) {
            assertThrows(IllegalStateException.class, () -> AllowedOrigins.resolve(bad, null), bad);
        }
    }

    // ------------------------------------------------------------------ WebSocketConfig

    @Test
    void webSocketHandshakeUsesTheExplicitAllowlistNotWildcardPatterns() {
        WebSocketConfig config = new WebSocketConfig(mock(com.algoarena.security.StompSecurityInterceptor.class));
        ReflectionTestUtils.setField(config, "allowedOrigins", "https://app.example.com,http://localhost:5173");
        ReflectionTestUtils.setField(config, "frontendUrl", "https://front.example/");

        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        StompWebSocketEndpointRegistration registration = mock(StompWebSocketEndpointRegistration.class, RETURNS_SELF);
        when(registry.addEndpoint("/ws")).thenReturn(registration);

        config.registerStompEndpoints(registry);

        verify(registration).setAllowedOrigins("https://app.example.com", "http://localhost:5173", "https://front.example");
        verify(registration, never()).setAllowedOriginPatterns(any());
        verify(registration).withSockJS();
    }

    @Test
    void webSocketConfigFailsFastOnAWildcardOrigin() {
        WebSocketConfig config = new WebSocketConfig(mock(com.algoarena.security.StompSecurityInterceptor.class));
        ReflectionTestUtils.setField(config, "allowedOrigins", "*");
        ReflectionTestUtils.setField(config, "frontendUrl", "");

        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        when(registry.addEndpoint("/ws")).thenReturn(mock(StompWebSocketEndpointRegistration.class, RETURNS_SELF));

        assertThrows(IllegalStateException.class, () -> config.registerStompEndpoints(registry));
    }
}
