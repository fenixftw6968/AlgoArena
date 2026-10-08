import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Swords, Trophy, Brain, ChevronRight } from 'lucide-react';

/* ---------- Riso ink marks (bold, blocky, screen-printed) ---------- */
function StarburstMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 2V30M2 16H30M6.1 6.1L25.9 25.9M6.1 25.9L25.9 6.1" stroke="var(--riso-violet)" strokeWidth="2.75" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="3.5" fill="var(--riso-coral)" />
    </svg>
  );
}
function LayersMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 4L28 10L16 16L4 10L16 4Z" fill="var(--riso-violet)"/>
      <path d="M4 17L16 23L28 17" stroke="var(--riso-coral)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 23L16 29L28 23" stroke="var(--riso-teal)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CubeMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="var(--riso-yellow)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M16 16V29M16 16L28 9.5M16 16L4 9.5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const INKS = ['var(--riso-violet)', 'var(--riso-coral)', 'var(--riso-teal)', 'var(--riso-yellow)', 'var(--riso-violet)', 'var(--riso-coral)'];

const DISCIPLINES = [
  { glyph: '01', icon: '🧠', title: 'DSA & Algorithms',  desc: 'Master data structures, algorithm complexities, graph traversals, and code output analysis.', difficulty: 5 },
  { glyph: '02', icon: '🧩', title: 'Logical Reasoning', desc: 'Solve multi-step deduction grids, syllogisms, analogies, and boolean condition puzzles.', difficulty: 4 },
  { glyph: '03', icon: '🔢', title: 'Number Detective',    desc: 'Crack patterns in non-linear mathematical formulas, Fibonacci variants, and exponential matrices.', difficulty: 3 },
  { glyph: '04', icon: '🔐', title: 'Code Breaker',        desc: 'Deduce secret combinations through systematic elimination, positional logic, and entropy clues.', difficulty: 4 },
];

const KEY_FEATURES = [
  { mark: <StarburstMark />, tag: 'Ultra Responsive', title: 'Sub-Second Grading',   desc: 'Instant code and logic validation with millisecond precision, powered by reactive client-server architecture.', ink: 'var(--riso-violet)' },
  { mark: <LayersMark />,    tag: 'Skill Tiers',      title: 'Adaptive Progression', desc: 'Four calibrated game arenas that test algorithms, logic, number patterns, and deduction against your tier.', ink: 'var(--riso-coral)' },
  { mark: <CubeMark />,      tag: 'Competitive',       title: 'Real-Time 1v1 Elo',    desc: 'Live head-to-head battles with automated matchmaking, bot fallbacks, and Elo rating updates.', ink: 'var(--riso-teal)' },
];

const TICKER = ['DAILY MIDNIGHT RESET', 'FOUR GAME ARENAS', 'LIVE ELO MATCHMAKING', 'INSTANT GRADING', 'DAILY STREAKS', 'GLOBAL LEADERBOARD'];

export default function Home() {
  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', overflowX: 'hidden', color: 'var(--ink)', position: 'relative' }}>
      <div className="paper-grain" />
      <div className="halftone-violet halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.22 }} />

      {/* ================= MASTHEAD ================= */}
      <section style={{
        position: 'relative',
        padding: '9.5rem 1.5rem 5rem',
        zIndex: 1,
        overflow: 'hidden',
        borderBottom: '3px solid var(--ink)'
      }}>
        <div className="halftone-coral halftone-fade-l" style={{ position: 'absolute', top: 90, right: -40, width: 420, height: 420, opacity: 0.35 }} />
        <div className="tape" style={{ top: 84, left: '12%', transform: 'rotate(-7deg)' }} />
        <div className="reg-mark" style={{ top: 120, right: 32 }} />
        <div className="reg-mark" style={{ top: 152, right: 32 }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="zine-badge"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', background: 'var(--ink)', color: 'var(--paper)', padding: '0.4rem 0.8rem' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--riso-coral)', animation: 'pulse 1.6s infinite' }} />
            LIVE ARENAS &mdash; ISSUE 01
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="zine-display"
            style={{ fontSize: 'clamp(2.6rem, 8.5vw, 6rem)', marginBottom: '1.5rem' }}
          >
            Master<br />
            <span className="misreg" data-text="Algorithms." style={{ color: 'var(--ink)' }}>Algorithms.</span><br />
            <span style={{ color: 'var(--riso-violet)' }}>Conquer</span> Puzzles.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="zine-lede"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', maxWidth: '620px', margin: '0 auto 2.5rem' }}
          >
            Level up your analytical intellect through curated DSA challenges, logic grids,
            cryptographic ciphers, and real-time 1v1 Elo duels.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.26 }}
            style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4.5rem' }}
          >
            <Link to="/games" className="btn-primary" style={{ padding: '0.95rem 2.4rem', fontSize: '0.95rem' }}>
              Enter Arenas <ArrowRight size={16} />
            </Link>
            <Link to="/signup" className="btn-secondary" style={{ padding: '0.95rem 2.4rem', fontSize: '0.95rem' }}>
              Create Free Account
            </Link>
          </motion.div>

          {/* 3-column ruled strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.36 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              maxWidth: '900px',
              margin: '0 auto',
              width: '100%',
              textAlign: 'left'
            }}
          >
            {[
              { icon: <Swords size={18} />, title: 'Live 1v1 Duels',      desc: 'Battle friends or matchmaking opponents in synchronized cognitive sprints.', ink: 'var(--riso-coral)' },
              { icon: <Trophy size={18} />, title: 'Competitive Elo',     desc: 'Climb from Novice to Master tier with a mathematically balanced rating system.', ink: 'var(--riso-violet)' },
              { icon: <Brain size={18} />,  title: '4 Game Arenas',       desc: 'Algorithms, logic puzzles, number patterns, and code ciphers.', ink: 'var(--riso-teal)' },
            ].map((s, i, arr) => (
              <div
                key={s.title}
                style={{
                  padding: '0 1.5rem',
                  borderLeft: i === 0 ? 'none' : '2px dashed var(--ink-faint)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: s.ink }}>
                  {s.icon}
                  <h4 className="zine-display" style={{ fontSize: '0.95rem' }}>{s.title}</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= MARQUEE TICKER ================= */}
      <div style={{ background: 'var(--ink)', color: 'var(--paper)', overflow: 'hidden', padding: '0.6rem 0', borderBottom: '3px solid var(--ink)' }}>
        <div style={{ display: 'flex', gap: '2.5rem', width: 'max-content', animation: 'marquee 28s linear infinite', whiteSpace: 'nowrap' }}>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em' }}>
              {t} <span style={{ color: 'var(--riso-coral)' }}>&#9679;</span>
            </span>
          ))}
        </div>
      </div>

      {/* ================= KEY FEATURES ================= */}
      <section style={{ padding: '6rem 1.5rem 4rem', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div className="zine-section-head" style={{ marginBottom: '2.5rem' }}>
            <span className="zine-kicker">Engineered for Problem Solvers</span>
          </div>

          <h2 className="zine-display" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3.2rem)', maxWidth: '760px', marginBottom: '3.5rem' }}>
            Everything you need to sharpen analytical thinking &amp; coding intuition.
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.75rem' }}>
            {KEY_FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                whileHover={{ x: -4, y: -4 }}
                transition={{ duration: 0.12 }}
                className="zine-card"
                style={{ padding: '1.75rem', boxShadow: `6px 6px 0 ${f.ink}`, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: '58px', height: '58px',
                    background: 'var(--paper-sunk)',
                    border: '2px solid var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '3px 3px 0 var(--ink)'
                  }}>
                    {f.mark}
                  </div>
                  <span className="sticker">{f.tag}</span>
                </div>
                <h3 className="zine-display" style={{ fontSize: '1.3rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>{f.desc}</p>
                <div className="zine-divider" style={{ marginTop: 'auto' }} />
                <span className="font-mono" style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  Plate {String(i + 1).padStart(2, '0')} / 03
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DISCIPLINES ================= */}
      <section style={{ padding: '4rem 1.5rem 6rem', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div className="zine-section-head" style={{ marginBottom: '2.5rem' }}>
            <span className="zine-kicker">Architecture of Arenas</span>
          </div>

          <h2 className="zine-display misreg" data-text="Targeted Cognitive Disciplines" style={{ fontSize: 'clamp(1.9rem, 4.5vw, 3rem)', maxWidth: '720px', marginBottom: '1rem' }}>
            Targeted Cognitive Disciplines
          </h2>
          <p className="zine-lede" style={{ maxWidth: '540px', marginBottom: '2.5rem' }}>
            Curated pathways engineered to expand algorithmic speed, deduction accuracy, and mental acuity.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
            {DISCIPLINES.map((f, i) => (
              <motion.div
                key={f.title}
                whileHover={{ x: -3, y: -3 }}
                transition={{ duration: 0.12 }}
                className="zine-card"
                style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
              >
                <div className="halftone-coral halftone-fade-l" style={{ position: 'absolute', top: 0, right: 0, width: 110, height: 110, opacity: 0.3 }} />
                <span className="font-mono" style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--paper-edge)', lineHeight: 1, zIndex: 1 }}>
                  {f.glyph}
                </span>

                <div style={{
                  width: '54px', height: '54px',
                  background: INKS[i],
                  border: '2px solid var(--ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '3px 3px 0 var(--ink)',
                  transform: 'rotate(-2deg)',
                  marginBottom: '1rem'
                }}>
                  {f.icon}
                </div>

                <h3 className="zine-display" style={{ fontSize: '1.15rem', marginBottom: '0.45rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: '1.15rem' }}>{f.desc}</p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.9rem', borderTop: '2px solid var(--ink)', marginTop: 'auto' }}>
                  <div>
                    <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block' }}>Tier</span>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '3px' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} style={{ width: '12px', height: '8px', border: '1.5px solid var(--ink)', background: n <= f.difficulty ? INKS[i] : 'transparent' }} />
                      ))}
                    </div>
                  </div>
                  <Link
                    to="/games"
                    className="zine-btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Enter <ChevronRight size={13} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= BOTTOM CTA ================= */}
      <section style={{ padding: '0 1.5rem 7rem', position: 'relative', zIndex: 2 }}>
        <div className="zine-card" style={{
          maxWidth: '960px',
          margin: '0 auto',
          background: 'var(--riso-violet)',
          color: '#fffdf6',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          boxShadow: '12px 12px 0 var(--ink)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div className="halftone-ink halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.28 }} />
          <div className="tape" style={{ top: 24, left: '50%', marginLeft: -70, transform: 'rotate(-3deg)', background: 'rgba(255, 196, 0, 0.8)' }} />

          <span className="zine-badge" style={{ background: 'var(--riso-yellow)', color: 'var(--ink)', marginBottom: '1.25rem', position: 'relative' }}>Limited Run</span>
          <h2 className="zine-display" style={{ fontSize: 'clamp(1.9rem, 5vw, 3.2rem)', marginBottom: '1rem', color: '#fffdf6', position: 'relative' }}>
            Ready to Test Your Cognitive Limits?
          </h2>
          <p style={{ fontSize: '1rem', maxWidth: '520px', margin: '0 auto 2.25rem', lineHeight: 1.6, color: 'rgba(255,253,246,0.85)', position: 'relative' }}>
            Join competitive thinkers, solve curated problems, and climb the global ranking leaderboard.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <Link
              to="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.9rem 2.2rem', background: 'var(--riso-yellow)', color: 'var(--ink)',
                border: '3px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)',
                fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '0.85rem',
                textDecoration: 'none', cursor: 'pointer'
              }}
            >
              Get Started Now <ArrowRight size={16} />
            </Link>
            <Link
              to="/games"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.9rem 2.2rem', background: 'transparent', color: '#fffdf6',
                border: '3px solid #fffdf6', boxShadow: '5px 5px 0 var(--riso-coral)',
                fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '0.85rem',
                textDecoration: 'none', cursor: 'pointer'
              }}
            >
              Browse Arenas
            </Link>
          </div>
        </div>
      </section>

      {/* ================= COLOPHON ================= */}
      <footer style={{ borderTop: '3px solid var(--ink)', padding: '2.5rem 1.5rem', textAlign: 'center', position: 'relative', zIndex: 2, background: 'var(--paper-deep)' }}>
        <div className="hazard-tape" style={{ height: 10, marginBottom: '1.75rem', borderBottom: '2px solid var(--ink)' }} />
        <div style={{ maxWidth: '1160px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '12px', background: 'var(--riso-coral)', border: '2px solid var(--ink)', display: 'inline-block' }} />
            <span className="zine-display" style={{ fontSize: '0.9rem' }}>AlgoArena</span>
          </div>
          <span className="font-mono" style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
            &copy; {new Date().getFullYear()} &mdash; Three inks, one press, zero tracking pixels.
          </span>
        </div>
      </footer>
    </div>
  );
}
