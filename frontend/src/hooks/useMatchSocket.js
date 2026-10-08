import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export function useMatchSocket(matchId, onEvent) {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!matchId) return;

    let client = null;
    try {
      const host = window.location.hostname || 'localhost';
      const defaultWs = `http://${host}:8080/ws`;
      const cleanApi = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
      const wsUrl = cleanApi ? `${cleanApi}/ws` : defaultWs;

      client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        reconnectDelay: 5000,
        // The server authenticates every STOMP session: send the current JWT on each (re)connect.
        beforeConnect: (stompClient) => {
          let token = null;
          try { token = localStorage.getItem('mm_token'); } catch (e) { /* storage unavailable */ }
          stompClient.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        },
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: () => {}, // Disable noisy debug logs
        onConnect: () => {
          setConnected(true);
          try {
            client.subscribe(`/topic/match/${matchId}`, (message) => {
              if (message.body) {
                try {
                  const payload = JSON.parse(message.body);
                  if (onEventRef.current) {
                    onEventRef.current(payload);
                  }
                } catch (e) {
                  console.warn('Failed to parse STOMP message', e);
                }
              }
            });
          } catch (subErr) {
            console.warn('Subscription error:', subErr);
          }
        },
        onStompError: (frame) => {
          // A server-side refusal (bad/expired token, forbidden topic) will not fix itself: stop retrying.
          // The match/invitation pages keep working through their REST polling fallback.
          if (clientRef.current) { clientRef.current.reconnectDelay = 0; }
          console.warn('STOMP broker notice: ' + (frame?.headers?.message || ''));
        },
        onWebSocketClose: () => {
          setConnected(false);
        }
      });

      client.activate();
      clientRef.current = client;
    } catch (e) {
      console.warn('Could not initialize WebSocket client:', e);
    }

    return () => {
      try {
        if (client) {
          client.deactivate();
        }
      } catch (e) {}
      clientRef.current = null;
    };
  }, [matchId]);

  return { connected, client: clientRef.current };
}
