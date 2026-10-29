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
            <div style={{ marginTop: 24, maxWidth: 820 }}>
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
          align-items: center;
          gap: 36px;
          padding: clamp(32px, 4vh, 48px);
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 100% at 0% 0%, rgba(91, 140, 255, 0.14), transparent 65%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
            var(--surface);
        }
        .profile-head-main { flex: 1; min-width: 0; }
        .profile-name { font-size: clamp(2.4rem, 3.5vw, 3.2rem); font-weight: 700; letter-spacing: -0.03em; color: var(--ink); }
        .profile-meta { margin-top: 8px; font-size: 1.05rem; color: var(--ink-muted); }

        .profile-stat { padding: 28px 36px; border-right: 1px solid var(--border); }
        .profile-stat:last-child { border-right: none; }
        .profile-stat-value {
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 3vw, 2.9rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          background: linear-gradient(180deg, #ffffff 20%, #9fb4d8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .profile-stat-label {
          margin-top: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink-soft);
        }

        .ach-card {
          display: flex;
          gap: 22px;
          padding: 26px 30px;
          border-radius: 16px;
        }
        .ach-card--locked { background: var(--surface-2); }
        .ach-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          flex-shrink: 0;
        }
        .ach-card--locked .ach-icon { color: var(--ink-faint); }
        .ach-body { flex: 1; min-width: 0; }
        .ach-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .ach-title { font-size: 1.18rem; font-weight: 650; }
        .ach-rarity { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); flex-shrink: 0; }
        .ach-desc { margin-top: 8px; font-size: 1rem; color: var(--ink-muted); line-height: 1.6; }

        @media (max-width: 640px) {
          .profile-head { flex-direction: column; gap: 18px; padding: 24px; }
          .grid-stats { grid-template-columns: repeat(2, 1fr); }
          .profile-stat:nth-child(2) { border-right: none; }
          .profile-stat:nth-child(1), .profile-stat:nth-child(2) { border-bottom: 1px solid var(--border); }
        }
      `}</style>
    </div>
  );
}
