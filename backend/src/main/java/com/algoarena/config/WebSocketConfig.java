package com.algoarena.config;

import com.algoarena.security.StompSecurityInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompSecurityInterceptor stompSecurityInterceptor;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    /** Every inbound STOMP frame is authenticated/authorised before it reaches the broker. */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompSecurityInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                // Same explicit allowlist as HTTP CORS: no wildcard origins on the WebSocket handshake.
                .setAllowedOrigins(AllowedOrigins.resolve(allowedOrigins, frontendUrl).toArray(new String[0]))
                .withSockJS();
    }
}
