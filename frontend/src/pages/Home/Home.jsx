import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Swords, Trophy } from 'lucide-react';

const DISCIPLINES = [
  { title: 'DSA & Algorithms',  desc: 'Data structures, complexity analysis, graph traversals and code output questions.' },
  { title: 'Logical Reasoning', desc: 'Multi-step deduction grids, syllogisms, analogies and boolean condition puzzles.' },
  { title: 'Number Detective',  desc: 'Patterns in non-linear sequences, Fibonacci variants and exponential matrices.' },
  { title: 'Code Breaker',      desc: 'Deduce secret codes through positional logic, elimination and entropy clues.' },
];

const FEATURES = [
  {
    Icon: Swords,
    title: 'Live 1v1 duels',
    desc: 'Ranked matchmaking against real players, with bots as a fallback so you never wait.',
  },
  {
    Icon: Trophy,
    title: 'Competitive rating',
    desc: 'A balanced Elo ladder from Rookie to Mythic across every arena.',
  },
  {
    Icon: Brain,
    title: 'Four arenas',
    desc: 'Algorithms, logic, number patterns and ciphers — each with three difficulty tiers.',
  },
];

export default function Home() {
  return (
    <div className="home-root">
      <main>
        {/* Hero */}
        <section className="home-hero">
          <div className="home-hero-inner">
            <span className="badge">Daily challenges · Live duels · Global leaderboard</span>
            <h1 className="home-title">
              Master algorithms.<br />Conquer puzzles.
            </h1>
            <p className="home-lede">
              A quiet place to sharpen analytical thinking. Curated DSA challenges,
              logic grids and ciphers, with real-time 1v1 duels and an Elo ladder.
            </p>
            <div className="home-cta">
              <Link to="/signup" className="btn btn--primary home-btn-lg">
                Create free account <ArrowRight size={15} />
              </Link>
              <Link to="/games" className="btn btn--secondary home-btn-lg">
                Browse arenas
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="home-section">
          <div className="container--wide home-container">
            <h2 className="home-section-title">Everything you need to sharpen up</h2>
            <div className="home-features">
              {FEATURES.map(({ Icon, title, desc }) => (
                <div key={title} className="card home-feature">
                  <span className="home-feature-icon"><Icon size={17} /></span>
                  <h3 className="home-feature-title">{title}</h3>
                  <p className="home-feature-desc">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Disciplines */}
        <section className="home-section home-section--alt">
          <div className="container--wide home-container">
            <h2 className="home-section-title">Four disciplines, one ladder</h2>
            <p className="muted home-section-lede">
              Each arena targets a specific faculty. Play solo to practice, or ranked to climb.
            </p>
            <div className="home-disciplines">
              {DISCIPLINES.map((d, i) => (
                <Link key={d.title} to="/games" className="home-discipline">
                  <span className="home-discipline-num mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="home-discipline-body">
                    <span className="home-discipline-title">{d.title}</span>
                    <span className="home-discipline-desc">{d.desc}</span>
                  </span>
                  <ArrowRight size={15} className="home-discipline-arrow" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="home-section">
          <div className="container--narrow home-container">
            <div className="card home-final">
              <h2 className="home-final-title">Ready to test your limits?</h2>
              <p className="muted" style={{ marginTop: 8, fontSize: '0.9rem' }}>
                Free forever. Create an account and start with today's daily mission.
              </p>
              <div className="home-cta" style={{ justifyContent: 'center', marginTop: 24 }}>
                <Link to="/signup" className="btn btn--primary home-btn-lg">
                  Get started <ArrowRight size={15} />
                </Link>
                <Link to="/login" className="btn btn--secondary home-btn-lg">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="container--wide home-container home-footer-inner">
          <span className="home-footer-brand">AlgoArena</span>
          <span>© {new Date().getFullYear()} — Competitive algorithms, puzzles and duels.</span>
        </div>
      </footer>

      <style>{`
        .home-root { background: var(--bg); min-height: 100vh; }

        .home-hero {
          padding: 176px 24px 96px;
          border-bottom: 1px solid var(--border);
        }
        .home-hero-inner { max-width: 720px; margin: 0 auto; text-align: center; }
        .home-title {
          font-size: clamp(2.25rem, 6vw, 3.5rem);
          font-weight: 600;
          letter-spacing: -0.035em;
          line-height: 1.08;
          margin-top: 20px;
        }
        .home-lede {
          margin: 20px auto 0;
          max-width: 56ch;
          color: var(--ink-muted);
          font-size: 1.03rem;
          line-height: 1.65;
        }
        .home-cta {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 32px;
        }
        .home-btn-lg { height: 44px; padding: 0 22px; font-size: 0.9rem; }

        .home-section { padding: 88px 24px; }
        .home-section--alt { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .home-container { margin: 0 auto; }
        .home-section-title {
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 600;
          letter-spacing: -0.025em;
          max-width: 30ch;
        }
        .home-section-lede { margin-top: 10px; font-size: 0.92rem; max-width: 56ch; }

        .home-features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
          margin-top: 40px;
        }
        .home-feature { padding: 26px; }
        .home-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--ink-soft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .home-feature-title { font-size: 0.98rem; font-weight: 600; margin-top: 16px; }
        .home-feature-desc { font-size: 0.86rem; color: var(--ink-muted); line-height: 1.6; margin-top: 6px; }

        .home-disciplines {
          margin-top: 40px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          overflow: hidden;
        }
        .home-discipline {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 22px 26px;
          border-bottom: 1px solid var(--border);
          text-decoration: none;
          color: var(--ink);
          transition: background 0.15s ease;
        }
        .home-discipline:last-child { border-bottom: none; }
        .home-discipline:hover { background: var(--surface-2); }
        .home-discipline-num { color: var(--ink-faint); font-size: 0.8rem; flex-shrink: 0; }
        .home-discipline-body { flex: 1; min-width: 0; }
        .home-discipline-title { display: block; font-size: 0.95rem; font-weight: 550; }
        .home-discipline-desc { display: block; margin-top: 3px; font-size: 0.85rem; color: var(--ink-muted); }
        .home-discipline-arrow { color: var(--ink-faint); flex-shrink: 0; }
        .home-discipline:hover .home-discipline-arrow { color: var(--ink-soft); }

        .home-final { padding: 56px 32px; text-align: center; }
        .home-final-title { font-size: clamp(1.3rem, 3vw, 1.6rem); font-weight: 600; letter-spacing: -0.025em; }

        .home-footer { border-top: 1px solid var(--border); padding: 28px 24px; }
        .home-footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          color: var(--ink-faint);
          font-size: 0.78rem;
        }
        .home-footer-brand { font-weight: 600; color: var(--ink-soft); font-size: 0.85rem; }

        @media (max-width: 640px) {
          .home-hero { padding: 140px 20px 72px; }
          .home-section { padding: 64px 20px; }
          .home-discipline { gap: 16px; padding: 18px 20px; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
