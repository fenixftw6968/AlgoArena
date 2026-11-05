import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Zap, Coins, Target, RefreshCw, LayoutGrid } from 'lucide-react';

export default function GameResults({
  score = 0,
  total = 10,
  xpEarned = 0,
  coinsEarned = null,
  ratingEarned = null,
  onPlayAgain,
  gameTitle = "Session Complete",
  customMessage = null
}) {
  const navigate = useNavigate();

  const correctCount = score;
  const incorrectCount = Math.max(0, total - score);
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const calculatedCoins = coinsEarned !== null ? coinsEarned : Math.floor(xpEarned / 2.5);
  const calculatedRating = ratingEarned !== null ? ratingEarned : (score * 5);

  const metrics = [
    { label: 'Correct',   value: correctCount,   tone: 'var(--ok)' },
    { label: 'Incorrect', value: incorrectCount, tone: 'var(--err)' },
    { label: 'Accuracy',  value: `${accuracy}%`,  tone: 'var(--ink)' },
    { label: 'Points',    value: `${score * 10}`, tone: 'var(--ink)' },
  ];

  return (
    <div className="gr-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="card gr-card"
      >
        <div className="gr-hero">
          <span className="badge badge--success" style={{ marginBottom: 8 }}>Complete</span>
          <h1 className="gr-title">Evaluation Summary</h1>
          <p className="gr-lede">
            {customMessage || <>Performance recorded for <strong>{gameTitle}</strong>.</>}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="gr-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="gr-metric">
              <span className="gr-metric-label">{m.label}</span>
              <div className="gr-metric-value mono" style={{ color: m.tone }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Rewards */}
        <div className="gr-rewards">
          <div className="gr-reward">
            <span className="gr-reward-label">Experience</span>
            <span className="gr-reward-value mono">+{xpEarned} XP</span>
          </div>

          <div className="gr-reward-divider" />

          <div className="gr-reward">
            <span className="gr-reward-label">Coins</span>
            <span className="gr-reward-value mono">+{calculatedCoins}</span>
          </div>

          <div className="gr-reward-divider" />

          <div className="gr-reward">
            <span className="gr-reward-label">Rating</span>
            <span className="gr-reward-value mono" style={{ color: 'var(--accent)' }}>+{calculatedRating}</span>
          </div>
        </div>

        <div className="gr-actions">
          {onPlayAgain && (
            <button onClick={onPlayAgain} className="btn btn--primary btn--sm gr-action">
              <RefreshCw size={13} /> Try again
            </button>
          )}
          <button onClick={() => navigate('/games')} className="btn btn--secondary btn--sm gr-action">
            <LayoutGrid size={13} /> Browse arenas
          </button>
        </div>
      </motion.div>

      <style>{`
        .gr-page {
          min-height: 100vh;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 88px 20px 60px;
        }

        .gr-card {
          width: 100%;
          max-width: 440px;
          padding: 28px 32px;
          background: var(--surface);
          border-radius: var(--radius);
        }

        .gr-hero {
          text-align: center;
          margin-bottom: 24px;
        }

        .gr-title {
          font-size: 1.35rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .gr-lede {
          margin-top: 4px;
          font-size: 0.8125rem;
          color: var(--ink-muted);
        }

        .gr-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          margin-bottom: 16px;
        }

        .gr-metric {
          padding: 12px 10px;
          text-align: center;
          border-right: 1px solid var(--border);
        }

        .gr-metric:last-child {
          border-right: none;
        }

        .gr-metric-label {
          display: block;
          font-size: 0.6875rem;
          color: var(--ink-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .gr-metric-value {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 2px;
        }

        .gr-rewards {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          margin-bottom: 20px;
        }

        .gr-reward {
          display: flex;
          flex-direction: column;
        }

        .gr-reward-divider {
          width: 1px;
          height: 24px;
          background: var(--border);
        }

        .gr-reward-label {
          font-size: 0.6875rem;
          color: var(--ink-muted);
          font-weight: 500;
        }

        .gr-reward-value {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink);
          margin-top: 2px;
        }

        .gr-actions {
          display: flex;
          gap: 8px;
        }

        .gr-action {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
