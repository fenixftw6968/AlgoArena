import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import XPBar from '../../components/XPBar/XPBar';
import RankCard from '../../components/RankCard/RankCard';
import { getXPForNextLevel, getXPForCurrentLevel } from '../../data/mockUser';
import { Lock } from 'lucide-react';
import api from '../../utils/api';

const RARITY_LABEL = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

export default function Profile() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const [achRes, unlockedRes] = await Promise.all([
          api.get('/api/achievements').catch(() => ({ data: [] })),
          api.get('/api/achievements/me').catch(() => ({ data: [] })),
        ]);
        setAchievements(achRes.data || []);
        setUnlockedAchievements(unlockedRes.data || []);
      } catch (e) {
        console.error("Failed to load profile data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  if (!user) return null;

  const unlockedIds = new Set(unlockedAchievements.map(ua => ua.achievement?.achievementKey));
  const xpCurrent = user.xp - getXPForCurrentLevel(user.level);
  const xpNext    = getXPForNextLevel(user.level) - getXPForCurrentLevel(user.level);

  return (
    <div className="page">
      <div className="container stack">
        {/* Identity */}
        <section className="card profile-head">
          <span className="avatar avatar--lg">{user.username?.[0]?.toUpperCase()}</span>
          <div className="profile-head-main">
            <h1 className="profile-name">{user.username}</h1>
            <div className="profile-meta">
              Joined {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {' · '}Level {user.level || 1}
            </div>
            <div style={{ marginTop: 18, maxWidth: 480 }}>
              <XPBar current={Math.max(0, xpCurrent)} total={Math.max(1, xpNext)} level={user.level || 1} />
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid-stats" role="list" aria-label="Account stats">
          {[
            { label: 'Current streak', value: `${user.currentStreak || 0}d` },
            { label: 'Best streak',    value: `${user.longestStreak || 0}d` },
            { label: 'Coins',          value: user.coins ?? 0 },
            { label: 'Games completed', value: user.gamesCompleted || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="profile-stat" role="listitem">
              <div className="profile-stat-value num">{value}</div>
              <div className="profile-stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Ranked career */}
        <RankCard
          rating={user.competitiveRating || 500}
          matchesPlayed={user.matchesPlayed || 0}
          matchesWon={user.matchesWon || 0}
        />

        {/* Achievements */}
        <section>
          <div className="section-head">
            <h2 className="section-title">Achievements</h2>
            <span className="faint mono" style={{ fontSize: '0.75rem' }}>
              {unlockedIds.size} / {achievements.length || 0} unlocked
            </span>
          </div>

          {loading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <span className="zine-spinner" />
            </div>
          ) : achievements.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: '0.875rem' }}>No achievements available yet.</p>
            </div>
          ) : (
            <div className="grid-cards">
              {achievements.map((ach) => {
                const isUnlocked = unlockedIds.has(ach.achievementKey);
                return (
                  <div key={ach.id || ach.achievementKey} className={`card ach-card${isUnlocked ? '' : ' ach-card--locked'}`}>
                    <span className={`ach-icon${isUnlocked ? '' : ' ach-icon--locked'}`}>
                      {isUnlocked ? (ach.icon || '★') : <Lock size={13} />}
                    </span>
                    <div className="ach-body">
                      <div className="ach-top">
                        <span className="ach-title truncate">{ach.title}</span>
                        <span className="ach-rarity mono">{RARITY_LABEL[ach.rarity] || 'Common'}</span>
                      </div>
                      <p className="ach-desc">{ach.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .profile-head {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          padding: 28px;
        }
        .profile-head-main { flex: 1; min-width: 0; }
        .profile-name { font-size: 1.35rem; font-weight: 600; letter-spacing: -0.025em; }
        .profile-meta { margin-top: 4px; font-size: 0.8rem; color: var(--ink-muted); }

        .profile-stat { padding: 18px 20px; border-right: 1px solid var(--border); }
        .profile-stat:last-child { border-right: none; }
        .profile-stat-value { font-size: 1.35rem; font-weight: 600; letter-spacing: -0.02em; }
        .profile-stat-label {
          margin-top: 4px;
          font-size: 0.75rem;
          color: var(--ink-muted);
        }

        .ach-card {
          display: flex;
          gap: 14px;
          padding: 18px;
        }
        .ach-card--locked { background: var(--surface-2); }
        .ach-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .ach-card--locked .ach-icon { color: var(--ink-faint); }
        .ach-body { flex: 1; min-width: 0; }
        .ach-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .ach-title { font-size: 0.875rem; font-weight: 550; }
        .ach-rarity { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); flex-shrink: 0; }
        .ach-desc { margin-top: 4px; font-size: 0.8rem; color: var(--ink-muted); line-height: 1.5; }

        @media (max-width: 640px) {
          .profile-head { flex-direction: column; gap: 16px; padding: 22px; }
          .grid-stats { grid-template-columns: repeat(2, 1fr); }
          .profile-stat:nth-child(2) { border-right: none; }
          .profile-stat:nth-child(1), .profile-stat:nth-child(2) { border-bottom: 1px solid var(--border); }
        }
      `}</style>
    </div>
  );
}
