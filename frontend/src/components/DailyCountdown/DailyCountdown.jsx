import React, { useState, useEffect } from 'react';
import { Clock, Flame } from 'lucide-react';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';

export default function DailyCountdown({
  onMidnight,
  compact = false,
  showLabel = true
}) {
  const [countdown, setCountdown] = useState(() => getDailyCountdown());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getDailyCountdown());
    }, 1000);

    const unsubscribe = subscribeToMidnightIST((newDate, oldDate) => {
      if (typeof onMidnight === 'function') {
        onMidnight(newDate, oldDate);
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [onMidnight]);

  if (compact) {
    return (
      <span className="badge badge--danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Flame size={11} /> Resets {countdown.formatted}
      </span>
    );
  }

  return (
    <div className="card dc-count-card">
      <div className="dc-count-icon">
        <Clock size={18} />
      </div>

      <div>
        {showLabel && (
          <div className="dc-count-label">Daily arena refresh · 12:00 AM IST</div>
        )}
        <div className="dc-count-value num">{countdown.formatted}</div>
      </div>

      <style>{`
        .dc-count-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 0px;
        }
        .dc-count-icon {
          width: 42px;
          height: 42px;
          border-radius: 0px;
          background: #0A0A0A;
          border: 2px solid #0A0A0A;
          box-shadow: 2px 2px 0px var(--accent);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dc-count-label {
          font-size: 0.68rem;
          color: var(--ink-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .dc-count-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: 0.02em;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
