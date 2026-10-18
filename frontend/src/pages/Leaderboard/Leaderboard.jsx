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
      <div className="container container--narrow stack">
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
        .lb-card { overflow: hidden; }
        .lb-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 64px 24px;
          font-size: 0.875rem;
        }
        .lb-row {
          display: grid;
          grid-template-columns: 44px 34px 1fr auto;
          align-items: center;
          gap: 14px;
          padding: 13px 20px;
          border-bottom: 1px solid var(--border);
        }
        .lb-row:last-child { border-bottom: none; }
        .lb-row--you { background: var(--surface-2); }
        .lb-rank {
          color: var(--ink-faint);
          font-size: 0.8rem;
        }
        .lb-rank--top { color: var(--ink); font-weight: 600; }
        .lb-player { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .lb-name {
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lb-you-tag {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-muted);
          border: 1px solid var(--border-strong);
          border-radius: 5px;
          padding: 1px 5px;
        }
        .lb-meta { font-size: 0.75rem; color: var(--ink-muted); }
        .lb-value { font-size: 0.85rem; font-weight: 600; }
        @media (max-width: 520px) {
          .lb-row { grid-template-columns: 34px 1fr auto; padding: 12px 16px; }
          .lb-rank { display: none; }
        }
      `}</style>
    </div>
  );
}
