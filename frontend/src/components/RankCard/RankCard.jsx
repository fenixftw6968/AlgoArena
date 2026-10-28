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
        .rank-card { padding: 38px 42px; border-radius: 20px; }
        .rank-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .rank-title {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-top: 12px;
          font-size: clamp(1.8rem, 2.5vw, 2.4rem);
          font-weight: 700;
          letter-spacing: -0.025em;
        }
        .rank-rating { font-size: clamp(1.8rem, 2.5vw, 2.4rem); color: var(--ink-muted); }
        .rank-record { font-size: 1.05rem; color: var(--ink-muted); }
        .rank-progress { margin-top: 28px; }
        .rank-progress-labels {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 0.95rem;
          color: var(--ink-muted);
        }
        .rank-stats {
          display: flex;
          gap: 0;
          margin-top: 32px;
          border-top: 1px solid var(--border);
          padding-top: 24px;
        }
        .rank-stat { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .rank-stat--div { border-left: 1px solid var(--border); padding-left: 32px; }
        .rank-stat-value { font-size: clamp(1.6rem, 2.2vw, 2rem); font-weight: 750; color: var(--ink); }
        .rank-stat-label { font-size: 0.92rem; color: var(--ink-muted); font-weight: 550; }
      `}</style>
    </section>
  );
}
