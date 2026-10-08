import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Coins, Lightbulb, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';
import api from '../../utils/api';

const GAME_TYPE_LABELS = {
  'dsa-master-quiz':     { label: 'DSA & Algorithms', icon: '🧠' },
  'logic-puzzle':        { label: 'Logic & Reasoning', icon: '🧩' },
  'number-detective':    { label: 'Number Sequence', icon: '🔢' },
  'code-breaker':        { label: 'Code Breaker', icon: '🔐' },
};

export default function DailyChallenge() {
  const { refreshUser } = useAuth();
  const { xpPopups, showXPPopup } = useGame();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [answer, setAnswer]       = useState('');
  const [hintUsed, setHintUsed]   = useState(false);
  const [showHint, setShowHint]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult]       = useState(null);
  const [timeLeft, setTimeLeft]   = useState(() => getDailyCountdown().formatted);
  const isSubmittingRef           = useRef(false);

  const fetchChallenge = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/games/daily');
      setChallenge(res.data);
      if (res.data.attempted) {
        // One graded attempt per day: the server only sends the answer/explanation once graded.
        setSubmitted(true);
        setResult({
          correct: res.data.isCorrect === true,
          xpEarned: res.data.xpEarned || 0,
          coinEarned: res.data.coinsEarned || 0,
          explanation: res.data.explanation || "",
          correctAnswer: res.data.correctAnswer || ""
        });
      } else {
        setSubmitted(false);
        setResult(null);
        setAnswer('');
        setShowHint(false);
        setHintUsed(false);
        isSubmittingRef.current = false;
      }
    } catch (e) {
      console.error("Failed to load daily challenge", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenge();
  }, []);

  // Sync live countdown to 12:00:00 AM IST & auto-refresh challenge when date flips
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getDailyCountdown().formatted);
    }, 1000);

    const unsubscribe = subscribeToMidnightIST(() => {
      fetchChallenge();
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || !answer.trim() || submitted) return;
    isSubmittingRef.current = true;
    setSubmitted(true);

    try {
      const res = await api.post('/api/games/daily/attempts', {
        userAnswer: answer.trim(),
        answer: answer.trim(),
        hintUsed: hintUsed
      });

      const isCorrect = res.data.isCorrect !== undefined ? res.data.isCorrect : (res.data.correct !== undefined ? res.data.correct : false);
      // Rewards are decided by the server only; a repeat submission earns nothing new.
      const xpEarned = res.data.alreadyAttempted ? 0 : (res.data.xpEarned || 0);
      const coinEarned = res.data.alreadyAttempted ? 0 : (res.data.coinsEarned || 0);

      setResult({
        correct: isCorrect,
        xpEarned,
        coinEarned,
        explanation: res.data.explanation || "",
        correctAnswer: res.data.correctAnswer || ""
      });

      if (isCorrect && !res.data.alreadyAttempted) {
        showXPPopup(xpEarned, 'Daily Mission Complete!');
      }

      await refreshUser();
    } catch (e) {
      console.error("Failed to submit daily challenge attempt", e);
      setResult({
        correct: false,
        xpEarned: 0,
        coinEarned: 0,
        explanation: e.response?.data?.message || "Verification failed. Please retry your selection."
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="paper-grain" />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="zine-spinner" style={{ margin: '0 auto 1rem' }} />
          <p className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            Synchronizing daily seed...
          </p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="paper-grain" />
        <div className="zine-card" style={{ textAlign: 'center', padding: '2.5rem 2rem', boxShadow: '8px 8px 0 var(--riso-coral)', position: 'relative', zIndex: 1, maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🗞️</div>
          <h2 className="zine-display misreg" data-text="NO ACTIVE MISSION" style={{ fontSize: '1.5rem', marginBottom: '0.6rem' }}>
            NO ACTIVE MISSION
          </h2>
          <p className="zine-lede" style={{ marginBottom: '1.5rem' }}>Check back later for the next daily synchronization.</p>
          <button onClick={() => navigate('/dashboard')} className="zine-btn zine-btn--violet">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const typeConfig = GAME_TYPE_LABELS[challenge.gameSlug] || { label: 'Daily Cognitive Challenge', icon: '🧠' };

  let puzzleData = {};
  try {
    puzzleData = typeof challenge.puzzle === 'string' ? JSON.parse(challenge.puzzle) : (challenge.puzzle || {});
  } catch (e) {
    puzzleData = { question: challenge.description };
  }

  const hasOptions = Array.isArray(puzzleData.options) && puzzleData.options.length > 0;

  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6rem', position: 'relative' }}>
      <div className="paper-grain" />

      {/* Top back navigation */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem 1.5rem 0', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/dashboard')} className="zine-btn zine-btn--ghost zine-btn--sm">
          <ArrowLeft size={13} /> Back to Dashboard
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.25rem 1.5rem 5rem', position: 'relative', zIndex: 1 }}>

        {/* Main Challenge Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="zine-card"
          style={{ padding: '2rem', boxShadow: '10px 10px 0 var(--riso-violet)' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.3rem' }}>{typeConfig.icon}</span>
            <span className="zine-kicker">Daily Seed • {typeConfig.label}</span>
            <div className="zine-badge" style={{ marginLeft: 'auto', background: 'var(--riso-violet)', gap: '0.35rem' }}>
              <Clock size={11} /> RESETS {timeLeft}
            </div>
          </div>

          <h1 className="zine-display misreg" data-text={challenge.title} style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', marginBottom: '0.5rem' }}>
            {challenge.title}
          </h1>
          <p className="zine-lede" style={{ marginBottom: '1.25rem' }}>
            {challenge.description}
          </p>

          {/* Rewards Panel */}
          <div className="zine-panel" style={{ display: 'flex', gap: '1.1rem', padding: '0.7rem 0.9rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Star size={14} color="var(--riso-yellow)" fill="var(--riso-yellow)" />
              <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)' }}>+{challenge.xpReward} XP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Coins size={14} />
              <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ink)' }}>+{challenge.coinReward} COINS</span>
            </div>
            <span className="zine-badge" style={{ marginLeft: 'auto', background: 'var(--riso-coral)' }}>{challenge.difficulty}</span>
          </div>

          {/* Puzzle Challenge Area */}
          <div className="zine-panel" style={{ padding: '1.5rem 1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <div className="zine-kicker" style={{ marginBottom: '0.6rem' }}>Problem Statement</div>
            <div className="zine-display" style={{ fontSize: '1.1rem', lineHeight: 1.55, wordBreak: 'break-word' }}>
              {puzzleData.question}
            </div>
          </div>

          {/* Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {hasOptions ? (
                <div className="zine-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {puzzleData.options.map((opt, optIdx) => {
                    const isSelected = answer === opt;
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <button
                        type="button"
                        key={optIdx}
                        onClick={() => setAnswer(opt)}
                        className={`zine-option${isSelected ? ' zine-option--selected' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', padding: '0.8rem 1rem' }}
                      >
                        <span style={{
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid var(--ink)',
                          background: isSelected ? 'var(--riso-violet)' : 'var(--paper-sunk)',
                          color: isSelected ? '#fffdf6' : 'var(--ink)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          flexShrink: 0
                        }}>
                          {letter}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 700 : 600 }}>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Enter your sequence answer..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                    className="zine-input zine-input--mono"
                    style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 800 }}
                  />
                </div>
              )}

              {/* Hint */}
              <AnimatePresence>
                {showHint && puzzleData.hint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="zine-hint"
                  >
                    <Lightbulb size={15} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                    <span style={{ fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--ink)' }}>{puzzleData.hint}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {!showHint && puzzleData.hint && (
                  <button
                    type="button"
                    onClick={() => { setShowHint(true); setHintUsed(true); }}
                    className="zine-btn zine-btn--yellow"
                    style={{ flex: 1, minWidth: '140px' }}
                  >
                    <Lightbulb size={13} /> HINT
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!answer.trim()}
                  className="zine-btn zine-btn--violet"
                  style={{ flex: 2, minWidth: '180px', opacity: answer.trim() ? 1 : 0.5, cursor: answer.trim() ? 'pointer' : 'not-allowed' }}
                >
                  SUBMIT SOLUTION
                </button>
              </div>
            </form>
          ) : (
            /* Results View */
            <div style={{ textAlign: 'center' }}>
              <div
                className="zine-panel"
                style={{
                  padding: '1.35rem',
                  marginBottom: '1.25rem',
                  background: result?.correct ? 'var(--riso-teal)' : 'var(--riso-coral)',
                  border: '2px solid var(--ink)',
                  boxShadow: result?.correct ? '6px 6px 0 var(--ink)' : '6px 6px 0 var(--ink)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  {result?.correct ? <CheckCircle size={22} color="var(--ink)" /> : <XCircle size={22} color="#fffdf6" />}
                  <span className="zine-display" style={{ fontSize: '1.05rem' }}>
                    {result?.correct ? 'SOLUTION VERIFIED' : 'INCORRECT ATTEMPT'}
                  </span>
                </div>

                {result?.correct && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, textShadow: '1px 1px 0 rgba(255,253,246,0.6)' }}>+{result.xpEarned} XP</span>
                    <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, textShadow: '1px 1px 0 rgba(255,253,246,0.6)' }}>+{result.coinEarned} COINS</span>
                  </div>
                )}
              </div>

              {/* Explanation */}
              {result?.explanation && (
                <div className="zine-panel" style={{ textAlign: 'left', padding: '1.15rem', marginBottom: '1.25rem' }}>
                  <div className="zine-kicker" style={{ marginBottom: '0.4rem' }}>Decrypted Analysis</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{result.explanation}</div>
                </div>
              )}

              {!result?.correct && result?.correctAnswer && (
                <div className="zine-panel" style={{ textAlign: 'left', padding: '1.15rem', marginBottom: '1.25rem' }}>
                  <div className="zine-kicker" style={{ marginBottom: '0.4rem' }}>Correct Answer</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.6 }}>{result.correctAnswer}</div>
                </div>
              )}

              <div className="font-mono" style={{ fontSize: '0.8rem', marginBottom: '0.75rem', opacity: 0.8 }}>
                One attempt per day. Next challenge in {timeLeft}.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="zine-btn zine-btn--violet"
                  style={{ flex: 1, minWidth: '160px' }}
                >
                  RETURN TO DASHBOARD
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
