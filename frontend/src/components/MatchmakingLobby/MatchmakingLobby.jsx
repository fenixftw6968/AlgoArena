import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Loader2, X, CheckCircle, ShieldAlert, Sparkles, User, Bot, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { useMatchSocket } from '../../hooks/useMatchSocket';
import { useAuth } from '../../context/AuthContext';

export default function MatchmakingLobby({
  isOpen,
  onClose,
  gameSlug,
  gameTitle,
  mode = 'RANKED', // 'RANKED' or 'FRIEND'
  friendTarget = null,
  difficulty = null,
  onMatchReady,
  initialMatch = null,
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState(() => {
    return mode === 'FRIEND' ? 'WAITING_FRIEND' : 'QUEUING';
  }); // 'QUEUING', 'WAITING_FRIEND', 'FOUND', 'COUNTDOWN', 'TIMEOUT_PROMPT', 'DECLINED', 'ERROR'
  const [matchData, setMatchData] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState(null);
  const matchStartedRef = useRef(false);
  const matchDataRef = useRef(null);
  matchDataRef.current = matchData;

  const onMatchReadyRef = useRef(onMatchReady);
  onMatchReadyRef.current = onMatchReady;

  // Queue timer
  useEffect(() => {
    let interval;
    if (isOpen && (status === 'QUEUING' || status === 'WAITING_FRIEND')) {
      interval = setInterval(() => {
        setQueueTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, status]);

  // Trigger countdown and match start
  const handleMatchFound = useCallback((match) => {
    if (!match) return;
    if (matchStartedRef.current) return;
    matchStartedRef.current = true;

    matchDataRef.current = match;
    setMatchData(match);
    setStatus('COUNTDOWN');
  }, []);

  // Dedicated countdown timer effect — uses client clock from moment READY is detected
  useEffect(() => {
    if (status !== 'COUNTDOWN' || !matchData) return;

    // Use a simple client-side 3-second countdown from now
    // Server's startedAtMillis may already be in the past (poll delay + network latency)
    const startMs = Date.now();
    const durationMs = 3000; // 3 seconds
    let timerInterval = null;

    const updateTimer = () => {
      const elapsed = Date.now() - startMs;
      const remainingMs = durationMs - elapsed;
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));

      setCountdown(remainingSecs);

      if (remainingMs <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        if (onMatchReadyRef.current) {
          onMatchReadyRef.current(matchDataRef.current || matchData);
        }
      }
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 100);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [status, matchData]);

  // Listen to WebSockets for real-time instant notification
  useMatchSocket(matchData?.id, (event) => {
    if (event.type === 'MATCH_READY' || event.type === 'INVITATION_ACCEPTED') {
      handleMatchFound(event.data);
    } else if (event.type === 'MATCH_CANCELLED' || event.type === 'MATCH_ABANDONED' || event.type === 'INVITATION_DECLINED') {
      setStatus('DECLINED');
      setTimeout(onClose, 2000);
    }
  });

  // Initial Queue / Match creation & Polling loop
  useEffect(() => {
    if (!isOpen) {
      setStatus(mode === 'FRIEND' ? 'WAITING_FRIEND' : 'QUEUING');
      setMatchData(null);
      matchDataRef.current = null;
      setCountdown(3);
      setQueueTime(0);
      setError(null);
      matchStartedRef.current = false;
      return;
    }

    let pollInterval = null;
    let isCancelled = false;

    const startQueue = async () => {
      try {
        // For RANKED mode: always create a fresh queue regardless of initialMatch.
        // Reusing a stale initialMatch would leave the lobby stuck with no polling.
        // For FRIEND mode: initialMatch carries the accepted invitation — use it.
        if (initialMatch && mode !== 'RANKED') {
          setMatchData(initialMatch);
          matchDataRef.current = initialMatch;
          if (initialMatch.status === 'READY' || initialMatch.player2Ready) {
            handleMatchFound(initialMatch);
          } else {
            setStatus('WAITING_FRIEND');
          }
          return;
        }

        if (mode === 'RANKED') {
          setStatus('QUEUING');
          const diffQuery = difficulty ? `&difficulty=${difficulty}` : '';
          const queueRequest = () => api.post(`/api/matches/queue?gameSlug=${gameSlug}${diffQuery}`);

          // No "already queued" guard here: React StrictMode runs this effect twice on
          // mount (run -> cleanup -> run). The second run must queue again — the server
          // is idempotent and returns the same slot — otherwise the lobby never starts
          // polling and both players stay stuck on "queueing".
          const res = await queueRequest();
          if (isCancelled) return;

          let queuedMatch = res.data;
          setMatchData(queuedMatch);

          // A match is ready when the server explicitly marks it READY (both players paired)
          const isMatchReady = (m) => m.status === 'READY';

          if (isMatchReady(queuedMatch)) {
            handleMatchFound(queuedMatch);
          } else {
            let elapsedPolls = 0;
            let requeueAttempts = 0;
            pollInterval = setInterval(async () => {
              if (matchStartedRef.current || isCancelled) {
                clearInterval(pollInterval);
                return;
              }
              try {
                const pollRes = await api.get(`/api/matches/${queuedMatch.id}`);
                const currentMatch = pollRes.data;
                setMatchData(currentMatch);

                if (isMatchReady(currentMatch)) {
                  clearInterval(pollInterval);
                  handleMatchFound(currentMatch);
                } else if (currentMatch.status === 'CANCELLED') {
                  // Our slot was cancelled server-side (e.g. a remount raced the cancel
                  // request). Re-enter the queue instead of freezing on "queueing".
                  if (requeueAttempts >= 3) {
                    clearInterval(pollInterval);
                    setError('Matchmaking was interrupted. Please try again.');
                    setStatus('ERROR');
                    return;
                  }
                  requeueAttempts++;
                  elapsedPolls = 0;
                  const requeueRes = await queueRequest();
                  if (isCancelled) {
                    clearInterval(pollInterval);
                    return;
                  }
                  queuedMatch = requeueRes.data;
                  setMatchData(queuedMatch);
                  if (isMatchReady(queuedMatch)) {
                    clearInterval(pollInterval);
                    handleMatchFound(queuedMatch);
                  }
                } else if (++elapsedPolls >= 90) {
                  clearInterval(pollInterval);
                  await connectRankedBot(queuedMatch.id);
                }
              } catch (e) {
                console.warn('Match status poll error', e);
              }
            }, 1000);
          }
        } else if (mode === 'FRIEND') {
          if (!friendTarget && !initialMatch) {
            return;
          }
          if (!friendTarget) {
            return;
          }
          setStatus('WAITING_FRIEND');
          const res = await api.post('/api/matches/invite', {
            friendId: friendTarget.userId || friendTarget.id,
            gameSlug: gameSlug,
            difficulty: difficulty
          });
          if (isCancelled) return;

          const match = res.data;
          setMatchData(match);

          let elapsedPolls = 0;
          pollInterval = setInterval(async () => {
            elapsedPolls++;
            try {
              if (matchStartedRef.current) {
                clearInterval(pollInterval);
                return;
              }
              const pollRes = await api.get(`/api/matches/${match.id}`);
              const currentMatch = pollRes.data;
              setMatchData(currentMatch);

              if (currentMatch.status === 'READY' || currentMatch.player2Ready) {
                clearInterval(pollInterval);
                handleMatchFound(currentMatch);
              } else if (currentMatch.status === 'CANCELLED') {
                clearInterval(pollInterval);
                if (currentMatch.cancelledReason === 'DECLINED') {
                  setStatus('DECLINED');
                } else {
                  setError("Friend invitation was cancelled.");
                  setStatus('ERROR');
                }
              } else if (elapsedPolls >= 40) {
                clearInterval(pollInterval);
                setError("Friend did not respond in time.");
                setStatus('ERROR');
              }
            } catch (e) {
              console.warn("Friend match poll error", e);
            }
          }, 1500);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Queue error:", err);
          setError(err.response?.data?.message || err.message || 'Failed to start matchmaking');
          setStatus('ERROR');
        }
      }
    };

    startQueue();

    return () => {
      isCancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (mode === 'RANKED' && !matchStartedRef.current) {
        api.post(`/api/matches/queue/cancel?gameSlug=${gameSlug}`).catch(() => {});
      }
    };
  }, [isOpen, gameSlug, mode, friendTarget, difficulty, initialMatch]);

  const connectRankedBot = async (matchId) => {
    if (matchStartedRef.current) return;
    try {
      const targetId = matchId || matchData?.id;
      if (targetId) {
        const res = await api.post(`/api/matches/${targetId}/connect-bot`);
        if (res.data) {
          setMatchData(res.data);
          handleMatchFound(res.data);
          return;
        }
      }
    } catch (e) {
      console.warn("API connect-bot error, using fallback bot match", e);
    }

    const botOpponent = {
      ...(matchData || {}),
      player2Id: 999999,
      player2Username: 'CortexAI_Bot',
      player2Rating: Math.max(100, (matchData?.player1Rating || 500) + Math.floor(Math.random() * 30 - 15)),
      player2Rank: 'Knight',
      isBotMatch: true,
      status: 'READY'
    };
    setMatchData(botOpponent);
    handleMatchFound(botOpponent);
  };

  const handleCancelInvitation = async () => {
    if (matchData?.id) {
      try {
        await api.post(`/api/matches/${matchData.id}/cancel`);
      } catch (e) {}
    }
    onClose();
  };

  const handleSimulatedMatch = () => {
    connectRankedBot(matchData?.id);
  };

  const handleContinueWaiting = () => {
    setStatus('QUEUING');
    setQueueTime(0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(23, 20, 15, 0.72)' }}>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          className="zine-card"
          style={{
            width: '100%',
            maxWidth: '520px',
            boxShadow: '10px 10px 0 var(--riso-violet)',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div className="halftone-violet halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }} />
          <div className="hazard-tape" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, borderBottom: '2px solid var(--ink)' }} />

          {/* Close / Cancel Button */}
          {(status === 'QUEUING' || status === 'WAITING_FRIEND' || status === 'TIMEOUT_PROMPT') && (
            <button
              onClick={status === 'WAITING_FRIEND' ? handleCancelInvitation : onClose}
              className="zine-btn-sm"
              style={{ position: 'absolute', top: '1.15rem', right: '1.15rem' }}
            >
              <X size={14} />
            </button>
          )}

          {/* QUEUING STATE */}
          {status === 'QUEUING' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px', margin: '1.5rem auto 1.5rem' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px dashed var(--riso-violet)',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute',
                    inset: '-8px',
                    border: '2px solid var(--riso-coral)',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: '8px',
                  background: 'var(--riso-violet)',
                  border: '3px solid var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Swords size={30} color="#fffdf6" />
                </div>
              </div>

              <h2 className="zine-display misreg" data-text="SCANNING LOBBY" style={{ fontSize: 'clamp(1.3rem, 4.5vw, 1.8rem)', marginBottom: '0.5rem' }}>
                SCANNING LOBBY
              </h2>
              <p className="zine-lede" style={{ fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Locating active neural challengers in {gameTitle} matching your classification tier.
              </p>

              <div className="zine-badge" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--riso-yellow)',
                color: 'var(--ink)',
                padding: '0.45rem 1.15rem',
                fontSize: '0.72rem',
                marginBottom: '0.75rem'
              }}>
                <Loader2 size={13} className="zine-bounce" color="var(--ink)" />
                QUEUE {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
              </div>

              <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                <Sparkles size={12} color="var(--riso-coral)" /> Auto-assigning Cortex AI Challenger after 90s
              </div>

              <div>
                <button onClick={onClose} className="zine-btn-sm zine-btn-sm--coral" style={{ padding: '0.55rem 1.3rem' }}>
                  ABORT QUEUE
                </button>
              </div>
            </motion.div>
          )}

          {/* WAITING FOR FRIEND ACCEPTANCE STATE */}
          {status === 'WAITING_FRIEND' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'relative' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px', margin: '1.5rem auto 1.5rem' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '3px dashed var(--riso-teal)',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: '8px',
                  background: 'var(--riso-teal)',
                  border: '3px solid var(--ink)',
                  boxShadow: '3px 3px 0 var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={30} color="#fffdf6" />
                </div>
              </div>

              <h2 className="zine-display misreg" data-text="INVITATION SENT" style={{ fontSize: 'clamp(1.25rem, 4.5vw, 1.7rem)', marginBottom: '0.5rem' }}>
                INVITATION SENT
              </h2>
              <p className="zine-lede" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Awaiting connection from <strong style={{ color: 'var(--ink)' }}>{friendTarget?.username || 'Challenger'}</strong>...
              </p>

              <div className="zine-badge" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--paper-sunk)',
                padding: '0.45rem 1.15rem',
                fontSize: '0.72rem',
                marginBottom: '1.75rem'
              }}>
                <Loader2 size={13} className="zine-bounce" color="var(--riso-teal)" />
                ELAPSED {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
              </div>

              <div>
                <button onClick={handleCancelInvitation} className="zine-btn-sm zine-btn-sm--coral" style={{ padding: '0.55rem 1.3rem' }}>
                  CANCEL CHALLENGE
                </button>
              </div>
            </motion.div>
          )}

          {/* TIMEOUT PROMPT */}
          {status === 'TIMEOUT_PROMPT' && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative' }}>
              <div style={{
                width: '76px',
                height: '76px',
                background: 'var(--riso-yellow)',
                border: '3px solid var(--ink)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1.5rem auto 1.25rem',
                color: 'var(--ink)',
                transform: 'rotate(4deg)'
              }}>
                <Bot size={34} />
              </div>

              <h2 className="zine-display misreg" data-text="QUEUE TIMEOUT" style={{ fontSize: 'clamp(1.25rem, 4.5vw, 1.6rem)', marginBottom: '0.5rem' }}>
                QUEUE TIMEOUT
              </h2>
              <p className="zine-lede" style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                No active human challenger found. Engage AI Neural Core or extend lobby search?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button onClick={handleSimulatedMatch} className="btn-primary" style={{ width: '100%' }}>
                  <Bot size={16} /> ENGAGE CORTEX AI (RANKED)
                </button>

                <button onClick={handleContinueWaiting} className="btn-secondary" style={{ width: '100%' }}>
                  <RefreshCw size={14} /> EXTEND SEARCH
                </button>

                <button
                  onClick={onClose}
                  className="zine-btn-sm"
                  style={{ alignSelf: 'center' }}
                >
                  DISMISS
                </button>
              </div>
            </motion.div>
          )}

          {/* DECLINED STATE */}
          {status === 'DECLINED' && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative' }}>
              <div style={{
                width: '72px',
                height: '72px',
                background: 'var(--riso-coral)',
                border: '3px solid var(--ink)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1.5rem auto 1.25rem',
                color: '#fffdf6',
                transform: 'rotate(-4deg)'
              }}>
                <X size={30} />
              </div>

              <h2 className="zine-display misreg" data-text="INVITATION DECLINED" style={{ fontSize: 'clamp(1.25rem, 4.5vw, 1.6rem)', marginBottom: '0.5rem' }}>
                INVITATION DECLINED
              </h2>
              <p className="zine-lede" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                {friendTarget?.username || 'Opponent'} declined the match request.
              </p>

              <button onClick={onClose} className="btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
                RETURN
              </button>
            </motion.div>
          )}

          {/* OPPONENT FOUND & COUNTDOWN STATE */}
          {(status === 'COUNTDOWN' || status === 'FOUND') && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative' }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'var(--riso-teal)',
                border: '3px solid var(--ink)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1.5rem auto 0.85rem',
                color: '#fffdf6',
                transform: 'rotate(-4deg)'
              }}>
                <CheckCircle size={30} />
              </div>

              <h2 className="zine-display misreg" data-text="MATCH READY" style={{ fontSize: 'clamp(1.3rem, 4.5vw, 1.8rem)', marginBottom: '0.35rem' }}>
                MATCH READY
              </h2>

              {/* Player vs Player card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                background: 'var(--paper-sunk)',
                border: '2px solid var(--ink)',
                boxShadow: '3px 3px 0 var(--ink)',
                padding: '1.05rem 1.25rem',
                margin: '1.25rem 0'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {user && matchData?.player1Id === user.id ? 'YOU (P1)' : 'PLAYER 1'}
                  </div>
                  <div className="zine-display" style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {matchData?.player1Username || 'Player 1'}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--riso-teal)', fontWeight: 700 }}>
                    {matchData?.player1Rating || 500} Elo
                  </div>
                </div>

                <div className="zine-display" style={{ fontSize: '1rem', color: 'var(--riso-coral)', padding: '0 0.5rem' }}>
                  VS
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {user && matchData?.player2Id === user.id ? 'YOU (P2)' : (matchData?.isBotMatch ? 'AI CORE' : 'PLAYER 2')}
                  </div>
                  <div className="zine-display" style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {matchData?.isBotMatch ? 'CortexAI_Bot' : (matchData?.player2Username || 'Challenger')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: matchData?.isBotMatch ? 'var(--riso-violet)' : 'var(--ink)', fontWeight: 700 }}>
                    {matchData?.isBotMatch ? `⚡ ${matchData?.player2Rating || 500} Elo` : `${matchData?.player2Rating || 500} Elo`}
                  </div>
                </div>
              </div>

              <div className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--riso-teal)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '0.25rem' }}>
                Synchronizing In
              </div>

              <motion.div
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="zine-num"
                style={{
                  color: countdown <= 1 ? 'var(--riso-teal)' : 'var(--riso-violet)',
                  lineHeight: 1,
                  margin: '0.4rem 0 0.85rem'
                }}
              >
                {countdown > 0 ? countdown : 'GO'}
              </motion.div>

              <p className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                Initializing competitive stream...
              </p>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {status === 'ERROR' && (
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '72px',
                height: '72px',
                background: 'var(--riso-coral)',
                border: '3px solid var(--ink)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '1.5rem auto 1.25rem',
                color: '#fffdf6'
              }}>
                <ShieldAlert size={32} />
              </div>
              <h3 className="zine-display" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>MATCHMAKING ERROR</h3>
              <p className="zine-lede" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>{error}</p>
              <button onClick={onClose} className="btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
                DISMISS
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
