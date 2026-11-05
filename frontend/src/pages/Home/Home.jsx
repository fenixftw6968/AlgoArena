import { Link } from 'react-router-dom';
import { ArrowRight, Brain, ChevronRight, Hash, KeyRound, Puzzle, Swords } from 'lucide-react';

const ARENAS = [
  {
    slug: 'dsa-master-quiz',
    title: 'DSA Master',
    category: 'Algorithms & Structures',
    Icon: Brain,
    tier: 'Hard',
    desc: 'Complexity analysis, memory models, dynamic programming, and execution traces.',
  },
  {
    slug: 'logic-puzzle',
    title: 'Logic Puzzle',
    category: 'Analytical Deduction',
    Icon: Puzzle,
    tier: 'Medium',
    desc: 'Constraint satisfaction grids, formal deduction, and truth valuations.',
  },
  {
    slug: 'number-detective',
    title: 'Number Detective',
    category: 'Mathematical Patterns',
    Icon: Hash,
    tier: 'Medium',
    desc: 'Recurrence sequences, modular invariants, and numerical relationships.',
  },
  {
    slug: 'code-breaker',
    title: 'Code Breaker',
    category: 'Ciphers & Combinatorics',
    Icon: KeyRound,
    tier: 'Medium',
    desc: 'Positional entropy, state elimination, and combinatorial decryption.',
  },
];

const METRICS = [
  { label: 'Arenas', val: '4', sub: 'Specialized disciplines' },
  { label: 'Matchmaking', val: '1v1', sub: 'Ranked ladder' },
  { label: 'Problem bank', val: '150+', sub: 'Verified puzzles' },
  { label: 'Latency', val: '<50ms', sub: 'Real-time telemetry' },
];

export default function Home() {
  return (
    <div className="home-viewport">
      <main className="home-stage">
        {/* Hero copy */}
        <section className="home-hero">
          <h1 className="home-headline">
            Algorithmic mastery.<br />
            <span className="home-headline-gold">Measured in real time.</span>
          </h1>

          <div className="home-actions">
            <Link to="/signup" className="btn btn--primary home-btn">
              <span>Create account</span>
              <ArrowRight size={15} />
            </Link>
            <Link to="/games" className="btn btn--secondary home-btn">
              <span>Explore arenas</span>
            </Link>
            <span className="home-signin-hint">
              Already registered? <Link to="/login" className="home-signin-link">Sign in →</Link>
            </span>
          </div>
        </section>

        {/* Metrics Row */}
        <section className="home-metrics-card">
          {METRICS.map((m) => (
            <div key={m.label} className="home-metric-col">
              <div className="home-metric-val mono">{m.val}</div>
              <div className="home-metric-label">{m.label}</div>
              <div className="home-metric-sub">{m.sub}</div>
            </div>
          ))}
        </section>

        {/* Arenas Grid */}
        <section className="home-arenas-section">
          <div className="home-section-header">
            <div>
              <h2 className="home-section-title">Competitive disciplines</h2>
            </div>
            <Link to="/games" className="home-section-link">
              View all arenas <ChevronRight size={14} />
            </Link>
          </div>

          <div className="home-arenas-grid">
            {ARENAS.map(({ slug, title, category, Icon, tier }) => (
              <Link key={slug} to={`/games/${slug}`} className="home-arena-card">
                <div className="home-arena-card-top">
                  <span className="home-arena-card-icon"><Icon size={18} /></span>
                  <span className="badge badge-medium">{tier}</span>
                </div>
                <div className="home-arena-card-title">{title}</div>
                <div className="home-arena-card-foot">
                  <span className="home-arena-card-cat mono">{category}</span>
                  <ChevronRight size={14} className="home-arena-arrow" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Live Showdown Strip */}
        <section className="home-duel-banner">
          <div className="home-duel-content">
            <span className="home-duel-icon"><Swords size={18} /></span>
            <div>
              <div className="home-duel-heading">Synchronous 1v1 Matches</div>
              <div className="home-duel-sub">Queue live against peers with automated rating adjustments.</div>
            </div>
          </div>
          <Link to="/games" className="btn btn--primary btn--sm">
            Find match <ArrowRight size={14} />
          </Link>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="home-footer-name">AlgoArena</span>
          </div>
          <div className="home-footer-links">
            <Link to="/daily-challenge" className="home-footer-link">Daily Challenge</Link>
            <Link to="/games" className="home-footer-link">Arenas</Link>
            <Link to="/leaderboard" className="home-footer-link">Leaderboard</Link>
            <span className="home-footer-copy mono">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      <style>{`
        .home-viewport {
          min-height: 100vh;
          padding-top: 52px;
          display: flex;
          flex-direction: column;
        }

        .home-stage {
          flex: 1;
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
          padding: clamp(48px, 8vh, 80px) clamp(20px, 4vw, 32px) 64px;
          display: flex;
          flex-direction: column;
          gap: clamp(40px, 6vh, 64px);
        }

        .home-hero {
          max-width: 780px;
        }

        .home-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--ink-soft);
          margin-bottom: 20px;
        }

        .home-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
        }

        .home-headline {
          font-size: clamp(2.5rem, 5vw, 3.75rem);
          font-weight: 650;
          letter-spacing: -0.04em;
          line-height: 1.1;
          color: var(--ink);
          margin: 0;
        }

        .home-headline-gold {
          color: var(--accent);
        }

        .home-subtext {
          margin-top: 16px;
          font-size: clamp(1rem, 1.3vw, 1.125rem);
          color: var(--ink-muted);
          line-height: 1.6;
          max-width: 60ch;
        }

        .home-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .home-btn {
          height: 40px;
          padding: 0 18px;
          font-size: 0.875rem;
        }

        .home-signin-hint {
          font-size: 0.8125rem;
          color: var(--ink-muted);
          margin-left: 8px;
        }

        .home-signin-link {
          color: var(--accent);
          font-weight: 550;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .home-metrics-card {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-xs);
          overflow: hidden;
        }

        .home-metric-col {
          padding: 20px;
          border-right: 1px solid var(--border);
        }

        .home-metric-col:last-child {
          border-right: none;
        }

        .home-metric-val {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--accent);
          letter-spacing: -0.02em;
        }

        .home-metric-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: 4px;
        }

        .home-metric-sub {
          font-size: 0.75rem;
          color: var(--ink-muted);
          margin-top: 2px;
        }

        .home-arenas-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .home-section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .home-section-title {
          font-size: 1.25rem;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .home-section-sub {
          font-size: 0.84375rem;
          color: var(--ink-muted);
          margin-top: 4px;
        }

        .home-section-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8125rem;
          font-weight: 550;
          color: var(--accent);
        }

        .home-arenas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }

        .home-arena-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px;
          box-shadow: var(--shadow-xs);
          display: flex;
          flex-direction: column;
          text-decoration: none;
          color: var(--ink);
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .home-arena-card:hover {
          border-color: rgba(197, 244, 103, 0.45);
          background: #171B14;
          box-shadow: 0 4px 20px -4px rgba(197, 244, 103, 0.12);
        }

        .home-arena-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .home-arena-card-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: rgba(197, 244, 103, 0.12);
          border: 1px solid rgba(197, 244, 103, 0.25);
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .home-arena-card:hover .home-arena-card-icon {
          background: var(--accent);
          border-color: var(--accent);
          color: #0b0b0b;
        }

        .home-arena-card-title {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--ink);
        }

        .home-arena-card-desc {
          margin-top: 6px;
          font-size: 0.8125rem;
          color: var(--ink-muted);
          line-height: 1.5;
          flex: 1;
        }

        .home-arena-card-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .home-arena-card-cat {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .home-arena-arrow {
          color: var(--ink-faint);
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .home-arena-card:hover .home-arena-arrow {
          color: var(--accent);
          transform: translateX(2px);
        }

        .home-duel-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 18px 22px;
          box-shadow: var(--shadow-xs);
          flex-wrap: wrap;
        }

        .home-duel-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .home-duel-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: var(--surface-3);
          border: 1px solid var(--border);
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .home-duel-heading {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink);
        }

        .home-duel-sub {
          font-size: 0.8125rem;
          color: var(--ink-muted);
          margin-top: 2px;
        }

        .home-footer {
          border-top: 1px solid var(--border);
          background: var(--surface);
          padding: 24px clamp(20px, 4vw, 32px);
        }

        .home-footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .home-footer-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--ink);
          margin-right: 12px;
        }

        .home-footer-desc {
          font-size: 0.8125rem;
          color: var(--ink-muted);
        }

        .home-footer-links {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .home-footer-link {
          font-size: 0.8125rem;
          color: var(--ink-muted);
          transition: color 0.12s ease;
        }

        .home-footer-link:hover {
          color: var(--accent);
        }

        .home-footer-copy {
          font-size: 0.75rem;
          color: var(--ink-faint);
        }

        @media (max-width: 768px) {
          .home-metrics-card {
            grid-template-columns: repeat(2, 1fr);
          }
          .home-metric-col:nth-child(2) {
            border-right: none;
          }
          .home-metric-col:nth-child(-n+2) {
            border-bottom: 1px solid var(--border);
          }
        }
      `}</style>
    </div>
  );
}
