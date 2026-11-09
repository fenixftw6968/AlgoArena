import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RotateCcw, Home, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRankFromRating } from '../../utils/rankUtils';

export default function CompetitiveResults({
  matchResult,
  currentUserId,
  onRematch,
  onDashboard
}) {
  const navigate = useNavigate();

  if (!matchResult) return null;

  const isPlayer1 = matchResult.player1Id === currentUserId;
  const myScore = isPlayer1 ? matchResult.player1Score : matchResult.player2Score;
  const oppScore = isPlayer1 ? matchResult.player2Score : matchResult.player1Score;
  const oppName = isPlayer1 ? (matchResult.player2Username || 'Opponent') : (matchResult.player1Username || 'Opponent');

  const myDelta = isPlayer1 ? matchResult.player1RatingChange : matchResult.player2RatingChange;
  const myBefore = isPlayer1 ? matchResult.player1Rating : matchResult.player2Rating;
  const myAfter = (myBefore || 500) + (myDelta || 0);

  const isWinner = matchResult.winnerId === currentUserId;
  const isDraw = matchResult.winnerId === null && matchResult.player1Score === matchResult.player2Score;

  const currentRank = getRankFromRating(myAfter);

  const heading = isWinner ? 'Match Won' : (isDraw ? 'Match Draw' : 'Match Defeat');
  const sub = isWinner
    ? 'All criteria satisfied. Competitive rating updated.'
    : (isDraw ? 'Evenly matched finish. Score recorded.' : 'Round completed. Review deductions and queue again.');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card cr-card"
    >
      <div className="cr-hero">
        <span className={`badge ${isWinner ? 'badge--success' : isDraw ? 'badge--warn' : 'badge--danger'}`} style={{ marginBottom: 8 }}>
          {isWinner ? 'Victory' : isDraw ? 'Stalemate' : 'Defeat'}
        </span>
        <h1 className="cr-title">{heading}</h1>
        <p className="cr-lede">{sub}</p>
      </div>

      {/* Head to head table */}
      <div className="cr-versus">
        <div className="cr-player">
          <div className="cr-player-tag">You</div>
          <div className="cr-player-score mono">{myScore ?? 0}</div>
        </div>

        <div className="cr-vs mono">VS</div>

        <div className="cr-player cr-player--right">
          <div className="cr-player-tag truncate">{oppName}</div>
          <div className="cr-player-score mono">{oppScore ?? 0}</div>
        </div>
      </div>

      {/* Rating delta */}
      {matchResult.mode !== 'RANKED' && matchResult.isBotMatch ? (
        <div className="cr-note mono">
          Bot Practice Match — Rating ladder is unaffected.
        </div>
      ) : (
        <div className="cr-delta">
          <div className="cr-rank">
            <div>
              <div className="cr-rank-name">{currentRank.name} Tier</div>
              <div className="cr-rank-elo mono">
                {myBefore} → <strong style={{ color: 'var(--accent)' }}>{myAfter}</strong> Rating
              </div>
            </div>
          </div>

          <div className={`cr-delta-value mono ${myDelta > 0 ? 'cr-delta-value--up' : myDelta < 0 ? 'cr-delta-value--down' : ''}`}>
            {myDelta > 0 ? <TrendingUp size={15} /> : myDelta < 0 ? <TrendingDown size={15} /> : <Minus size={15} />}
            <span>{myDelta > 0 ? `+${myDelta}` : myDelta}</span>
          </div>
        </div>
      )}

      <div className="cr-actions">
        <button onClick={onRematch} className="btn btn--primary btn--sm cr-action">
          <RotateCcw size={14} /> Rematch
        </button>
        <button onClick={() => onDashboard ? onDashboard() : navigate('/dashboard')} className="btn btn--secondary btn--sm cr-action">
          <Home size={14} /> Dashboard
        </button>
      </div>

      <style>{`
        .cr-card {
          max-width: 460px;
          margin: 1.5rem auto;
          padding: 28px 32px;
          background: var(--surface);
          border-radius: var(--radius);
        }

        .cr-hero {
          text-align: center;
          margin-bottom: 24px;
        }

        .cr-title {
          font-size: 1.35rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .cr-lede {
          margin-top: 4px;
          font-size: 0.8125rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }

        .cr-versus {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          margin-bottom: 16px;
        }

        .cr-player {
          display: flex;
          flex-direction: column;
        }

        .cr-player--right {
          align-items: flex-end;
        }

        .cr-player-tag {
          font-size: 0.75rem;
          color: var(--ink-muted);
          font-weight: 500;
        }

        .cr-player-score {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--ink);
        }

        .cr-vs {
          font-size: 0.75rem;
          color: var(--ink-faint);
          font-weight: 600;
        }

        .cr-note {
          padding: 8px 12px;
          background: var(--surface-subtle);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          color: var(--ink-muted);
          text-align: center;
          margin-bottom: 20px;
        }

        .cr-delta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          margin-bottom: 24px;
          background: var(--surface-subtle);
        }

        .cr-rank-name {
          font-size: 0.84375rem;
          font-weight: 600;
          color: var(--ink);
        }

        .cr-rank-elo {
          font-size: 0.75rem;
          color: var(--ink-muted);
          margin-top: 1px;
        }

        .cr-delta-value {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--ink-muted);
        }

        .cr-delta-value--up {
          color: var(--accent-ink);
        }

        .cr-delta-value--down {
          color: var(--ink);
        }

        .cr-actions {
          display: flex;
          gap: 10px;
        }

        .cr-action {
          flex: 1;
        }
      `}</style>
    </motion.div>
  );
}
