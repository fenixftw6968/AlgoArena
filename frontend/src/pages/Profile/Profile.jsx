import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import XPBar from '../../components/XPBar/XPBar';
import RankCard from '../../components/RankCard/RankCard';
import { getRankForLevel, getXPForNextLevel, getXPForCurrentLevel } from '../../data/mockUser';
import { Flame, Coins, Trophy, Star, Lock } from 'lucide-react';
import api from '../../utils/api';

const RARITY_INKS = {
  COMMON:    { ink: 'var(--ink-muted)',   label: 'Common' },
  UNCOMMON:  { ink: 'var(--riso-teal)',    label: 'Uncommon' },
  RARE:      { ink: 'var(--riso-violet)',  label: 'Rare' },
  EPIC:      { ink: 'var(--riso-coral)',   label: 'Epic' },
  LEGENDARY: { ink: 'var(--riso-yellow)',  label: 'Legendary' },
};

export default function Profile() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievementsAndMatches = async () => {
      try {
        const [achRes, unlockedRes, matchesRes] = await Promise.all([
          api.get('/api/achievements').catch(() => ({ data: [] })),
          api.get('/api/achievements/me').catch(() => ({ data: [] })),
          api.get('/api/matches/recent').catch(() => ({ data: [] }))
        ]);
        setAchievements(achRes.data || []);
        setUnlockedAchievements(unlockedRes.data || []);
        setRecentMatches(matchesRes.data || []);
      } catch (e) {
        console.error("Failed to load profile data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievementsAndMatches();
  }, []);

  if (!user) return null;

  const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievement?.achievementKey));
  const rank        = getRankForLevel(user.level);
  const xpCurrent  = user.xp - getXPForCurrentLevel(user.level);
  const xpNext     = getXPForNextLevel(user.level) - getXPForCurrentLevel(user.level);

  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', position: 'relative' }}>
      <div className="paper-grain" />

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem', position: 'relative', zIndex: 1 }}>

        {/* Profile header card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="zine-card"
          style={{ padding: '1.75rem', marginBottom: '1.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', boxShadow: '8px 8px 0 var(--riso-violet)' }}
        >
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div className="zine-stamp" style={{
              width: '84px',
              height: '84px',
              background: 'var(--riso-coral)',
              color: '#fffdf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem'
            }}>
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div className="zine-badge" style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              background: 'var(--riso-yellow)',
              color: 'var(--ink)',
              border: '2px solid var(--ink)',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              padding: 0
            }}>
              {rank.icon}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '260px' }}>
            <span className="zine-kicker">Thinker Profile</span>
            <h1 className="zine-display misreg" data-text={user.username} style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', marginTop: '0.35rem' }}>
              {user.username}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className="zine-badge" style={{ background: 'var(--riso-violet)' }}>{rank.name}</span>
              <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Joined {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <XPBar current={xpCurrent} total={xpNext} level={user.level} />
          </div>

          {/* Quick stats metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', minWidth: '220px' }}>
            {[
              { icon: <Flame size={14} />,  value: `${user.currentStreak || 0}d`, label: 'Streak',     ink: 'var(--riso-coral)' },
              { icon: <Coins size={14} />,  value: user.coins || 0,        label: 'Coins',      ink: 'var(--riso-yellow)' },
              { icon: <Trophy size={14} />, value: user.gamesCompleted || 0, label: 'Games',      ink: 'var(--riso-teal)' },
              { icon: <Star size={14} />,   value: `${user.longestStreak || 0}d`, label: 'Best Streak', ink: 'var(--riso-violet)' },
            ].map((s, i) => (
              <div key={i} className="zine-panel" style={{ padding: '0.7rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--ink)', display: 'flex', justifyContent: 'center', marginBottom: '0.2rem' }}>{s.icon}</div>
                <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: s.ink, textShadow: '1px 1px 0 var(--ink)' }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Competitive Career Summary */}
        <div style={{ marginBottom: '1.75rem' }}>
          <RankCard
            rating={user.competitiveRating || 500}
            matchesPlayed={user.matchesPlayed || 0}
            matchesWon={user.matchesWon || 0}
          />
        </div>

        {/* Achievements Section */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="zine-display" style={{ fontSize: '1.25rem' }}>🏆 Achievements</h2>
            <span className="zine-badge" style={{ background: 'var(--paper-sunk)' }}>{unlockedIds.size} / {achievements.length} UNLOCKED</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {achievements.map((ach) => {
              const isUnlocked = unlockedIds.has(ach.achievementKey);
              const rarity = RARITY_INKS[ach.rarity] || RARITY_INKS.COMMON;

              return (
                <div
                  key={ach.id || ach.achievementKey}
                  className="zine-card"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    opacity: isUnlocked ? 1 : 0.55,
                    boxShadow: isUnlocked ? '4px 4px 0 var(--riso-teal)' : 'none',
                    borderStyle: isUnlocked ? 'solid' : 'dashed',
                    filter: isUnlocked ? 'none' : 'grayscale(0.7)'
                  }}
                >
                  <div style={{
                    width: '42px',
                    height: '42px',
                    background: isUnlocked ? 'var(--riso-yellow)' : 'var(--paper-sunk)',
                    border: '2px solid var(--ink)',
                    boxShadow: '2px 2px 0 var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    {isUnlocked ? ach.icon || '🏅' : <Lock size={16} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem', gap: '0.5rem' }}>
                      <span className="zine-display" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ach.title}
                      </span>
                      <span className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 800, color: rarity.ink, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {rarity.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
                      {ach.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
