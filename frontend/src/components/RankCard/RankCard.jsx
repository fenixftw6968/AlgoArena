import { getRankFromRating, getNextRank, getRankProgress } from '../../utils/rankUtils';

export default function RankCard({ rating = 500, matchesPlayed = 0, matchesWon = 0, compact = false }) {
  const currentRank = getRankFromRating(rating);
  const nextRank = getNextRank(rating);
  const progress = getRankProgress(rating);
  const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;

  if (compact) {
    return (
      <span className="badge">
        {currentRank.name} · {rating}
      </span>
    );
  }

  return (
    <section className="card rank-card">
      <div className="rank-head">
        <div>
          <div className="zine-kicker">Ranked career</div>
          <div className="rank-title">
            {currentRank.name}
            <span className="rank-rating num">{rating}</span>
          </div>
        </div>
        <div className="rank-record mono">
          {matchesWon}W – {matchesPlayed - matchesWon}L · {winRate}% win rate
        </div>
      </div>

      {nextRank && (
        <div className="rank-progress">
          <div className="rank-progress-labels">
            <span>{nextRank.name}</span>
            <span className="mono">{rating} / {nextRank.minRating}</span>
          </div>
          <div className="xp-bar-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="rank-stats">
        {[
          { label: 'Played', value: matchesPlayed },
          { label: 'Won', value: matchesWon },
          { label: 'Win rate', value: `${winRate}%` },
        ].map((s, i) => (
          <div key={s.label} className={`rank-stat${i > 0 ? ' rank-stat--div' : ''}`}>
            <span className="rank-stat-value num">{s.value}</span>
            <span className="rank-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        .rank-card { padding: 24px; }
        .rank-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .rank-title {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-top: 8px;
          font-size: 1.2rem;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .rank-rating { font-size: 1.2rem; color: var(--ink-muted); }
        .rank-record { font-size: 0.75rem; color: var(--ink-muted); }
        .rank-progress { margin-top: 22px; }
        .rank-progress-labels {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 0.75rem;
          color: var(--ink-muted);
        }
        .rank-stats {
          display: flex;
          gap: 0;
          margin-top: 24px;
          border-top: 1px solid var(--border);
          padding-top: 18px;
        }
        .rank-stat { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .rank-stat--div { border-left: 1px solid var(--border); padding-left: 20px; }
        .rank-stat-value { font-size: 1.05rem; font-weight: 600; }
        .rank-stat-label { font-size: 0.72rem; color: var(--ink-muted); }
      `}</style>
    </section>
  );
}
