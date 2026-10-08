import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Live notifications for one competition. Events are only a hint to re-read the state over REST, so a missed or
 * refused connection degrades to polling instead of breaking the page. The server only lets competition members
 * subscribe; a refusal stops reconnecting (it will not fix itself).
 */
export function useCompetitionSocket(competitionId, onEvent) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!competitionId) return undefined;

    let client = null;
    try {
      const host = window.location.hostname || 'localhost';
      const cleanApi = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
      const wsUrl = cleanApi ? `${cleanApi}/ws` : `http://${host}:8080/ws`;

      client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        reconnectDelay: 5000,
        beforeConnect: (stompClient) => {
          let token = null;
          try { token = localStorage.getItem('mm_token'); } catch { /* storage unavailable */ }
          stompClient.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        },
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: () => {},
        onConnect: () => {
          setConnected(true);
          try {
            client.subscribe(`/topic/competition/${competitionId}`, (message) => {
              if (!message.body) return;
              try {
                onEventRef.current?.(JSON.parse(message.body));
              } catch (e) {
                console.warn('Failed to parse competition event', e);
              }
            });
          } catch (subErr) {
            console.warn('Competition subscription error:', subErr);
          }
        },
        onStompError: () => {
          client.reconnectDelay = 0;
        },
        onWebSocketClose: () => setConnected(false),
      });
      client.activate();
    } catch (e) {
      console.warn('Could not initialize the competition WebSocket:', e);
    }

    return () => {
      try { client?.deactivate(); } catch { /* ignore */ }
      setConnected(false);
    };
  }, [competitionId]);

  return { connected };
}
