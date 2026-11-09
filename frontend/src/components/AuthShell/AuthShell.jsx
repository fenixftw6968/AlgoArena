export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div className="auth-error-banner" role="alert">
      {children}
    </div>
  );
}

/**
 * Yellow + Black Dark Cinematic Auth Shell
 */
export default function AuthShell({ kicker, title, lede, children, footer }) {
  return (
    <div className="auth-root">
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
        <span>AlgoArena</span>
        <span className="auth-foot-dot">·</span>
        <span>Black · White · Lime algorithmic arena</span>
        <span className="auth-foot-dot">·</span>
        <span className="mono">© {new Date().getFullYear()}</span>
        {footer}
      </footer>

      <style>{`
        .auth-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding-top: 54px;
          box-sizing: border-box;
          background: var(--bg);
        }

        .auth-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px 48px;
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 2px solid #0A0A0A;
          border-radius: var(--radius-lg);
          padding: 32px 32px 36px;
          box-shadow: 6px 6px 0px #0A0A0A;
        }

        .auth-card-head {
          margin-bottom: 24px;
        }

        .auth-title {
          font-size: 1.5rem;
          font-weight: 650;
          letter-spacing: -0.03em;
          color: var(--ink);
          margin: 0;
        }

        .auth-lede {
          margin-top: 6px;
          color: var(--ink-muted);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0A0A0A;
          border: 2px solid #0A0A0A;
          color: var(--accent);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          font-weight: 700;
          margin-bottom: 20px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
          pointer-events: none;
        }

        .field-with-icon {
          padding-left: 36px !important;
          height: 38px;
          font-size: 0.875rem;
          border-radius: var(--radius-sm);
        }

        .field-with-icon-r {
          padding-right: 36px !important;
        }

        .field-action {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--ink-faint);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }

        .field-action:hover {
          color: var(--accent-ink);
        }

        .auth-switch {
          margin-top: 20px;
          text-align: center;
          font-size: 0.8125rem;
          color: var(--ink-muted);
        }

        .auth-switch a {
          color: var(--accent-ink);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .auth-link-sm {
          font-size: 0.75rem;
          color: var(--ink-muted);
          text-decoration: none;
        }

        .auth-link-sm:hover {
          color: var(--accent-ink);
          text-decoration: underline;
        }

        .auth-foot {
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.75rem;
          color: var(--ink-faint);
          border-top: 2px solid #0A0A0A;
          background: var(--surface);
        }

        .auth-foot-dot {
          color: var(--border);
        }
      `}</style>
    </div>
  );
}
