import { motion } from 'framer-motion';

export default function XPBar({ current, total, level, animated = true }) {
  const pct = Math.min(100, Math.round((current / total) * 100));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', gap: '0.5rem' }}>
        <span className="zine-badge" style={{ background: 'var(--riso-violet)', color: '#fffdf6' }}>LEVEL {level}</span>
        <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 800 }}>{current.toLocaleString()}</strong>
          {' / '}{total.toLocaleString()} XP
        </span>
      </div>

      <div className="zine-meter" style={{ height: '16px' }}>
        <motion.div
          style={{ height: '100%', background: 'repeating-linear-gradient(45deg, var(--riso-violet) 0 8px, var(--riso-violet-2) 8px 16px)' }}
          initial={animated ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
        <span className="font-mono" style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', fontWeight: 700, letterSpacing: '0.12em' }}>{pct}% PROGRESSED</span>
      </div>
    </div>
  );
}
