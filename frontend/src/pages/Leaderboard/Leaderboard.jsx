import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getRankFromRating } from '../../utils/rankUtils';
import api from '../../utils/api';

const TABS = [
  { id: 'Ranked', label: '⚔️ Ranked Elo', sortBy: 'rating' },
  { id: 'Global', label: '⭐ Account XP', sortBy: 'xp' },
  { id: 'Streaks', label: '🔥 Streaks', sortBy: 'streak' },
  { id: 'Games', label: '🎮 Games Won', sortBy: 'games' }
];

const RANK_ACCENTS = [
  { ink: 'var(--riso-yellow)', emoji: '🥇' },
  { ink: 'var(--riso-teal)',   emoji: '🥈' },
  { ink: 'var(--riso-coral)',  emoji: '🥉' }
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
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', position: 'relative' }}>
      <div className="paper-grain" />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="zine-kicker">Global Classification</span>
          <h1 className="zine-display misreg" data-text="LEADERBOARD" style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)', marginTop: '0.5rem' }}>
            LEADERBOARD
          </h1>
          <p className="zine-lede" style={{ marginTop: '0.5rem' }}>
            Top ranked analytical minds across the AlgoArena network
          </p>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.75rem' }}>
          {TABS.map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`zine-btn-sm${active ? ' zine-btn-sm--violet' : ''}`}
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.72rem' }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Board container */}
        <div className="zine-card" style={{ overflow: 'hidden', boxShadow: '8px 8px 0 var(--riso-violet)' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="zine-spinner" style={{ margin: '0 auto 1rem' }} />
              <p className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                Querying ranking index...
              </p>
            </div>
          ) : (
            <div>
              {board.map((player, idx) => {
                const isCurrentUser = user && user.username === player.username;
                const topAccent = RANK_ACCENTS[idx];
                const rankObj = getRankFromRating(player.competitiveRating || 500);

                let displayVal = `${player.competitiveRating || 500} Elo`;
                if (activeTab === 'Global') displayVal = `${(player.xp || 0).toLocaleString()} XP`;
                if (activeTab === 'Streaks') displayVal = `${player.currentStreak || 0}d streak`;
                if (activeTab === 'Games') displayVal = `${player.matchesWon || 0} won`;

                return (
                  <div
                    key={idx}
                    className="lb-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3.5rem 1fr auto auto',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.95rem 1.4rem',
                      borderBottom: idx < board.length - 1 ? '2px dashed var(--ink-faint)' : 'none',
                      background: isCurrentUser ? 'var(--riso-yellow)' : 'transparent'
                    }}
                  >
                    {/* Rank number / medal */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {topAccent ? (
                        <span style={{ fontSize: '1.3rem' }}>{topAccent.emoji}</span>
                      ) : (
                        <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--ink-muted)' }}>
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* User info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        background: isCurrentUser ? 'var(--riso-coral)' : 'var(--paper-sunk)',
                        color: isCurrentUser ? '#fffdf6' : 'var(--ink)',
                        border: '2px solid var(--ink)',
                        boxShadow: '2px 2px 0 var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0
                      }}>
                        {player.username?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span className="zine-display" style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {player.username}
                          </span>
                          {isCurrentUser && (
                            <span className="zine-badge" style={{ background: 'var(--riso-coral)', color: '#fffdf6', fontSize: '0.55rem' }}>
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="font-mono" style={{ fontSize: '0.64rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          Level {player.level || 1} • {rankObj.name}
                        </div>
                      </div>
                    </div>

                    {/* Rank Badge */}
                    <div className="hidden sm:block">
                      <span className="zine-badge" style={{ background: 'var(--paper-sunk)' }}>
                        {rankObj.badge} {rankObj.name}
                      </span>
                    </div>

                    {/* Stat Value */}
                    <div style={{ textAlign: 'right' }}>
                      <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: topAccent ? topAccent.ink : 'var(--ink)' }}>
                        {displayVal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
