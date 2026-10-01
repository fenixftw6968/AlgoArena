import { motion } from 'framer-motion';
import { getRankFromRating, getNextRank, getRankProgress } from '../../utils/rankUtils';

export default function RankCard({ rating = 500, matchesPlayed = 0, matchesWon = 0, compact = false }) {
  const currentRank = getRankFromRating(rating);
  const nextRank = getNextRank(rating);
  const progress = getRankProgress(rating);
  const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;

  if (compact) {
    return (
      <span className="zine-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--riso-violet)', color: '#fffdf6', padding: '0.3rem 0.7rem' }}>
        <span style={{ fontSize: '0.85rem' }}>{currentRank.badge}</span>
        <span>{currentRank.name}</span>
        <span style={{ opacity: 0.75 }}>&middot; {rating}</span>
      </span>
    );
  }

  const stats = [
    { label: 'Played',   value: matchesPlayed, ink: 'var(--ink)' },
    { label: 'Victories', value: matchesWon,   ink: 'var(--riso-teal)' },
    { label: 'Win Rate', value: `${winRate}%`,  ink: 'var(--riso-coral)' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="zine-card"
      style={{ padding: '1.6rem', position: 'relative', overflow: 'hidden' }}
    >
      <div className="halftone-violet halftone-fade-l" style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, opacity: 0.28 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'var(--riso-yellow)',
            border: '2px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '3px 3px 0 var(--ink)',
            transform: 'rotate(-3deg)',
            flexShrink: 0
          }}>
            {currentRank.badge}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="zine-display" style={{ fontSize: '1.05rem' }}>{currentRank.name}</span>
              <span className="zine-badge" style={{ background: 'var(--riso-violet)', color: '#fffdf6', fontSize: '0.58rem' }}>1v1 Ranked</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>{currentRank.desc}</p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="zine-num" style={{ fontSize: '2.1rem' }}>{rating}</div>
          <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Rating Elo</div>
        </div>
      </div>

      {nextRank && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
              Next Tier: <span className="zine-display" style={{ fontSize: '0.78rem' }}>{nextRank.name}</span>
            </span>
            <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink)', fontWeight: 700 }}>
              {rating} / {nextRank.minRating} &middot; {progress}%
            </span>
          </div>
          <div className="zine-meter">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ height: '100%', background: 'repeating-linear-gradient(45deg, var(--riso-violet) 0 8px, var(--riso-violet-2) 8px 16px)' }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '2px solid var(--ink)', background: 'var(--paper-sunk)' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ padding: '0.7rem 0.5rem', textAlign: 'center', borderLeft: i === 0 ? 'none' : '2px dashed var(--ink-faint)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', lineHeight: 1, color: s.ink === 'var(--ink)' ? 'var(--ink)' : s.ink, textTransform: 'uppercase' }}>{s.value}</div>
            <div className="font-mono" style={{ fontSize: '0.58rem', color: 'var(--ink-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
