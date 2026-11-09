import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Zap } from 'lucide-react';

const TONES = { EASY: 'var(--ok)', MEDIUM: 'var(--ink)', HARD: 'var(--err)' };
const TONE_SOFT = { EASY: 'var(--ok-soft)', MEDIUM: 'var(--surface-subtle)', HARD: 'var(--err-soft)' };

const DEFAULT_DIFFICULTIES = [
  {
    id: 'EASY',
    label: 'Easy Tier',
    xp: '+10 XP',
    time: '90s clock',
    desc: 'Foundational algorithmic intuition and gentle constraints.'
  },
  {
    id: 'MEDIUM',
    label: 'Medium Tier',
    xp: '+25 XP',
    time: '60s clock',
    desc: 'Standard competitive difficulty with balanced deduction steps.'
  },
  {
    id: 'HARD',
    label: 'Hard Tier',
    xp: '+50 XP',
    time: '45s clock',
    desc: 'Complex edge cases, strict timers, and intricate logical depth.'
  }
];

export default function DifficultySelector({
  title = "Select Difficulty",
  subtitle = "Choose an evaluation tier to calibrate problem constraints and timers.",
  onSelectDifficulty,
  onBack,
  customTiers = null,
  loadingTier = null
}) {
  const tiers = customTiers || DEFAULT_DIFFICULTIES;

  return (
    <div className="ds-page">
      <div className="ds-wrap">
        {onBack && (
          <button onClick={onBack} className="btn btn--secondary btn--sm ds-back">
            <ArrowLeft size={13} /> Back to arenas
          </button>
        )}

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
          <div className="ds-head">
            <span className="zine-kicker">Calibration</span>
            <h1 className="ds-title">{title}</h1>
          </div>

          <div className="ds-list">
            {tiers.map((tier) => {
              const key = String(tier.id).toUpperCase();
              const isCurrentLoading = loadingTier && String(loadingTier).toUpperCase() === key;
              const isAnyLoading = !!loadingTier;

              return (
                <button
                  key={tier.id}
                  disabled={isAnyLoading}
                  onClick={() => !isAnyLoading && onSelectDifficulty(tier.id)}
                  className="ds-tier"
                  style={{
                    cursor: isAnyLoading ? (isCurrentLoading ? 'wait' : 'not-allowed') : 'pointer',
                    opacity: isAnyLoading && !isCurrentLoading ? 0.45 : 1,
                  }}
                >
                  <div className="ds-tier-main">
                    <div className="ds-tier-title">
                      <span>{tier.label || tier.id}</span>
                      {isCurrentLoading && <span className="zine-spinner" style={{ width: 14, height: 14 }} />}
                    </div>
                  </div>

                  <div className="ds-tier-meta">
                    <div className="ds-xp mono">{tier.xp}</div>
                    {tier.time && (
                      <div className="ds-time mono">
                        <Clock size={11} />
                        <span>{tier.time}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <style>{`
        .ds-page {
          min-height: 100vh;
          background: transparent;
          padding: 88px 20px 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ds-wrap {
          width: 100%;
          max-width: 520px;
        }

        .ds-back {
          margin-bottom: 24px;
        }

        .ds-head {
          margin-bottom: 24px;
        }

        .ds-title {
          font-size: 1.5rem;
          font-weight: 650;
          letter-spacing: -0.03em;
          margin-top: 4px;
          color: var(--ink);
        }

        .ds-lede {
          margin-top: 6px;
          font-size: 0.84375rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .ds-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ds-tier {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          text-align: left;
          border-radius: var(--radius-sm);
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          transition: border-color 0.12s ease, background 0.12s ease;
        }

        .ds-tier:hover:not(:disabled) {
          border-color: #0A0A0A;
          background: var(--accent-subtle);
        }

        .ds-tier:hover:not(:disabled) .ds-xp {
          color: var(--accent-ink);
        }

        .ds-tier-main {
          flex: 1;
          min-width: 0;
        }

        .ds-tier-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink);
        }

        .ds-tier-desc {
          margin-top: 3px;
          font-size: 0.78125rem;
          color: var(--ink-muted);
          line-height: 1.45;
        }

        .ds-tier-meta {
          text-align: right;
          flex-shrink: 0;
        }

        .ds-xp {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--ink);
        }

        .ds-time {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: flex-end;
          color: var(--ink-faint);
          margin-top: 2px;
          font-size: 0.6875rem;
        }
      `}</style>
    </div>
  );
}
