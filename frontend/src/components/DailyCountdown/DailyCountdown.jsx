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
      <span className="zine-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--riso-coral)', color: '#fffdf6', padding: '0.35rem 0.75rem' }}>
        <Flame size={12} /> RESET {countdown.formatted}
      </span>
    );
  }

  return (
    <div className="zine-card" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '1rem 1.25rem', boxShadow: '4px 4px 0 var(--riso-coral)' }}>
      <div style={{
        width: '44px',
        height: '44px',
        background: 'var(--riso-coral)',
        border: '2px solid var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fffdf6',
        flexShrink: 0,
        boxShadow: '3px 3px 0 var(--ink)',
        transform: 'rotate(-3deg)'
      }}>
        <Clock size={19} />
      </div>

      <div>
        {showLabel && (
          <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Daily Arena Refresh (12:00 AM IST)
          </div>
        )}
        <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.04em' }}>
          {countdown.formatted}
        </div>
      </div>
    </div>
  );
}
