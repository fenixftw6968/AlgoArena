import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

export default function AuthShell({ kicker, title, lede, accent = 'var(--riso-violet)', children, footer }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      position: 'relative',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      color: 'var(--ink)'
    }}>
      <div className="paper-grain" />
      <div className="halftone-violet halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.28 }} />
      <div className="halftone-coral" style={{ position: 'absolute', top: -60, right: -60, width: 340, height: 340, opacity: 0.3 }} />
      <div className="tape" style={{ top: 108, left: '8%', transform: 'rotate(-6deg)' }} />
      <div className="tape" style={{ bottom: 64, right: '6%', transform: 'rotate(5deg)', background: 'rgba(255, 75, 51, 0.6)' }} />
      <div className="reg-mark" style={{ top: 16, left: 16 }} />
      <div className="reg-mark" style={{ bottom: 16, right: 16 }} />

      <header style={{
        padding: '1.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        zIndex: 10,
        position: 'relative'
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '34px', height: '34px',
            background: 'var(--riso-violet)',
            border: '2px solid var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-3deg)',
            boxShadow: '3px 3px 0 var(--ink)'
          }}>
            <Brain size={17} color="#fffdf6" />
          </div>
          <span className="zine-display" style={{ fontSize: '1rem' }}>
            Algo<span style={{ color: 'var(--riso-coral)' }}>Arena</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="sticker" style={{ display: 'none' }}>Issue 01</span>
          <Link to="/games" className="zine-btn-sm">Browse Games</Link>
        </div>
      </header>

      <main style={{
        maxWidth: '470px',
        margin: '0 auto',
        padding: '2rem 1.5rem 4rem',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="zine-card"
          style={{ width: '100%', boxSizing: 'border-box', boxShadow: `10px 10px 0 ${accent}` }}
        >
          <div style={{ height: 12, background: accent, borderBottom: '3px solid var(--ink)' }} />

          <div style={{ padding: '2rem 1.75rem 1.75rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <span className="zine-kicker">{kicker}</span>
              <h1 className="zine-display misreg" data-text={title} style={{ fontSize: 'clamp(1.9rem, 6vw, 2.6rem)', margin: '0.5rem 0 0.4rem' }}>
                {title}
              </h1>
              {lede && <p className="zine-lede" style={{ fontSize: '0.9rem' }}>{lede}</p>}
            </div>

            {children}
          </div>
        </motion.div>
      </main>

      <footer style={{ borderTop: '3px solid var(--ink)', padding: '1rem 2rem', textAlign: 'center', zIndex: 10, position: 'relative', background: 'var(--paper-deep)' }}>
        <p className="font-mono" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--ink-muted)' }}>
          &copy; {new Date().getFullYear()} AlgoArena &mdash; Printed &amp; bound in the open
        </p>
        {footer}
      </footer>
    </div>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div className="zine-card zine-card--coral" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.7rem 0.9rem',
      marginBottom: '1.25rem',
      boxShadow: '4px 4px 0 var(--riso-coral)',
      background: 'var(--riso-coral)',
      color: '#fffdf6'
    }}>
      {children}
    </div>
  );
}
