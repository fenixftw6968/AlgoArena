import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRankFromRating } from '../../utils/rankUtils';
import api from '../../utils/api';

const TABS = [
  { id: 'Ranked',  label: 'Competitive Rating', sortBy: 'rating' },
  { id: 'Global',  label: 'Account XP', sortBy: 'xp' },
  { id: 'Streaks', label: 'Streaks',    sortBy: 'streak' },
  { id: 'Games',   label: 'Matches won', sortBy: 'games' },
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
      <div className="container stack">
        <header className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-lede">Global competitive standings across the AlgoArena network.</p>
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
              <span className="muted" style={{ fontSize: '0.8125rem' }}>Synchronizing rankings…</span>
            </div>
          ) : board.length === 0 ? (
            <div className="lb-state">
              <span className="muted" style={{ fontSize: '0.8125rem' }}>No ranking records recorded for this category yet.</span>
            </div>
          ) : (
            board.map((player, idx) => {
              const isCurrentUser = user && user.username === player.username;
              const rankObj = getRankFromRating(player.competitiveRating || 500);

              let displayVal = `${player.competitiveRating ?? 101} Rating`;
              if (activeTab === 'Global')  displayVal = `${(player.xp || 0).toLocaleString()} XP`;
              if (activeTab === 'Streaks') displayVal = `${player.currentStreak || 0}d`;
              if (activeTab === 'Games')   displayVal = `${player.matchesWon || 0} wins`;

              return (
                <div
                  key={`${player.username}-${idx}`}
                  className={`lb-row${isCurrentUser ? ' lb-row--you' : ''}`}
                >
                  <span className={`lb-rank mono${idx < 3 ? ' lb-rank--top' : ''}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <span className="avatar">{player.username?.[0]?.toUpperCase()}</span>

                  <div className="lb-player">
                    <span className="lb-name truncate">
                      {player.username}
                      {isCurrentUser && <span className="lb-you-tag">You</span>}
                    </span>
                    <span className="lb-meta mono">Level {player.level || 1} · {rankObj.name}</span>
                  </div>

                  <span className="lb-value mono">{displayVal}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
