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
  Clock,
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
        {/* ── Greeting Bar ─────────────────────────── */}
        <header className="dash-greeting">
          <div>
            <h1 className="page-title">{greeting()}, {user.username}</h1>
            <p className="page-lede">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {daily ? ' · Today’s classified challenge is active.' : ' · Choose an arena to compete.'}
            </p>
          </div>
          <div className="dash-greeting-actions">
            <Link to="/daily-challenge" className="btn btn--primary btn--sm">
              Daily challenge
            </Link>
            <Link to="/games" className="btn btn--secondary btn--sm">
              Arenas
            </Link>
          </div>
        </header>

        {/* ── Cinematic Metric Strip ── */}
        <div className="grid-stats" role="list" aria-label="Player overview">
          {[
            { Icon: Flame, label: 'Streak', value: `${user.currentStreak || 0}d` },
            { Icon: Coins, label: 'Coins', value: user.coins ?? 0 },
            { Icon: Swords, label: 'Rating', value: rating, hint: compRank.name },
            { Icon: Trophy, label: 'Completed', value: user.gamesCompleted || 0 },
          ].map(({ Icon, label, value, hint }) => (
            <div key={label} className="dash-stat-item" role="listitem">
              <span className="dash-stat-label">{label}</span>
              <div className="dash-stat-val mono">
                <span>{value}</span>
                {hint && <span className="badge badge-medium" style={{ fontSize: '0.625rem' }}>{hint}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Daily Challenge Highlight Banner ─────── */}
        {daily && (
          <section className="dash-daily-banner">
            <div className="dash-daily-left">
              <div className="dash-daily-kicker">
                <span className="zine-kicker">Daily Mission</span>
                <span className="dash-daily-timer mono">
                  <Clock size={12} /> {timeLeft}
                </span>
              </div>
              <h2 className="dash-daily-title">{daily.title || 'Daily Algorithmic Assessment'}</h2>
              <p className="dash-daily-desc">
                {daily.question?.slice(0, 140) || 'Test your problem solving against today’s community puzzle.'}…
              </p>
            </div>
            <div className="dash-daily-actions">
              <Link to="/daily-challenge" className="btn btn--primary btn--sm">
                <span>{daily.attempted ? 'Review solution' : 'Solve mission'}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}

        {/* ── Available Arenas ─────────────────────── */}
        <section>
          <div className="section-head">
            <div>
              <h2 className="section-title">Cognitive Arenas</h2>
              <p className="muted" style={{ fontSize: '0.8125rem' }}>Select a track to practice solo or match 1v1.</p>
            </div>
            <Link to="/games" className="home-section-link">
              All arenas <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid-cards">
            {games.map((g, i) => {
              const Icon = SLUG_ICONS[g.slug] || Code2;
              return (
                <Link key={g.slug || i} to={`/games/${g.slug}`} className="game-card">
                  <div className="game-card-top">
                    <span className="game-card-icon"><Icon size={16} /></span>
                    <span className="game-card-category mono">{g.category}</span>
                  </div>
                  <h3 className="game-card-title">{g.title}</h3>
                  <div className="game-card-bottom">
                    <span className="badge badge--success">{g.difficulty || 'Medium'}</span>
                    <span className="game-card-arrow"><ChevronRight size={15} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <style>{`
        .dash-daily-banner {
          background: var(--accent);
          border: 3px solid #0A0A0A;
          border-radius: var(--radius);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 6px 6px 0px #0A0A0A;
        }

        .dash-daily-left {
          flex: 1;
          min-width: 260px;
        }

        .dash-daily-kicker {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }

        .dash-daily-kicker .zine-kicker {
          background: #0A0A0A;
          color: var(--accent);
          box-shadow: none;
        }

        .dash-daily-timer {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #0A0A0A;
        }

        .dash-daily-title {
          font-size: 1.125rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0A0A0A;
          text-transform: uppercase;
        }

        .dash-daily-desc {
          margin-top: 4px;
          font-size: 0.84375rem;
          color: #1C1C1A;
          line-height: 1.5;
          max-width: 68ch;
          font-weight: 600;
        }

        .dash-daily-actions {
          flex-shrink: 0;
        }

        .dash-daily-actions .btn--primary {
          background: #0A0A0A;
          color: var(--accent);
          box-shadow: 3px 3px 0px #FFFFFF;
        }

        .dash-daily-actions .btn--primary:hover:not(:disabled) {
          background: #0A0A0A;
          color: var(--accent-hover);
          box-shadow: 5px 5px 0px #FFFFFF;
        }
      `}</style>
    </div>
  );
}
