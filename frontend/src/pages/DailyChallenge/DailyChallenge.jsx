import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';
import api from '../../utils/api';

const GAME_TYPE_LABELS = {
  'dsa-master-quiz':     'DSA & Algorithms',
  'logic-puzzle':        'Logic & Reasoning',
  'number-detective':    'Number Sequence',
  'code-breaker':        'Code Breaker',
};

export default function DailyChallenge() {
  const { refreshUser } = useAuth();
  const { showXPPopup } = useGame();
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
        showXPPopup(xpEarned, 'Daily mission complete');
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
      <div className="page">
        <div className="dc-state">
          <span className="zine-spinner" />
          <span className="muted">Loading today's mission…</span>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="page">
        <div className="container--narrow" style={{ margin: '0 auto' }}>
          <div className="card dc-empty">
            <h2 className="page-title" style={{ fontSize: '1.25rem' }}>No active mission</h2>
            <p className="muted" style={{ marginTop: 8, fontSize: '0.875rem' }}>
              Check back later for the next daily challenge.
            </p>
            <button onClick={() => navigate('/dashboard')} className="btn btn--primary" style={{ marginTop: 24 }}>
              Return to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeLabel = GAME_TYPE_LABELS[challenge.gameSlug] || 'Daily Challenge';

  let puzzleData = {};
  try {
    puzzleData = typeof challenge.puzzle === 'string' ? JSON.parse(challenge.puzzle) : (challenge.puzzle || {});
  } catch (e) {
    puzzleData = { question: challenge.description };
  }

  const hasOptions = Array.isArray(puzzleData.options) && puzzleData.options.length > 0;

  return (
    <div className="page">
      <div className="container container--narrow stack">
        <button onClick={() => navigate('/dashboard')} className="dc-back">
          <ArrowLeft size={14} /> Dashboard
        </button>

        {/* Header */}
        <header>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <span className="zine-kicker">Daily mission · {typeLabel}</span>
            <span className="badge badge--ink mono" style={{ marginLeft: 'auto' }}>Resets in {timeLeft}</span>
          </div>
          <h1 className="page-title">{challenge.title}</h1>
          <p className="page-lede">{challenge.description}</p>

          <div className="row" style={{ gap: 8, marginTop: 16 }}>
            <span className="badge">+{challenge.xpReward} XP</span>
            <span className="badge">+{challenge.coinReward} coins</span>
            {challenge.difficulty && <span className="badge">{challenge.difficulty}</span>}
          </div>
        </header>

        {/* Question */}
        <section className="card dc-question">
          <div className="zine-kicker" style={{ marginBottom: 10 }}>Problem</div>
          <p className="dc-question-text">{puzzleData.question}</p>
        </section>

        {/* Answer */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="stack--sm" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {hasOptions ? (
              <div className="dc-options" role="radiogroup" aria-label="Answer options">
                {puzzleData.options.map((opt, optIdx) => {
                  const isSelected = answer === opt;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      type="button"
                      key={optIdx}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setAnswer(opt)}
                      className={`dc-option${isSelected ? ' dc-option--selected' : ''}`}
                    >
                      <span className="dc-option-letter mono">{letter}</span>
                      <span className="dc-option-text">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Type your answer…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                className="zine-field zine-input--mono dc-input"
                aria-label="Your answer"
              />
            )}

            {showHint && puzzleData.hint && (
              <div className="zine-hint" role="note">
                <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>{puzzleData.hint}</span>
              </div>
            )}

            <div className="row" style={{ gap: 10 }}>
              {!showHint && puzzleData.hint && answer === '' && (
                <button
                  type="button"
                  onClick={() => { setShowHint(true); setHintUsed(true); }}
                  className="btn btn--secondary"
                >
                  <Lightbulb size={14} /> Hint
                </button>
              )}
              <button
                type="submit"
                disabled={!answer.trim()}
                className="btn btn--primary grow"
              >
                Submit answer
              </button>
            </div>
          </form>
        ) : (
          <div className="stack--sm" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className={`dc-result ${result?.correct ? 'dc-result--ok' : 'dc-result--err'}`} role="status">
              <span className="dc-result-icon">
                {result?.correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
              </span>
              <div>
                <div className="dc-result-title">
                  {result?.correct ? 'Correct' : 'Not quite'}
                </div>
                {result?.correct ? (
                  <div className="dc-result-sub mono">+{result.xpEarned} XP · +{result.coinEarned} coins</div>
                ) : (
                  <div className="dc-result-sub">One attempt per day. See the explanation below.</div>
                )}
              </div>
            </div>

            {result?.explanation && (
              <div className="card dc-note">
                <div className="zine-kicker" style={{ marginBottom: 8 }}>Explanation</div>
                <p className="dc-note-text">{result.explanation}</p>
              </div>
            )}

            {!result?.correct && result?.correctAnswer && (
              <div className="card dc-note">
                <div className="zine-kicker" style={{ marginBottom: 8 }}>Correct answer</div>
                <p className="dc-note-text">{result.correctAnswer}</p>
              </div>
            )}

            <div className="row row--between">
              <span className="muted mono" style={{ fontSize: '0.75rem' }}>
                Next challenge in {timeLeft}
              </span>
              <button onClick={() => navigate('/dashboard')} className="btn btn--secondary">
                Return to dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .dc-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          align-self: flex-start;
          border: none;
          background: none;
          padding: 0;
          color: var(--ink-muted);
          font-size: 0.82rem;
          cursor: pointer;
        }
        .dc-back:hover { color: var(--ink); }
        .dc-state {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 0.875rem;
        }
        .dc-empty { padding: 48px 32px; text-align: center; max-width: 440px; margin: 8vh auto 0; }
        .dc-question { padding: 24px; }
        .dc-question-text { font-size: 1.02rem; line-height: 1.7; color: var(--ink); white-space: pre-wrap; }
        .dc-options { display: grid; gap: 10px; }
        .dc-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-sm);
          background: var(--surface);
          color: var(--ink);
          font-size: 0.9rem;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .dc-option:hover { background: var(--surface-2); }
        .dc-option--selected { border-color: var(--ink); background: var(--surface-2); box-shadow: inset 2px 0 0 var(--ink); }
        .dc-option-letter {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          flex-shrink: 0;
        }
        .dc-option--selected .dc-option-letter { background: var(--ink); border-color: var(--ink); color: #fff; }
        .dc-input { text-align: center; font-size: 1rem; height: 46px; }
        .dc-result {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .dc-result--ok { background: var(--ok-soft); border-color: #bbf7d0; color: var(--ok); }
        .dc-result--err { background: var(--err-soft); border-color: #fecaca; color: var(--err); }
        .dc-result-icon { display: flex; }
        .dc-result-title { font-weight: 600; font-size: 0.95rem; }
        .dc-result-sub { font-size: 0.8rem; margin-top: 2px; opacity: 0.85; }
        .dc-note { padding: 20px; }
        .dc-note-text { font-size: 0.9rem; line-height: 1.65; color: var(--ink-soft); white-space: pre-wrap; }
      `}</style>
    </div>
  );
}
