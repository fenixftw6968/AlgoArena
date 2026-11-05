import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import XPBar from '../../components/XPBar/XPBar';
import RankCard from '../../components/RankCard/RankCard';
import { getXPForNextLevel, getXPForCurrentLevel } from '../../data/mockUser';
import { Lock, Bell, BellCheck, Download } from 'lucide-react';
import api from '../../utils/api';
import { subscribeUserToPush, isPushNotificationSupported } from '../../services/pushNotificationService';

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
  const xpCurrent = (user.xp || 0) - getXPForCurrentLevel(user.level || 1);
  const xpNext    = getXPForNextLevel(user.level || 1) - getXPForCurrentLevel(user.level || 1);

  return (
    <div className="page">
      <div className="container stack">
        {/* Identity Head */}
        <section className="card profile-head">
          <span className="avatar avatar--lg">{user.username?.[0]?.toUpperCase()}</span>
          <div className="profile-head-main">
            <h1 className="profile-name">{user.username}</h1>
            <div className="profile-meta mono">
              Member since {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {' · '}Level {user.level || 1}
            </div>
            <div style={{ marginTop: 16, maxWidth: 640 }}>
              <XPBar current={Math.max(0, xpCurrent)} total={Math.max(1, xpNext)} level={user.level || 1} />
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid-stats" role="list" aria-label="Account stats">
          {[
            { label: 'Current streak', value: `${user.currentStreak || 0}d` },
            { label: 'Best streak',    value: `${user.longestStreak || 0}d` },
            { label: 'Available coins', value: user.coins ?? 0 },
            { label: 'Challenges finished', value: user.gamesCompleted || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="profile-stat" role="listitem">
              <span className="profile-stat-label">{label}</span>
              <div className="profile-stat-value mono">{value}</div>
            </div>
          ))}
        </div>

        {/* Ranked Career Card */}
        <RankCard
          rating={user.competitiveRating ?? 101}
          matchesPlayed={user.matchesPlayed || 0}
          matchesWon={user.matchesWon || 0}
        />

        {/* PWA & Notification Preferences */}
        <section className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 650, fontSize: '0.95rem', color: 'var(--ink)' }}>PWA Push Alerts</div>
            <div className="muted" style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
              Receive instant updates for tournaments, daily challenges, and friend invites.
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await subscribeUserToPush();
              if (res.success) {
                alert('Push notifications enabled for AlgoArena!');
              } else if (res.reason === 'permission_denied') {
                alert('Notification permission was blocked in browser settings.');
              }
            }}
            className="btn btn--secondary btn--sm"
          >
            <Bell size={14} style={{ color: 'var(--accent)' }} />
            <span>Enable Push Notifications</span>
          </button>
        </section>

        {/* Achievements Section */}
        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">Milestones & Achievements</h2>
              <p className="muted" style={{ fontSize: '0.8125rem' }}>Earn trophies through tournament victories and streak retention.</p>
            </div>
            <span className="mono faint" style={{ fontSize: '0.75rem' }}>
              {unlockedIds.size} / {achievements.length || 0} unlocked
            </span>
          </div>

          {loading ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <span className="zine-spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : achievements.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <p className="muted" style={{ fontSize: '0.8125rem' }}>No achievements recorded yet.</p>
            </div>
          ) : (
            <div className="profile-ach-grid">
              {achievements.map((a) => {
                const unlocked = unlockedIds.has(a.achievementKey);
                return (
                  <div
                    key={a.achievementKey}
                    className={`card profile-ach-card${unlocked ? '' : ' profile-ach-card--locked'}`}
                  >
                    <div className="profile-ach-top">
                      <span className="profile-ach-icon">
                        {unlocked ? (a.icon || '🏆') : <Lock size={14} />}
                      </span>
                      <span className="badge badge--success" style={{ fontSize: '0.625rem' }}>
                        {RARITY_LABEL[a.rarity] || 'Common'}
                      </span>
                    </div>
                    <div className="profile-ach-name">{a.title}</div>
                    <div className="profile-ach-desc">{a.description}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .profile-head {
          padding: 24px 28px;
          display: flex;
          align-items: center;
          gap: 20px;
          background: var(--surface);
        }

        .profile-head-main {
          flex: 1;
        }

        .profile-name {
          font-size: 1.35rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .profile-meta {
          font-size: 0.8125rem;
          color: var(--ink-muted);
          margin-top: 2px;
        }

        .profile-stat {
          display: flex;
          flex-direction: column;
          padding: 16px 20px;
          border-right: 1px solid var(--border);
        }

        .profile-stat:last-child {
          border-right: none;
        }

        .profile-stat-label {
          font-size: 0.75rem;
          color: var(--ink-muted);
          font-weight: 500;
        }

        .profile-stat-value {
          font-size: 1.35rem;
          font-weight: 600;
          color: var(--accent);
          margin-top: 2px;
        }

        .profile-ach-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }

        .profile-ach-card {
          padding: 16px;
          background: var(--surface);
          border-radius: var(--radius);
        }

        .profile-ach-card--locked {
          opacity: 0.4;
        }

        .profile-ach-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .profile-ach-icon {
          font-size: 1.1rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .profile-ach-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--ink);
        }

        .profile-ach-desc {
          margin-top: 4px;
          font-size: 0.78125rem;
          color: var(--ink-muted);
          line-height: 1.45;
        }
      `}</style>
    </div>
  );
}
