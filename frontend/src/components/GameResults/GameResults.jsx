import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Zap, Coins, Target, RefreshCw, LayoutGrid } from 'lucide-react';

export default function GameResults({
  score = 0,
  total = 10,
  xpEarned = 0,
  coinsEarned = null,
  onPlayAgain,
  gameTitle = "Challenge Complete",
  customMessage = null
}) {
  const navigate = useNavigate();

  const correctCount = score;
  const incorrectCount = Math.max(0, total - score);
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
  const calculatedCoins = coinsEarned !== null ? coinsEarned : Math.floor(xpEarned / 2.5);

  let emoji = '⚡';
  let heading = 'SESSION CONCLUDED';
  let ink = 'var(--riso-yellow)';

  if (accuracy >= 80) {
    emoji = '🏆';
    heading = 'SUPERIOR PERFORMANCE';
    ink = 'var(--riso-violet)';
  } else if (accuracy >= 50) {
    emoji = '⭐';
    heading = 'EVALUATION COMPLETE';
    ink = 'var(--riso-teal)';
  }

  const metrics = [
    { icon: <CheckCircle size={14} />, label: 'Correct',   value: correctCount,   ink: 'var(--riso-teal)' },
    { icon: <XCircle size={14} />,     label: 'Incorrect', value: incorrectCount, ink: 'var(--riso-coral)' },
    { icon: <Target size={14} />,      label: 'Accuracy',  value: `${accuracy}%`,  ink: 'var(--riso-violet)' },
    { label: 'Score', value: `${score * 10} pts`, ink: 'var(--riso-yellow)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingTop: '7.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
      <div className="paper-grain" />
      <div className="halftone-violet halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.25 }} />
      <div className="tape" style={{ top: 110, left: '10%', transform: 'rotate(-8deg)' }} />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="zine-card"
        style={{
          textAlign: 'center',
          maxWidth: '520px',
          width: '100%',
          padding: '2.5rem 2.25rem',
          margin: '1.5rem',
          boxShadow: `10px 10px 0 ${ink}`,
          position: 'relative',
          zIndex: 10
        }}
      >
        <div style={{ height: 12, background: ink, borderBottom: '3px solid var(--ink)' }} />

        <div style={{ paddingTop: '1.75rem' }}>
          <div style={{
            width: '86px', height: '86px', margin: '0 auto 1.1rem',
            background: 'var(--paper-sunk)',
            border: '3px solid var(--ink)',
            boxShadow: `5px 5px 0 ${ink}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.6rem',
            transform: 'rotate(-4deg)'
          }}>
            {emoji}
          </div>

          <h1 className="zine-display misreg" data-text={heading} style={{ fontSize: 'clamp(1.5rem, 5vw, 2.1rem)', marginBottom: '0.5rem' }}>
            {heading}
          </h1>

          <p className="zine-lede" style={{ fontSize: '0.875rem', marginBottom: '1.75rem' }}>
            {customMessage || <>Successfully executed <strong style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>{gameTitle}</strong> with </>}
            <strong className="font-mono" style={{ color: 'var(--ink)' }}>{score}/{total}</strong> correct answers.
          </p>

          {/* 4-metric grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {metrics.map((m) => (
              <div
                key={m.label}
                style={{
                  background: 'var(--paper-sunk)',
                  border: '2px solid var(--ink)',
                  borderLeft: `8px solid ${m.ink}`,
                  padding: '0.75rem 0.85rem',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--ink)', marginBottom: '0.2rem' }}>
                  {m.icon}
                  <span className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{m.label}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', lineHeight: 1, textTransform: 'uppercase' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Rewards */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            background: 'var(--riso-ink, var(--ink))',
            border: '2px solid var(--ink)',
            padding: '1rem',
            marginBottom: '1.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Zap size={22} color="var(--riso-yellow)" fill="var(--riso-yellow)" />
              <div style={{ textAlign: 'left' }}>
                <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fffdf6' }}>+{xpEarned} XP</div>
                <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--paper-edge)', letterSpacing: '0.14em' }}>EXPERIENCE</div>
              </div>
            </div>

            <div style={{ width: '2px', alignSelf: 'stretch', background: 'var(--paper-edge)', opacity: 0.5 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Coins size={22} color="var(--riso-yellow)" />
              <div style={{ textAlign: 'left' }}>
                <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--riso-yellow)' }}>+{calculatedCoins} COINS</div>
                <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--paper-edge)', letterSpacing: '0.14em' }}>TOKENS</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {onPlayAgain && (
              <button onClick={onPlayAgain} className="btn-primary" style={{ flex: 1, minWidth: '150px' }}>
                <RefreshCw size={14} /> REPLAY
              </button>
            )}
            <button onClick={() => navigate('/games')} className="btn-secondary" style={{ flex: 1, minWidth: '150px' }}>
              <LayoutGrid size={14} /> ARENAS
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
