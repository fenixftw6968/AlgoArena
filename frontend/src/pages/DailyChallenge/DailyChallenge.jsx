import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';
import api from '../../utils/api';

const GAME_TYPE_LABELS = {
  'dsa-master-quiz':     'DSA & Algorithms',
  'logic-puzzle':        'Logic & Deduction',
  'number-detective':    'Mathematical Sequence',
  'code-breaker':        'Combinatorial Cipher',
};

export default function DailyChallenge() {
  const { refreshUser } = useAuth();
  const { showXPPopup } = useGame();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);
  const [puzzleData, setPuzzleData] = useState(null);
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
      const data = res.data;
      setChallenge(data);

      let parsed = null;
      if (data?.puzzle) {
        try {
          parsed = typeof data.puzzle === 'string' ? JSON.parse(data.puzzle) : data.puzzle;
        } catch {
          parsed = null;
        }
      }
      setPuzzleData(parsed);

      if (data.attempted) {
        setSubmitted(true);
        setResult({
          correct: data.isCorrect === true,
          xpEarned: data.xpEarned || 0,
          coinEarned: data.coinsEarned || 0,
          explanation: data.explanation || parsed?.explanation || "",
          correctAnswer: data.correctAnswer || parsed?.correctAnswer || parsed?.answer || ""
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
      const xpEarned = res.data.alreadyAttempted ? 0 : (res.data.xpEarned || 0);
      const coinEarned = res.data.alreadyAttempted ? 0 : (res.data.coinsEarned || 0);

      setResult({
        correct: isCorrect,
        xpEarned: xpEarned,
        coinEarned: coinEarned,
        explanation: res.data.explanation || "",
        correctAnswer: res.data.correctAnswer || ""
      });

      if (isCorrect && xpEarned > 0) {
        showXPPopup(xpEarned, 'Daily Mission Complete');
      }
      refreshUser();
    } catch (err) {
      console.error("Failed to submit daily answer", err);
    }
  };

  return (
    <div className="page">
      <div className="container container--narrow stack">
        {/* Navigation bar */}
        <div className="row row--between">
          <button onClick={() => navigate('/dashboard')} className="btn btn--secondary btn--sm">
            <ArrowLeft size={14} /> Back to dashboard
          </button>
          <div className="daily-timer-pill mono">
            <Clock size={13} />
            <span>Next mission in {timeLeft}</span>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <span className="zine-spinner" style={{ margin: '0 auto 12px' }} />
            <p className="muted" style={{ fontSize: '0.8125rem' }}>Fetching daily problem…</p>
          </div>
        ) : !challenge ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p className="muted">No daily challenge found for today.</p>
          </div>
        ) : (
          <div className="card daily-card">
            <div className="daily-card-head">
              <span className="zine-kicker">
                {GAME_TYPE_LABELS[challenge.gameSlug] || 'Daily Assessment'}
              </span>
              <h1 className="daily-card-title">{challenge.title || 'Daily Puzzle'}</h1>
            </div>

            <div className="daily-prompt">
              {puzzleData?.question || challenge.question || challenge.description}
            </div>

            {puzzleData?.options && !submitted && (
              <div className="daily-options-grid">
                {puzzleData.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAnswer(opt)}
                    className={`daily-option-btn ${answer === opt ? 'daily-option-btn--active' : ''}`}
                  >
                    <span className="daily-option-idx">{String.fromCharCode(65 + idx)}</span>
                    <span className="daily-option-val mono">{opt}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Answer interface or Results */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="daily-form">
                <div>
                  <label className="zine-label" htmlFor="daily-ans">Your Solution</label>
                  <input
                    id="daily-ans"
                    type="text"
                    required
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="zine-field mono"
                    placeholder="Enter output or final numerical deduction…"
                    autoFocus
                  />
                </div>

                <div className="row row--between" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHint(true);
                      setHintUsed(true);
                    }}
                    className="btn btn--secondary btn--sm"
                    disabled={showHint || !challenge.hint}
                  >
                    <Lightbulb size={13} />
                    <span>{showHint ? 'Hint displayed' : 'Show hint (-5 XP)'}</span>
                  </button>

                  <button type="submit" className="btn btn--primary btn--sm">
                    Submit answer
                  </button>
                </div>

                {showHint && challenge.hint && (
                  <div className="zine-hint" style={{ marginTop: 12 }}>
                    <Lightbulb size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ink-soft)' }}>{challenge.hint}</span>
                  </div>
                )}
              </form>
            ) : (
              <div className="daily-result-pane">
                <div className={`daily-result-header ${result?.correct ? 'daily-result--ok' : 'daily-result--err'}`}>
                  {result?.correct ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                      {result?.correct ? 'Correct solution' : 'Incorrect solution'}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                      {result?.correct ? `+${result.xpEarned} XP awarded` : 'Review the solution below'}
                    </div>
                  </div>
                </div>

                {result?.correctAnswer && (
                  <div className="daily-info-row">
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Verified solution:</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{result.correctAnswer}</span>
                  </div>
                )}

                {result?.explanation && (
                  <div className="daily-explanation">
                    <div className="zine-kicker" style={{ marginBottom: 4 }}>Explanation</div>
                    <p style={{ fontSize: '0.84375rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                      {result.explanation}
                    </p>
                  </div>
                )}

                <div className="row" style={{ marginTop: 16 }}>
                  <button onClick={() => navigate('/games')} className="btn btn--secondary btn--sm grow">
                    Browse more arenas
                  </button>
                  <button onClick={() => navigate('/dashboard')} className="btn btn--primary btn--sm grow">
                    Return to dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .daily-timer-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--accent-ink);
          background: var(--accent-subtle);
          border: 2px solid #0A0A0A;
          box-shadow: 2px 2px 0px #0A0A0A;
          border-radius: var(--radius-sm);
          padding: 4px 10px;
        }

        .daily-card {
          padding: 28px 32px;
          background: var(--surface);
          border-radius: var(--radius);
        }

        .daily-card-head {
          margin-bottom: 20px;
        }

        .daily-card-title {
          font-size: 1.35rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin-top: 4px;
        }

        .daily-prompt {
          padding: 16px 20px;
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--ink);
          white-space: pre-wrap;
          margin-bottom: 20px;
        }

        .daily-options-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }

        @media (max-width: 640px) {
          .daily-options-grid {
            grid-template-columns: 1fr;
          }
        }

        .daily-option-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: var(--surface-elevated);
          border: 2px solid #0A0A0A;
          box-shadow: 2px 2px 0px #0A0A0A;
          border-radius: var(--radius-sm);
          color: var(--ink);
          text-align: left;
          font-weight: 600;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .daily-option-btn:hover {
          border-color: var(--border-hover);
          background: var(--surface-subtle);
        }

        .daily-option-btn--active {
          border-color: #0A0A0A;
          background: var(--accent);
          color: #0A0A0A;
          font-weight: 700;
        }

        .daily-option-idx {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-xs);
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--ink-soft);
          flex-shrink: 0;
        }

        .daily-option-btn--active .daily-option-idx {
          border-color: #0A0A0A;
          background: #0A0A0A;
          color: var(--accent);
        }

        .daily-option-val {
          font-size: 0.875rem;
        }

        .daily-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .daily-result-pane {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .daily-result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-sm);
        }

        .daily-result--ok {
          background: var(--ok-soft);
          color: var(--ink);
          border: 2px solid #0A0A0A;
          box-shadow: 3px 3px 0px var(--accent);
        }

        .daily-result--err {
          background: #0A0A0A;
          color: #FFFFFF;
          border: 2px solid #0A0A0A;
          box-shadow: 3px 3px 0px var(--accent);
        }

        .daily-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--surface-subtle);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }

        .daily-explanation {
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--surface-subtle);
        }
      `}</style>
    </div>
  );
}
