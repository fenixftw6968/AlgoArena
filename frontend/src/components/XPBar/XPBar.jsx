export default function XPBar({ current, total, level, animated = true }) {
  const pct = Math.min(100, Math.round((current / total) * 100));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', fontWeight: 500 }}>
          Level {level}
        </span>
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          {current.toLocaleString()} / {total.toLocaleString()} XP
        </span>
      </div>
      <div className="xp-bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="xp-bar-fill"
          style={{
            width: `${pct}%`,
            transition: animated ? 'width 0.6s ease' : 'none',
          }}
        />
      </div>
    </div>
  );
}
