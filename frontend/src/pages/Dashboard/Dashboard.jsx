import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Coins,
  Flame,
  Hash,
  KeyRound,
  Code2,
  Puzzle,
  Swords,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRankFromRating } from '../../utils/rankUtils';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';
import api from '../../utils/api';

const SLUG_ICONS = {
  'dsa-master-quiz': Code2,
  'logic-puzzle': Puzzle,
  'number-detective': Hash,
  'code-breaker': KeyRound,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [gamesRes, dailyRes] = await Promise.all([api.get('/api/games'), api.get('/api/games/daily')]);
        setGames(gamesRes.data);
        setDaily(dailyRes.data);
      } catch (e) {
        console.warn('Failed to load games/daily from API, falling back to mock data', e);
        const { mockGames, mockDailyChallenge } = await import('../../data/mockGames');
        setGames(mockGames);
        setDaily(mockDailyChallenge);
      }
    };
    fetchDashboardData();
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => getDailyCountdown().formatted);
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getDailyCountdown().formatted), 1000);
    const unsubscribe = subscribeToMidnightIST(() => {
      api.get('/api/games/daily').then((res) => setDaily(res.data)).catch(() => {});
    });
    return () => { clearInterval(interval); unsubscribe(); };
  }, []);

  if (!user) return null;

  const rating = user.competitiveRating || 500;
  const compRank = getRankFromRating(rating);

  return (
    <div className="page">
      <div className="container stack">
        {/* ── Greeting ─────────────────────────────── */}
        <header className="dash-greeting">
          <div>
            <h1 className="page-title">{greeting()}, {user.username}</h1>
            <p className="page-lede">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {daily ? ' · a new daily mission is live.' : ' · pick an arena and play.'}
            </p>
          </div>
          <div className="dash-greeting-actions">
            <Link to="/daily-challenge" className="btn btn--primary">
              Daily challenge
            </Link>
            <Link to="/games" className="btn btn--secondary">
              Browse arena
            </Link>
          </div>
        </header>

        {/* ── Quiet stats strip ────────────────────── */}
        <div className="grid-stats" role="list" aria-label="Your stats">
          {[
            { Icon: Flame, label: 'Streak', value: `${user.currentStreak || 0}d` },
            { Icon: Coins, label: 'Coins', value: user.coins ?? 0 },
            { Icon: Swords, label: 'Rating', value: rating, hint: compRank.name },
            { Icon: Trophy, label: 'Games completed', value: user.gamesCompleted || 0 },
          ].map(({ Icon, label, value, hint }) => (
            <div key={label} className="dash-stat" role="listitem">
              <div className="dash-stat-label">
                <Icon size={13} />
                <span>{label}</span>
              </div>
              <div className="dash-stat-value num">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              <div className="dash-stat-hint mono">{hint || '\u00A0'}</div>
            </div>
          ))}
        </div>

        {/* ── Today's mission ──────────────────────── */}
        <section className="card dash-mission">
          <div className="dash-mission-body">
            <span className="zine-kicker">Today's mission</span>
            <h2 className="dash-mission-title">{daily?.title || 'The Arithmetic Equipment Puzzle'}</h2>
            <p className="muted dash-mission-desc">
              {daily?.description || 'A quick cognitive reflection test. One attempt per day — make it count.'}
            </p>
            <div className="dash-mission-meta">
              <span className="badge">+{daily?.xpReward || 100} XP</span>
              <span className="badge">+{daily?.coinReward || 50} coins</span>
              {daily?.difficulty && <span className="badge">{daily.difficulty}</span>}
            </div>
          </div>
          <div className="dash-mission-side">
            <div className="dash-mission-timer">
              <div className="dash-mission-timer-label">Resets in</div>
              <div className="dash-mission-timer-value num">{timeLeft}</div>
            </div>
            <button className="btn btn--primary" onClick={() => navigate('/daily-challenge')}>
              Start mission <ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* ── Arena ────────────────────────────────── */}
        <section>
          <div className="section-head">
            <h2 className="section-title">Arena</h2>
            <Link to="/games" className="dash-view-all">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          <div className="card dash-games">
            {games.length === 0 ? (
              <div className="dash-games-empty muted">No arenas available right now.</div>
            ) : (
              games.slice(0, 4).map(game => {
                const Icon = SLUG_ICONS[game.slug] || Puzzle;
                return (
                  <Link key={game.slug} to={`/games/${game.slug}`} className="dash-game-row">
                    <span className="dash-game-icon"><Icon size={16} /></span>
                    <span className="dash-game-main">
                      <span className="dash-game-title truncate">{game.title}</span>
                      <span className="dash-game-sub truncate">{game.category} · {game.estimatedTime || '3–5 min'}</span>
                    </span>
                    {game.difficulty && (
                      <span
                        className={`badge ${game.difficulty === 'EASY' ? 'badge--success' : game.difficulty === 'HARD' ? 'badge--danger' : 'badge--warn'}`}
                      >
                        {game.difficulty}
                      </span>
                    )}
                    <ChevronRight size={15} className="dash-game-arrow" />
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>

      <style>{`
        .dash-greeting {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          flex-wrap: wrap;
          padding-top: 12px;
          margin-bottom: 12px;
        }
        .dash-greeting-actions { display: flex; gap: 14px; flex-wrap: wrap; }

        .dash-stat { padding: 26px 34px; border-right: 1px solid var(--border); min-width: 0; }
        .dash-stat:last-child { border-right: none; }
        .dash-stat-label {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-muted);
        }
        .dash-stat-value {
          margin-top: 12px;
          font-family: var(--font-display);
          font-size: clamp(1.9rem, 2.7vw, 2.7rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          background: linear-gradient(180deg, #ffffff 20%, #9fb4d8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .dash-stat-hint {
          margin-top: 6px;
          font-size: 0.88rem;
          color: var(--ink-faint);
          min-height: 1em;
        }

        .dash-mission {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 40px;
          padding: 40px 42px;
          border-radius: 20px;
          flex-wrap: wrap;
        }
        .dash-mission-body { flex: 1 1 420px; min-width: 0; }
        .dash-mission-title {
          font-size: clamp(1.7rem, 2.4vw, 2.3rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          margin-top: 14px;
        }
        .dash-mission-desc {
          font-size: 1.12rem;
          margin-top: 10px;
          max-width: 68ch;
          line-height: 1.6;
          color: var(--ink-soft);
        }
        .dash-mission-meta { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
        .dash-mission-side {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: space-between;
          gap: 24px;
          min-width: 220px;
        }
        .dash-mission-timer { text-align: right; }
        .dash-mission-timer-label {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-muted);
        }
        .dash-mission-timer-value {
          margin-top: 8px;
          font-size: clamp(2rem, 2.8vw, 2.7rem);
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .dash-view-all {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 1rem;
          font-weight: 550;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .dash-view-all:hover { color: var(--accent); }

        .dash-games { overflow: hidden; border-radius: 20px; }
        .dash-games-empty { padding: 40px; font-size: 1.05rem; }
        .dash-game-row {
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 24px 32px;
          border-bottom: 1px solid var(--border);
          text-decoration: none;
          color: var(--ink);
          transition: background 0.15s ease;
        }
        .dash-game-row:last-child { border-bottom: none; }
        .dash-game-row:hover { background: rgba(91, 140, 255, 0.07); }
        .dash-game-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(91, 140, 255, 0.12);
          border: 1px solid rgba(91, 140, 255, 0.28);
          color: #8fb2ff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dash-game-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
        .dash-game-title { font-size: 1.2rem; font-weight: 650; }
        .dash-game-sub { font-size: 0.98rem; color: var(--ink-muted); }
        .dash-game-arrow { color: var(--ink-faint); flex-shrink: 0; }
        .dash-game-row:hover .dash-game-arrow { color: var(--ink-soft); }

        @media (max-width: 720px) {
          .grid-stats { grid-template-columns: repeat(2, 1fr); }
          .dash-stat:nth-child(2) { border-right: none; }
          .dash-stat:nth-child(1), .dash-stat:nth-child(2) { border-bottom: 1px solid var(--border); }
          .dash-mission-side { min-width: 100%; }
          .dash-mission-timer { text-align: left; }
          .dash-mission-side .btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}
