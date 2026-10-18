import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

/**
 * Minimal auth chrome: quiet top bar, centered card, hairline footer.
 * All four auth pages (login, signup, forgot, reset) render inside this shell.
 */
export default function AuthShell({ kicker, title, lede, children, footer }) {
  return (
    <div className="auth-root">
      <header className="auth-top">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark"><Brain size={15} /></span>
          <span className="auth-brand-name">AlgoArena</span>
        </Link>
        <Link to="/games" className="btn btn--ghost btn--sm">Browse arenas</Link>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            {kicker && <span className="zine-kicker">{kicker}</span>}
            <h1 className="auth-title">{title}</h1>
            {lede && <p className="auth-lede">{lede}</p>}
          </div>
          {children}
        </div>
      </main>

      <footer className="auth-foot">
        <span>© {new Date().getFullYear()} AlgoArena</span>
        <span>Competitive algorithms, puzzles & duels.</span>
        {footer}
      </footer>

      <style>{`
        .auth-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .auth-top {
          height: 64px;
          padding: 0 24px;
          max-width: 1080px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .auth-brand {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          text-decoration: none;
          color: var(--ink);
        }
        .auth-brand-mark {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--ink);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .auth-brand-name { font-size: 0.94rem; font-weight: 600; letter-spacing: -0.02em; }
        .auth-main {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 24px 72px;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 36px 32px 32px;
        }
        .auth-card-head { margin-bottom: 28px; }
        .auth-title {
          font-size: 1.5rem;
          font-weight: 600;
          letter-spacing: -0.025em;
          margin-top: 8px;
        }
        .auth-lede {
          margin-top: 8px;
          color: var(--ink-muted);
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .auth-foot {
          padding: 20px 24px 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          color: var(--ink-faint);
          font-size: 0.75rem;
        }
        @media (max-width: 480px) {
          .auth-card { padding: 28px 20px 24px; }
          .auth-main { padding: 24px 16px 56px; }
        }

        /* Shared form patterns for all auth pages */
        .auth-form { display: flex; flex-direction: column; gap: 18px; }
        .field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
          pointer-events: none;
        }
        .field-with-icon { padding-left: 36px; }
        .field-with-icon-r { padding-right: 38px; }
        .field-action {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--ink-faint);
          cursor: pointer;
          display: flex;
          padding: 6px;
          border-radius: 6px;
        }
        .field-action:hover { color: var(--ink-soft); }
        .auth-link-sm {
          font-size: 0.78rem;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .auth-link-sm:hover { color: var(--ink); text-decoration: underline; }
        .auth-switch {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          text-align: center;
          color: var(--ink-muted);
          font-size: 0.85rem;
        }
        .auth-switch a { color: var(--ink); font-weight: 500; text-decoration: none; }
        .auth-switch a:hover { text-decoration: underline; }
        .auth-success-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--ok-soft);
          border: 1px solid #bbf7d0;
          color: var(--ok);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }
      `}</style>
    </div>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div className="notice" role="alert" style={{ marginBottom: 20 }}>
      {children}
    </div>
  );
}
