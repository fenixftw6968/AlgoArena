import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRankFromRating } from '../../utils/rankUtils';
import api from '../../utils/api';

const TABS = [
  { id: 'Ranked',  label: 'Ranked Elo', sortBy: 'rating' },
  { id: 'Global',  label: 'Account XP', sortBy: 'xp' },
  { id: 'Streaks', label: 'Streaks',    sortBy: 'streak' },
  { id: 'Games',   label: 'Games won',  sortBy: 'games' },
];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('Ranked');
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const tabObj = TABS.find(t => t.id === activeTab) || TABS[0];
        const res = await api.get(`/api/leaderboard?sortBy=${tabObj.sortBy}`);
        setBoard(res.data);
      } catch (e) {
        console.error("Failed to fetch leaderboard", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [activeTab]);

  return (
    <div className="page">
      <div className="container stack" style={{ maxWidth: 'min(96vw, 1500px)' }}>
        <header className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-lede">Top players across the AlgoArena network.</p>
        </header>

        <div className="tabs" role="tablist" aria-label="Leaderboard category">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab${activeTab === t.id ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card lb-card">
          {loading ? (
            <div className="lb-state">
              <span className="zine-spinner" />
              <span className="muted">Loading rankings…</span>
            </div>
          ) : board.length === 0 ? (
            <div className="lb-state"><span className="muted">No ranking data yet.</span></div>
          ) : (
            board.map((player, idx) => {
              const isCurrentUser = user && user.username === player.username;
              const rankObj = getRankFromRating(player.competitiveRating || 500);

              let displayVal = `${player.competitiveRating || 500} Elo`;
              if (activeTab === 'Global')  displayVal = `${(player.xp || 0).toLocaleString()} XP`;
              if (activeTab === 'Streaks') displayVal = `${player.currentStreak || 0}d`;
              if (activeTab === 'Games')   displayVal = `${player.matchesWon || 0}`;

              return (
                <div
                  key={`${player.username}-${idx}`}
                  className={`lb-row${isCurrentUser ? ' lb-row--you' : ''}`}
                >
                  <span className={`lb-rank num${idx < 3 ? ' lb-rank--top' : ''}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <span className="avatar">{player.username?.[0]?.toUpperCase()}</span>

                  <span className="lb-player">
                    <span className="lb-name truncate">
                      {player.username}
                      {isCurrentUser && <span className="lb-you-tag">You</span>}
                    </span>
                    <span className="lb-meta">Level {player.level || 1} · {rankObj.name}</span>
                  </span>

                  <span className="lb-value num">{displayVal}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .lb-card { overflow: hidden; border-radius: 20px; }
        .lb-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 80px 24px;
          font-size: 1.1rem;
        }
        .lb-row {
          display: grid;
          grid-template-columns: 60px 48px 1fr auto;
          align-items: center;
          gap: 24px;
          padding: 22px 32px;
          border-bottom: 1px solid var(--border);
        }
        .lb-row:last-child { border-bottom: none; }
        .lb-row--you { background: rgba(91, 140, 255, 0.09); box-shadow: inset 3px 0 0 var(--accent); }
        .lb-rank {
          color: var(--ink-faint);
          font-size: 1.15rem;
          font-weight: 600;
        }
        .lb-rank--top {
          font-family: var(--font-display);
          font-weight: 700;
          color: #ffd479;
          text-shadow: 0 0 18px rgba(251, 191, 36, 0.45);
        }
        .lb-player { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .lb-name {
          font-size: 1.18rem;
          font-weight: 650;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lb-you-tag {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 3px 8px;
          background: var(--surface);
        }
        .lb-meta { font-size: 0.92rem; color: var(--ink-muted); }
        .lb-value { font-size: 1.28rem; font-weight: 750; color: var(--ink); }
        @media (max-width: 520px) {
          .lb-row { grid-template-columns: 40px 1fr auto; padding: 16px 18px; gap: 14px; }
          .lb-rank { display: none; }
        }
      `}</style>
    </div>
  );
}
