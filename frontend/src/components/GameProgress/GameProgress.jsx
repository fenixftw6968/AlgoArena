import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';
import { subscribeToMidnightIST } from '../../services/dailyQuestionService';

const DIFF_STYLES = {
  EASY:   { tone: 'var(--ok)',   label: 'Easy' },
  MEDIUM: { tone: 'var(--ink-soft)', label: 'Medium' },
  HARD:   { tone: 'var(--err)',  label: 'Hard' },
};

export default function GameProgress({
  current = 1,
  total = 10,
  score = 0,
  difficulty = 'MEDIUM',
  onExit,
  formattedTime = null,
  urgency = 'normal',
  scoreLabel = 'Score',
  onMidnightRollover = null
}) {
  const normDiff = (difficulty || 'MEDIUM').toUpperCase();
  const ds = DIFF_STYLES[normDiff] || DIFF_STYLES.MEDIUM;
  const progressPercent = Math.min(100, Math.max(0, (current / (total || 1)) * 100));

  useEffect(() => {
    const unsubscribe = subscribeToMidnightIST((newDate, oldDate) => {
      if (typeof onMidnightRollover === 'function') {
        onMidnightRollover(newDate, oldDate);
      }
    });

    return unsubscribe;
  }, [onMidnightRollover]);

  const timerTone =
    urgency === 'critical' ? 'var(--err)' :
    urgency === 'warning'  ? 'var(--warn)' : 'var(--ink)';

  return (
    <div className="gp-root">
      {/* Top action bar */}
      <div className="gp-bar">
        {onExit && (
          <button onClick={onExit} className="btn btn--secondary btn--sm gp-exit">
            <ArrowLeft size={13} /> Exit
          </button>
        )}

        <div className="gp-badges">
          <span className="gp-badge mono">
            Q{current}/{total}
          </span>

          {normDiff !== 'ALL' && (
            <span className="gp-badge" style={{ color: ds.tone }}>
              {ds.label || normDiff}
            </span>
          )}

          <span className="gp-badge mono">
            {scoreLabel}: {score}
          </span>

          {formattedTime && (
            <span className="gp-badge mono" style={{ color: timerTone }}>
              <Clock size={11} /> {formattedTime}
            </span>
          )}
        </div>
      </div>

      {/* Progress track */}
      <div className="gp-track" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="gp-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </div>

      <style>{`
        .gp-root {
          margin-bottom: 20px;
        }

        .gp-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .gp-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          flex-wrap: wrap;
        }

        .gp-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 28px;
          padding: 0 8px;
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          background: var(--surface-elevated);
          font-size: 0.75rem;
          color: var(--ink-soft);
          font-weight: 500;
        }

        .gp-track {
          width: 100%;
          height: 10px;
          background: #FFFFFF;
          border: 2px solid #0A0A0A;
          border-radius: 0px;
          overflow: hidden;
          box-shadow: 2px 2px 0px #0A0A0A;
        }

        .gp-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 0px;
        }
      `}</style>
    </div>
  );
}
