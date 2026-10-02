import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Clock, Flame } from 'lucide-react';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';

const DIFF_STYLES = {
  EASY:   { ink: 'var(--riso-teal)',   label: 'EASY' },
  MEDIUM: { ink: 'var(--riso-violet)', label: 'MEDIUM' },
  HARD:   { ink: 'var(--riso-coral)',  label: 'HARD' }
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
  showDailyCountdown = true,
  onMidnightRollover = null
}) {
  const normDiff = (difficulty || 'MEDIUM').toUpperCase();
  const ds = DIFF_STYLES[normDiff] || DIFF_STYLES.MEDIUM;
  const progressPercent = Math.min(100, Math.max(0, (current / (total || 1)) * 100));

  const [dailyCountdown, setDailyCountdown] = useState(() => getDailyCountdown().formatted);

  useEffect(() => {
    if (!showDailyCountdown) return;

    const timer = setInterval(() => {
      setDailyCountdown(getDailyCountdown().formatted);
    }, 1000);

    const unsubscribe = subscribeToMidnightIST((newDate, oldDate) => {
      if (typeof onMidnightRollover === 'function') {
        onMidnightRollover(newDate, oldDate);
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [showDailyCountdown, onMidnightRollover]);

  const timerInk =
    urgency === 'critical' ? 'var(--riso-coral)' :
    urgency === 'warning'  ? 'var(--riso-yellow)' : 'var(--ink)';

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        {onExit && (
          <button onClick={onExit} className="zine-btn-sm">
            <ArrowLeft size={13} /> EXIT ARENA
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {showDailyCountdown && dailyCountdown && (
            <span
              className="zine-badge"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--riso-coral)', color: '#fffdf6' }}
              title="Questions refresh every night at 12:00 AM Indian Standard Time (Asia/Kolkata)"
            >
              <Flame size={11} /> RESET {dailyCountdown}
            </span>
          )}

          <span className="zine-badge" style={{ background: 'var(--paper-sunk)' }}>
            SEQ <strong style={{ fontWeight: 800 }}>{current}</strong> / {total}
          </span>

          <span className="zine-badge" style={{ background: ds.ink, color: ds.ink === 'var(--riso-yellow)' ? 'var(--ink)' : '#fffdf6' }}>
            {ds.label || normDiff}
          </span>

          <span className="zine-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--riso-yellow)' }}>
            <Star size={11} /> {scoreLabel.toUpperCase()}: {score}
          </span>

          {formattedTime && (
            <span
              className="zine-badge"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: timerInk, color: timerInk === 'var(--riso-yellow)' ? 'var(--ink)' : '#fffdf6', fontSize: '0.72rem' }}
            >
              <Clock size={11} /> {formattedTime}
            </span>
          )}
        </div>
      </div>

      {/* Progress Track — segmented riso meter */}
      <div style={{ display: 'flex', gap: '3px', width: '100%', height: '16px', background: 'var(--paper-sunk)', border: '2px solid var(--ink)' }}>
        <motion.div
          style={{
            height: '100%',
            background: 'repeating-linear-gradient(45deg, var(--riso-violet) 0 7px, var(--riso-violet-2) 7px 14px)',
            borderRight: progressPercent > 0 ? '2px solid var(--ink)' : 'none'
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
