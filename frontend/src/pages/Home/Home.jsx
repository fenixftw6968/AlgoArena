import { Link } from 'react-router-dom';
import { ArrowRight, Swords, ChevronRight } from 'lucide-react';

const ARENAS = [
  {
    slug: 'dsa-master-quiz',
    title: 'DSA Master Quiz',
    category: 'Algorithms & Coding',
    icon: '🧠',
    tier: 'Hard',
    desc: 'Complexity analysis, graphs, dynamic programming & code outputs.',
    color: '#2563eb',
  },
  {
    slug: 'logic-puzzle',
    title: 'Logic Puzzle',
    category: 'Analytical Reasoning',
    icon: '🧩',
    tier: 'Medium',
    desc: 'Multi-step deduction grids, syllogisms & boolean logic statements.',
    color: '#0284c7',
  },
  {
    slug: 'number-detective',
    title: 'Number Detective',
    category: 'Mathematical Patterns',
    icon: '🔢',
    tier: 'Medium',
    desc: 'Non-linear sequences, Fibonacci variants & number relationships.',
    color: '#059669',
  },
  {
    slug: 'code-breaker',
    title: 'Code Breaker',
    category: 'Ciphers & Deduction',
    icon: '🔐',
    tier: 'Medium',
    desc: 'Positional entropy, constraint elimination & secret code decryption.',
    color: '#7c3aed',
  },
];

const METRICS = [
  { label: 'Arenas', val: '4', sub: 'Multi-Tiered' },
  { label: 'Duels', val: '1v1', sub: 'Live Elo Ladder' },
  { label: 'Challenges', val: '150+', sub: 'Curated Puzzles' },
  { label: 'Rankings', val: 'Global', sub: 'Real-Time Sync' },
];

export default function Home() {
  return (
    <div className="home-viewport">
      <main className="home-stage">
        {/* Left Column: Hero & Actions */}
        <section className="home-left">
          <div className="home-left-content">
            {/* Badge */}
            <div className="home-badge">
              <span className="home-badge-logo">
                <img src="/logo-icon.png" alt="AlgoArena Logo" />
              </span>
              <span className="home-badge-text">Competitive Algorithms & Logic Arenas</span>
              <span className="home-badge-pulse" />
            </div>

            {/* Headline */}
            <h1 className="home-headline">
              Master algorithms.<br />
              <span className="home-headline-accent">Conquer puzzles.</span>
            </h1>

            {/* Description */}
            <p className="home-subtext">
              Sharpen your analytical problem-solving with curated algorithmic duels,
              logic grids, and positional ciphers. Compete in real-time 1v1 ranked matches
              and scale the global Elo ladder.
            </p>

            {/* Action Buttons */}
            <div className="home-actions">
              <Link to="/signup" className="btn btn--primary home-action-primary">
                <span>Create free account</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/games" className="btn btn--secondary home-action-secondary">
                <span>Browse arenas</span>
              </Link>
              <Link to="/login" className="home-action-text">
                Already registered? <span className="home-action-text-bold">Sign in →</span>
              </Link>
            </div>

            {/* Metrics Ribbon */}
            <div className="home-metrics-row">
              {METRICS.map((m) => (
                <div key={m.label} className="home-metric-item">
                  <div className="home-metric-val">{m.val}</div>
                  <div className="home-metric-label">{m.label}</div>
                  <div className="home-metric-sub">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Arena Hub & Logo Showcase */}
        <section className="home-right">
          <div className="home-hub-card">
            {/* Logo showcase header */}
            <div className="home-hub-header">
              <div className="home-hub-brand-showcase">
                <img
                  src="/logo-full.png"
                  alt="AlgoArena"
                  className="home-hub-logo-img"
                />
              </div>
              <div className="home-hub-status">
                <span className="home-status-indicator" />
                <span className="home-status-title">LIVE ARENA MATCHMAKING</span>
              </div>
            </div>

            {/* 4 Arenas Grid */}
            <div className="home-arenas-grid">
              {ARENAS.map((arena) => (
                <Link
                  key={arena.slug}
                  to="/games"
                  className="home-arena-tile"
                >
                  <div className="home-arena-top">
                    <span className="home-arena-icon">{arena.icon}</span>
                    <span className="home-arena-tier">{arena.tier}</span>
                  </div>
                  <div className="home-arena-title">{arena.title}</div>
                  <div className="home-arena-desc">{arena.desc}</div>
                  <div className="home-arena-footer">
                    <span className="home-arena-category">{arena.category}</span>
                    <span className="home-arena-arrow">
                      <ChevronRight size={16} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* 1v1 Live Ranked Strip */}
            <div className="home-duel-strip">
              <div className="home-duel-left">
                <Swords size={20} className="home-duel-icon" />
                <span>
                  <strong>1v1 Ranked Duels</strong> · Instant matchmaking with live turn-by-turn scoring
                </span>
              </div>
              <Link to="/games" className="home-duel-link">
                Play now →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Hairline Bottom Status Footer */}
      <footer className="home-single-footer">
        <div className="home-footer-side">
          <span className="home-footer-brand">AlgoArena</span>
          <span className="home-footer-dot">·</span>
          <span>Competitive algorithms, logic puzzles & Elo duels</span>
        </div>
        <div className="home-footer-nav">
          <Link to="/daily-challenge" className="home-footer-link">Daily Challenge</Link>
          <span className="home-footer-dot">·</span>
          <Link to="/leaderboard" className="home-footer-link">Leaderboard</Link>
          <span className="home-footer-dot">·</span>
          <Link to="/games" className="home-footer-link">Arenas</Link>
          <span className="home-footer-dot">·</span>
          <span className="home-footer-copy">© {new Date().getFullYear()} AlgoArena</span>
        </div>
      </footer>

      <style>{`
        /* Viewport root pinned to exact screen height */
        .home-viewport {
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          bottom: 0;
          height: calc(100vh - 64px);
          max-height: calc(100vh - 64px);
          background: var(--bg);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          box-sizing: border-box;
        }

        /* Expansive main stage that gracefully fits the screen */
        .home-stage {
          flex: 1;
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: clamp(36px, 5vw, 84px);
          max-width: min(96vw, 1840px);
          width: 100%;
          margin: 0 auto;
          padding: clamp(16px, 3vh, 48px) clamp(32px, 5vw, 88px);
          align-items: center;
          min-height: 0;
          box-sizing: border-box;
        }

        /* Left column */
        .home-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 0;
        }

        .home-left-content {
          max-width: 860px;
          width: 100%;
        }

        /* Badge pill */
        .home-badge {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 8px 20px 8px 10px;
          border-radius: 9999px;
          font-size: clamp(0.92rem, 1.05vw, 1.02rem);
          color: var(--ink-soft);
          font-weight: 550;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          margin-bottom: clamp(14px, 2.2vh, 24px);
        }

        .home-badge-logo {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: #0a0d14;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .home-badge-logo img {
          width: 18px;
          height: 18px;
          object-fit: contain;
        }

        .home-badge-text {
          letter-spacing: 0.01em;
        }

        .home-badge-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          animation: pulseGreen 2s infinite ease-in-out;
        }

        @keyframes pulseGreen {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        /* Headline: commanding, large, and modern */
        .home-headline {
          font-size: clamp(3.2rem, 5vw, 5rem);
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 1.06;
          color: var(--ink);
          margin: 0;
        }

        .home-headline-accent {
          color: #2563eb;
          display: block;
        }

        /* Subtext */
        .home-subtext {
          margin-top: clamp(16px, 2.4vh, 26px);
          font-size: clamp(1.15rem, 1.45vw, 1.35rem);
          color: var(--ink-muted);
          line-height: 1.65;
          max-width: 58ch;
        }

        /* Action buttons */
        .home-actions {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: clamp(20px, 3.2vh, 36px);
        }

        .home-action-primary {
          height: clamp(52px, 6.5vh, 62px);
          padding: 0 34px;
          font-size: clamp(1.05rem, 1.2vw, 1.18rem);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #18181b;
          color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .home-action-primary:hover {
          background: #09090b;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        }

        .home-action-secondary {
          height: clamp(52px, 6.5vh, 62px);
          padding: 0 30px;
          font-size: clamp(1.05rem, 1.2vw, 1.18rem);
          font-weight: 550;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          color: var(--ink);
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .home-action-secondary:hover {
          background: var(--surface-2);
          border-color: var(--ink);
        }

        .home-action-text {
          font-size: 1.05rem;
          color: var(--ink-muted);
          text-decoration: none;
          margin-left: 8px;
        }

        .home-action-text-bold {
          color: var(--ink);
          font-weight: 600;
        }

        .home-action-text:hover .home-action-text-bold {
          color: #2563eb;
        }

        /* Metrics row */
        .home-metrics-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: clamp(14px, 2.2vw, 28px);
          margin-top: clamp(22px, 3.4vh, 40px);
          padding-top: clamp(18px, 2.6vh, 30px);
          border-top: 1px solid var(--border);
          max-width: 720px;
        }

        .home-metric-item {
          display: flex;
          flex-direction: column;
        }

        .home-metric-val {
          font-family: var(--font-mono, monospace);
          font-size: clamp(1.8rem, 2.8vw, 2.6rem);
          font-weight: 750;
          color: var(--ink);
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .home-metric-label {
          font-size: 0.94rem;
          font-weight: 600;
          color: var(--ink-soft);
          margin-top: 4px;
        }

        .home-metric-sub {
          font-size: 0.84rem;
          color: var(--ink-muted);
        }

        /* Right column: Hub card */
        .home-right {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          height: 100%;
        }

        .home-hub-card {
          width: 100%;
          max-width: 820px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: clamp(22px, 3.2vh, 34px);
          box-shadow: 0 10px 36px -4px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2.2vh, 22px);
          box-sizing: border-box;
        }

        /* Logo showcase header */
        .home-hub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: clamp(14px, 2vh, 20px);
          border-bottom: 1px solid var(--border);
        }

        .home-hub-brand-showcase {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .home-hub-logo-img {
          height: clamp(54px, 7.5vh, 74px);
          width: auto;
          object-fit: contain;
          background: #0a0d14;
          padding: 10px 22px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .home-hub-status {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: var(--font-mono, monospace);
          font-size: 0.86rem;
          font-weight: 650;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.18);
          padding: 7px 16px;
          border-radius: 9999px;
          letter-spacing: 0.04em;
        }

        .home-status-indicator {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #2563eb;
          box-shadow: 0 0 8px #2563eb;
        }

        /* 4 Arenas Grid */
        .home-arenas-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: clamp(12px, 2vh, 18px);
        }

        .home-arena-tile {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: clamp(18px, 2.4vh, 22px);
          text-decoration: none;
          color: inherit;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .home-arena-tile:hover {
          background: #ffffff;
          border-color: #2563eb;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.14);
        }

        .home-arena-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .home-arena-icon {
          font-size: clamp(1.8rem, 2.4vh, 2.3rem);
          line-height: 1;
        }

        .home-arena-tier {
          font-size: 0.78rem;
          font-weight: 650;
          font-family: var(--font-mono, monospace);
          text-transform: uppercase;
          color: var(--ink-muted);
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 4px 10px;
          border-radius: 6px;
        }

        .home-arena-title {
          font-size: clamp(1.12rem, 1.35vw, 1.28rem);
          font-weight: 650;
          color: var(--ink);
          margin-top: 12px;
          letter-spacing: -0.015em;
        }

        .home-arena-desc {
          font-size: clamp(0.88rem, 1vw, 0.98rem);
          color: var(--ink-muted);
          line-height: 1.5;
          margin-top: 5px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .home-arena-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px dashed var(--border);
        }

        .home-arena-category {
          font-size: 0.84rem;
          color: var(--ink-soft);
          font-weight: 550;
        }

        .home-arena-arrow {
          color: var(--ink-faint);
          display: flex;
          align-items: center;
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .home-arena-tile:hover .home-arena-arrow {
          color: #2563eb;
          transform: translateX(3px);
        }

        /* 1v1 Live Duel strip */
        .home-duel-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.07), rgba(37, 99, 235, 0.02));
          border: 1px solid rgba(37, 99, 235, 0.22);
          border-radius: 12px;
          padding: clamp(14px, 2vh, 18px) 22px;
          font-size: clamp(0.92rem, 1.05vw, 1.02rem);
          color: var(--ink-soft);
        }

        .home-duel-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .home-duel-icon {
          color: #2563eb;
          flex-shrink: 0;
        }

        .home-duel-link {
          font-weight: 650;
          color: #2563eb;
          text-decoration: none;
          font-size: 0.98rem;
          white-space: nowrap;
          transition: transform 0.15s ease;
        }

        .home-duel-link:hover {
          text-decoration: underline;
        }

        /* Hairline compact footer */
        .home-single-footer {
          height: 44px;
          min-height: 44px;
          border-top: 1px solid var(--border);
          background: var(--surface);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(24px, 4vw, 64px);
          font-size: 0.82rem;
          color: var(--ink-muted);
          box-sizing: border-box;
          z-index: 10;
        }

        .home-footer-side {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .home-footer-brand {
          font-weight: 650;
          color: var(--ink);
        }

        .home-footer-dot {
          color: var(--ink-faint);
        }

        .home-footer-nav {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .home-footer-link {
          color: var(--ink-muted);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .home-footer-link:hover {
          color: var(--ink);
        }

        .home-footer-copy {
          color: var(--ink-faint);
        }

        /* Responsive breakpoints */
        @media (max-width: 1080px) {
          .home-viewport {
            position: relative;
            top: 0;
            height: auto;
            max-height: none;
            overflow-y: auto;
            padding-top: 76px;
          }
          .home-stage {
            grid-template-columns: 1fr;
            padding: 24px 20px;
          }
          .home-hub-card {
            max-width: 100%;
          }
          .home-single-footer {
            flex-direction: column;
            height: auto;
            padding: 16px 20px;
            gap: 8px;
            text-align: center;
          }
          .home-footer-nav {
            flex-wrap: wrap;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
