import { useCallback, useEffect, useRef, useState } from 'react';
import { competitionService, competitionErrorMessage } from '../services/competitionService';
import { useCompetitionSocket } from './useCompetitionSocket';

const TERMINAL = new Set(['FINISHED', 'CANCELLED']);

/**
 * Keeps the authoritative competition state in sync.
 *  - REST is the source of truth; WebSocket events only trigger a (debounced) re-read.
 *  - A slow poll covers a missing/blocked socket (faster when the socket is down).
 *  - All clocks are the SERVER's: the offset between server and device time is measured on every read, so a
 *    wrong device clock cannot change the countdown or the timer shown to the player.
 */
export function useCompetition(id) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const offsetRef = useRef(0);
  const seqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const versionRef = useRef(-1);
  const lastRefreshRef = useRef(0);
  const debounceRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    const sentAt = Date.now();
    lastRefreshRef.current = sentAt;
    try {
      const data = await competitionService.get(id);
      if (seq < appliedSeqRef.current) return null;      // a newer response was already applied
      const receivedAt = Date.now();
      offsetRef.current = Date.parse(data.serverTime) - (sentAt + receivedAt) / 2;
      if (data.version >= versionRef.current) {            // never go back to an older version
        versionRef.current = data.version;
        appliedSeqRef.current = seq;
        setState(data);
      }
      setError(null);
      return data;
    } catch (err) {
      setError({ status: err?.response?.status || 0, message: competitionErrorMessage(err, 'Could not load this competition.') });
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshSoon = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 150);
  }, [refresh]);

  const { connected } = useCompetitionSocket(id, refreshSoon);

  // first load + reload when the id changes
  useEffect(() => {
    versionRef.current = -1;
    appliedSeqRef.current = 0;
    setState(null);
    setLoading(true);
    refresh();
    return () => clearTimeout(debounceRef.current);
  }, [id, refresh]);

  // slow poll (fallback); stops once the competition is over
  useEffect(() => {
    const status = state?.status;
    if (!status || TERMINAL.has(status)) return undefined;
    const base = status === 'RUNNING' ? 5000 : 4000;
    const interval = setInterval(refresh, connected ? base * 3 : base);
    return () => clearInterval(interval);
  }, [state?.status, connected, refresh]);

  // 4 Hz clock for the countdown/timer + "step is due" detection against the SERVER clock
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  const serverNow = () => Date.now() + offsetRef.current;

  useEffect(() => {
    const s = stateRef.current;
    if (!s || TERMINAL.has(s.status)) return;
    const now = Date.now() + offsetRef.current;
    const due =
      (s.status === 'STARTING' && s.startTime && now >= Date.parse(s.startTime)) ||
      (s.status === 'LOBBY' && s.lobbyDeadlineAt && now >= Date.parse(s.lobbyDeadlineAt)) ||
      (s.status === 'RUNNING' && s.endTime && now >= Date.parse(s.endTime));
    if (due && Date.now() - lastRefreshRef.current > 1000) {
      refresh();
    }
  }, [tick, refresh]);

  return { state, loading, error, connected, refresh, serverNow, tick };
}
