import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RotateCcw, Home } from 'lucide-react';
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

  const ink = isWinner ? 'var(--riso-teal)' : (isDraw ? 'var(--riso-violet)' : 'var(--riso-coral)');
  const emoji = isWinner ? '🏆' : (isDraw ? '🤝' : '⚔️');
  const heading = isWinner ? 'VICTORY' : (isDraw ? 'DRAW' : 'DEFEAT');
  const sub = isWinner
    ? 'Superior deduction speed and accuracy verified.'
    : (isDraw ? 'Equal cognitive performance registered across both nodes.' : 'Review mistake analysis to recalibrate your competitive strategy.');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="zine-card"
      style={{ maxWidth: '580px', margin: '2rem auto', padding: '2.5rem 2.25rem', textAlign: 'center', position: 'relative', zIndex: 10, boxShadow: `10px 10px 0 ${ink}` }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, background: ink, borderBottom: '3px solid var(--ink)' }} />
      <div className="halftone-ink halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none' }} />

      <div style={{ marginBottom: '1.75rem', position: 'relative' }}>
        <div style={{
          width: '84px',
          height: '84px',
          background: ink,
          border: '3px solid var(--ink)',
          boxShadow: `5px 5px 0 var(--ink)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '1.5rem auto 1.1rem',
          fontSize: '2.4rem',
          transform: 'rotate(-4deg)'
        }}>
          {emoji}
        </div>

        <h1 className="zine-display misreg" data-text={heading} style={{ fontSize: 'clamp(1.9rem, 6vw, 2.8rem)', marginBottom: '0.4rem' }}>
          {heading}
        </h1>
        <p className="zine-lede" style={{ fontSize: '0.875rem' }}>{sub}</p>
      </div>

      {/* Head to head */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        background: 'var(--paper-sunk)',
        border: '2px solid var(--ink)',
        padding: '1.15rem 1.25rem',
        marginBottom: '1.25rem',
        position: 'relative'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Your Score</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1, color: 'var(--riso-teal)', textTransform: 'uppercase' }}>{myScore ?? 0}</div>
        </div>

        <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--ink)', padding: '0 0.6rem' }}>VS</div>

        <div style={{ textAlign: 'right' }}>
          <div className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oppName}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', lineHeight: 1, color: 'var(--ink)', textTransform: 'uppercase' }}>{oppScore ?? 0}</div>
        </div>
      </div>

      {/* Rating delta */}
      {matchResult.mode !== 'RANKED' && matchResult.isBotMatch ? (
        <div className="font-mono" style={{
          background: 'var(--paper-sunk)',
          border: '2px dashed var(--ink-faint)',
          padding: '0.85rem 1.15rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          color: 'var(--ink-muted)',
          fontSize: '0.75rem',
          textAlign: 'center'
        }}>
          <span>🤖 Custom Bot Simulation — Ranked Elo rating unaffected.</span>
        </div>
      ) : (
        <div style={{
          background: myDelta > 0 ? 'var(--riso-teal)' : (myDelta < 0 ? 'var(--riso-coral)' : 'var(--paper-sunk)'),
          color: myDelta === 0 ? 'var(--ink)' : '#fffdf6',
          border: '2px solid var(--ink)',
          boxShadow: '4px 4px 0 var(--ink)',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              background: 'var(--paper-card)',
              border: '2px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              flexShrink: 0
            }}>
              {currentRank.badge}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="zine-display" style={{ fontSize: '0.85rem' }}>{currentRank.name} Tier</div>
              <div className="font-mono" style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                {myBefore} &rarr; <strong>{myAfter}</strong> Elo
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {myDelta > 0 ? <TrendingUp size={20} /> : (myDelta < 0 ? <TrendingDown size={20} /> : null)}
            <span className="zine-display" style={{ fontSize: '1.3rem' }}>{myDelta > 0 ? `+${myDelta}` : myDelta}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <button onClick={onRematch} className="btn-primary" style={{ flex: 1, minWidth: '170px' }}>
          <RotateCcw size={15} /> REMATCH
        </button>
        <button onClick={() => onDashboard ? onDashboard() : navigate('/dashboard')} className="btn-secondary" style={{ flex: 1, minWidth: '170px' }}>
          <Home size={15} /> DASHBOARD
        </button>
      </div>
    </motion.div>
  );
}
