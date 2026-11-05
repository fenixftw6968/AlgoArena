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
  const connectRankedBotRef = useRef(null);
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
                  await connectRankedBotRef.current?.(queuedMatch.id);
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
  }, [isOpen, gameSlug, mode, friendTarget, difficulty, initialMatch, handleMatchFound]);

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

  connectRankedBotRef.current = connectRankedBot;

  const handleCancelInvitation = async () => {
    if (matchData?.id) {
      try {
        await api.post(`/api/matches/${matchData.id}/cancel`);
      } catch {}
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
      <div className="overlay ml-overlay" style={{ zIndex: 9999 }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="zine-modal ml-card"
          role="dialog"
          aria-modal="true"
          aria-label="Matchmaking lobby"
        >
          {/* Close / Cancel Button */}
          {(status === 'QUEUING' || status === 'WAITING_FRIEND' || status === 'TIMEOUT_PROMPT') && (
            <button
              onClick={status === 'WAITING_FRIEND' ? handleCancelInvitation : onClose}
              className="ml-close"
              aria-label="Cancel matchmaking"
            >
              <X size={15} />
            </button>
          )}

          {/* QUEUING STATE */}
          {status === 'QUEUING' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-state">
              <div className="ml-orbit">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="ml-orbit-ring"
                />
                <div className="ml-orbit-core"><Swords size={28} /></div>
              </div>

              <h2 className="ml-title">Finding an opponent</h2>
              <p className="ml-lede">
                Searching {gameTitle} for a challenger near your rating.
              </p>

              <div className="ml-queue-badge">
                <Loader2 size={13} className="zine-bounce" />
                Queue {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
              </div>

              <p className="ml-note">
                <Sparkles size={12} /> A bot opponent will step in after 90 seconds.
              </p>

              <button onClick={onClose} className="btn btn--secondary ml-abort">
                Cancel queue
              </button>
            </motion.div>
          )}

          {/* WAITING FOR FRIEND ACCEPTANCE STATE */}
          {status === 'WAITING_FRIEND' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-state">
              <div className="ml-orbit">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="ml-orbit-ring ml-orbit-ring--teal"
                />
                <div className="ml-orbit-core ml-orbit-core--teal"><User size={28} /></div>
              </div>

              <h2 className="ml-title">Invitation sent</h2>
              <p className="ml-lede">
                Waiting for <strong>{friendTarget?.username || 'your friend'}</strong> to accept…
              </p>

              <div className="ml-queue-badge ml-queue-badge--muted">
                <Loader2 size={13} className="zine-bounce" />
                Elapsed {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
              </div>

              <button onClick={handleCancelInvitation} className="btn btn--secondary ml-abort">
                Cancel invitation
              </button>
            </motion.div>
          )}

          {/* TIMEOUT PROMPT */}
          {status === 'TIMEOUT_PROMPT' && (
            <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-state">
              <span className="ml-badge-icon ml-badge-icon--yellow"><Bot size={30} /></span>

              <h2 className="ml-title">No humans available</h2>
              <p className="ml-lede">
                No challenger joined in time. Play against Cortex AI or keep searching.
              </p>

              <div className="ml-actions">
                <button onClick={handleSimulatedMatch} className="btn btn--primary ml-action-btn">
                  <Bot size={15} /> Play vs Cortex AI
                </button>
                <button onClick={handleContinueWaiting} className="btn btn--secondary ml-action-btn">
                  <RefreshCw size={14} /> Keep searching
                </button>
                <button onClick={onClose} className="ml-text-btn">Dismiss</button>
              </div>
            </motion.div>
          )}

          {/* DECLINED STATE */}
          {status === 'DECLINED' && (
            <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-state">
              <span className="ml-badge-icon ml-badge-icon--red"><X size={28} /></span>

              <h2 className="ml-title">Invitation declined</h2>
              <p className="ml-lede">
                {friendTarget?.username || 'Your opponent'} declined the match request.
              </p>

              <button onClick={onClose} className="btn btn--primary ml-action-btn">
                Return
              </button>
            </motion.div>
          )}

          {/* OPPONENT FOUND & COUNTDOWN STATE */}
          {(status === 'COUNTDOWN' || status === 'FOUND') && (
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-state">
              <span className="ml-badge-icon ml-badge-icon--green"><CheckCircle size={28} /></span>

              <h2 className="ml-title">Match ready</h2>

              {/* Player vs Player card */}
              <div className="ml-versus">
                <div className="ml-player">
                  <div className="ml-player-tag">
                    {user && matchData?.player1Id === user.id ? 'You' : 'Player 1'}
                  </div>
                  <div className="ml-player-name truncate">
                    {matchData?.player1Username || 'Player 1'}
                  </div>
                  <div className="ml-player-rating">{matchData?.player1Rating ?? 101} Rating</div>
                </div>

                <div className="ml-vs">VS</div>

                <div className="ml-player ml-player--right">
                  <div className="ml-player-tag">
                    {user && matchData?.player2Id === user.id ? 'You' : (matchData?.isBotMatch ? 'AI' : 'Player 2')}
                  </div>
                  <div className="ml-player-name truncate">
                    {matchData?.isBotMatch ? 'CortexAI_Bot' : (matchData?.player2Username || 'Challenger')}
                  </div>
                  <div className="ml-player-rating">{matchData?.player2Rating ?? 101} Rating</div>
                </div>
              </div>

              <div className="ml-countdown-label">Starting in</div>

              <motion.div
                key={countdown}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="ml-countdown"
              >
                {countdown > 0 ? countdown : 'GO'}
              </motion.div>

              <p className="ml-note">Preparing your questions…</p>
            </motion.div>
          )}

          {/* ERROR STATE */}
          {status === 'ERROR' && (
            <div className="ml-state">
              <span className="ml-badge-icon ml-badge-icon--red"><ShieldAlert size={28} /></span>
              <h2 className="ml-title">Matchmaking error</h2>
              <p className="ml-lede">{error}</p>
              <button onClick={onClose} className="btn btn--primary ml-action-btn">
                Dismiss
              </button>
            </div>
          )}
        </motion.div>

        <style>{`
          .ml-overlay { background: rgba(23, 32, 51, 0.34); backdrop-filter: blur(2px); }
          .ml-card {
            width: 100%;
            max-width: 500px;
            padding: 40px 32px 34px;
            text-align: center;
            position: relative;
            overflow: hidden;
            border-radius: 20px;
          }
          .ml-close {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 32px;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface);
            color: var(--ink-muted);
            cursor: pointer;
          }
          .ml-close:hover { background: var(--surface-2); color: var(--ink); }
          .ml-state { position: relative; }
          .ml-orbit { position: relative; width: 92px; height: 92px; margin: 10px auto 24px; }
          .ml-orbit-ring {
            position: absolute;
            inset: 0;
            border: 2px dashed rgba(79, 110, 247, 0.4);
            border-radius: 50%;
          }
          .ml-orbit-ring--teal { border-color: rgba(13, 148, 136, 0.35); }
          .ml-orbit-core {
            position: absolute;
            inset: 16px;
            border-radius: 50%;
            background: var(--accent-gradient);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 16px 36px -18px var(--accent-glow);
          }
          .ml-orbit-core--teal {
            background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
            box-shadow: 0 16px 36px -18px rgba(13, 148, 136, 0.4);
          }
          .ml-title {
            font-size: clamp(1.4rem, 4vw, 1.8rem);
            font-weight: 700;
            letter-spacing: -0.025em;
            color: var(--ink);
            margin-bottom: 8px;
          }
          .ml-lede {
            font-size: 0.92rem;
            color: var(--ink-muted);
            line-height: 1.55;
            max-width: 38ch;
            margin: 0 auto 20px;
          }
          .ml-lede strong { color: var(--ink); font-weight: 600; }
          .ml-queue-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 999px;
            background: rgba(79, 110, 247, 0.09);
            border: 1px solid rgba(79, 110, 247, 0.18);
            color: var(--accent);
            font-family: var(--font-mono);
            font-size: 0.78rem;
            font-weight: 600;
            margin-bottom: 14px;
          }
          .ml-queue-badge--muted {
            background: var(--surface-2);
            border-color: var(--border);
            color: var(--ink-muted);
          }
          .ml-note {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 0.76rem;
            color: var(--ink-faint);
            margin-bottom: 22px;
          }
          .ml-abort { margin-top: 4px; }
          .ml-badge-icon {
            width: 68px;
            height: 68px;
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 6px auto 20px;
          }
          .ml-badge-icon--yellow { background: var(--warn-soft); color: var(--warn); border: 1px solid rgba(251, 191, 36, 0.3); }
          .ml-badge-icon--red { background: var(--err-soft); color: var(--err); border: 1px solid rgba(251, 113, 133, 0.3); }
          .ml-badge-icon--green { background: var(--ok-soft); color: var(--ok); border: 1px solid rgba(52, 211, 153, 0.3); }
          .ml-actions { display: flex; flex-direction: column; gap: 10px; }
          .ml-action-btn { width: 100%; }
          .ml-text-btn {
            border: none;
            background: none;
            color: var(--ink-muted);
            font-size: 0.85rem;
            cursor: pointer;
            padding: 6px;
          }
          .ml-text-btn:hover { color: var(--ink); }
          .ml-versus {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            gap: 12px;
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px 20px;
            margin: 20px 0;
          }
          .ml-player { text-align: left; min-width: 0; }
          .ml-player--right { text-align: right; }
          .ml-player-tag {
            font-family: var(--font-mono);
            font-size: 0.62rem;
            font-weight: 600;
            color: var(--ink-muted);
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .ml-player-name {
            font-size: 0.98rem;
            font-weight: 650;
            color: var(--ink);
            margin-top: 3px;
          }
          .ml-player-rating { font-size: 0.74rem; color: var(--ink-muted); margin-top: 2px; }
          .ml-vs { font-size: 0.8rem; font-weight: 700; color: var(--ink-faint); }
          .ml-countdown-label {
            font-family: var(--font-mono);
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--ink-muted);
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }
          .ml-countdown {
            font-family: var(--font-display);
            font-size: 3.4rem;
            font-weight: 750;
            line-height: 1.15;
            color: var(--accent);
          }
          @media (max-width: 480px) {
            .ml-card { padding: 34px 22px 28px; }
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
}
