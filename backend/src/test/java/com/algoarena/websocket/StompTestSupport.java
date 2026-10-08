package com.algoarena.websocket;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/** Minimal real STOMP-over-WebSocket client for black-box security tests against a running server. */
final class StompTestSupport {

    static final String TRUSTED_ORIGIN = "http://localhost:5173";

    private StompTestSupport() {
    }

    /** Hands the raw frame body to the test as a String, whatever its content-type. */
    static final class RawStringConverter implements MessageConverter {
        @Override
        public Object fromMessage(Message<?> message, Class<?> targetClass) {
            Object payload = message.getPayload();
            return payload instanceof byte[] bytes ? new String(bytes, java.nio.charset.StandardCharsets.UTF_8) : String.valueOf(payload);
        }

        @Override
        public Message<?> toMessage(Object payload, MessageHeaders headers) {
            return MessageBuilder.createMessage(String.valueOf(payload).getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    headers == null ? new MessageHeaders(null) : headers);
        }
    }

    /** A live (or rejected) client connection plus everything it has observed. */
    static final class Client {
        final WebSocketStompClient stomp;
        final AtomicReference<StompSession> session = new AtomicReference<>();
        final CountDownLatch connected = new CountDownLatch(1);
        final CountDownLatch closedOrErrored = new CountDownLatch(1);
        final AtomicBoolean connectedOk = new AtomicBoolean(false);
        final List<String> errors = new CopyOnWriteArrayList<>();
        final BlockingQueue<String> received = new LinkedBlockingQueue<>();

        Client(WebSocketStompClient stomp) {
            this.stomp = stomp;
        }

        boolean isConnected() {
            StompSession s = session.get();
            return s != null && s.isConnected();
        }

        /** Subscribes and returns immediately; messages land in {@link #received}. */
        void subscribe(String destination) {
            session.get().subscribe(destination, new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return String.class;
                }

                @Override
                public void handleFrame(StompHeaders headers, Object payload) {
                    received.add(String.valueOf(payload));
                }
            });
        }

        void send(String destination, String body) {
            session.get().send(destination, body);
        }

        String nextMessage(long millis) throws InterruptedException {
            return received.poll(millis, TimeUnit.MILLISECONDS);
        }

        /** Polls until the connection is really closed (e.g. after the server's ERROR frame). */
        boolean awaitClosed(long millis) throws InterruptedException {
            long deadline = System.currentTimeMillis() + millis;
            while (System.currentTimeMillis() < deadline) {
                if (!isConnected()) {
                    return true;
                }
                Thread.sleep(50);
            }
            return !isConnected();
        }

        void close() {
            StompSession s = session.get();
            if (s != null && s.isConnected()) {
                s.disconnect();
            }
            stomp.stop();
        }
    }

    /**
     * Opens a WebSocket + STOMP connection. {@code bearerToken} may be null (no Authorization header).
     * Never throws on rejection: inspect {@link Client#connectedOk} / {@link Client#errors}.
     */
    static Client connect(int port, String origin, String bearerToken) throws InterruptedException {
        WebSocketStompClient stomp = new WebSocketStompClient(new StandardWebSocketClient());
        stomp.setMessageConverter(new RawStringConverter());
        Client client = new Client(stomp);

        WebSocketHttpHeaders handshake = new WebSocketHttpHeaders();
        if (origin != null) {
            handshake.setOrigin(origin);
        }
        StompHeaders connectHeaders = new StompHeaders();
        if (bearerToken != null) {
            connectHeaders.add("Authorization", "Bearer " + bearerToken);
        }

        stomp.connectAsync("ws://localhost:" + port + "/ws/websocket", handshake, connectHeaders,
                new StompSessionHandlerAdapter() {
                    @Override
                    public void afterConnected(StompSession s, StompHeaders headers) {
                        client.session.set(s);
                        client.connectedOk.set(true);
                        client.connected.countDown();
                    }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        // ERROR frame from the server
                        client.errors.add(String.valueOf(headers.getFirst("message")));
                        client.closedOrErrored.countDown();
                        client.connected.countDown();
                    }

                    @Override
                    public void handleException(StompSession s, StompCommand command, StompHeaders headers,
                                                byte[] payload, Throwable exception) {
                        client.errors.add(exception.getClass().getSimpleName());
                        client.closedOrErrored.countDown();
                        client.connected.countDown();
                    }

                    @Override
                    public void handleTransportError(StompSession s, Throwable exception) {
                        client.errors.add("transport:" + exception.getClass().getSimpleName());
                        client.closedOrErrored.countDown();
                        client.connected.countDown();
                    }
                }).whenComplete((s, ex) -> {
            if (ex != null) {
                client.errors.add("connect-failed:" + ex.getClass().getSimpleName());
                client.closedOrErrored.countDown();
                client.connected.countDown();
            }
        });

        client.connected.await(8, TimeUnit.SECONDS);
        return client;
    }
}
