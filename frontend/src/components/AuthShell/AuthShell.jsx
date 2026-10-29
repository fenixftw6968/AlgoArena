export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div className="auth-error-banner" role="alert">
      {children}
    </div>
  );
}

/**
 * Minimal auth chrome: centered card, hairline footer.
 * Navbar is provided globally by App.jsx, so AuthShell focuses on a clean,
 * perfectly centered card with generous, modern proportions.
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
        <span>© {new Date().getFullYear()} AlgoArena</span>
        <span className="auth-foot-dot">·</span>
        <span>Competitive algorithms, puzzles & duels.</span>
        {footer}
      </footer>

      <style>{`
        .auth-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: transparent;
          padding-top: 70px;
          box-sizing: border-box;
        }
        .auth-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px 64px;
          box-sizing: border-box;
        }
        .auth-card {
          width: 100%;
          max-width: 580px;
          background:
            radial-gradient(ellipse 90% 60% at 50% -10%, rgba(91, 140, 255, 0.14), transparent 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
            var(--surface);
          border: 1px solid rgba(91, 140, 255, 0.24);
          border-radius: 24px;
          padding: clamp(44px, 5.5vh, 58px) clamp(36px, 4.5vw, 52px);
          box-shadow: var(--shadow-lg), 0 0 90px -40px var(--accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          box-sizing: border-box;
        }
        .auth-card-head {
          margin-bottom: 32px;
        }
        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--err-soft);
          border: 1px solid rgba(251, 113, 133, 0.32);
          color: var(--err);
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 0.98rem;
          font-weight: 500;
          margin-bottom: 24px;
        }
        .auth-title {
          font-size: clamp(2.3rem, 3.2vw, 2.85rem);
          font-weight: 700;
          letter-spacing: -0.035em;
          color: var(--ink);
          margin: 0;
        }
        .auth-lede {
          margin-top: 12px;
          color: var(--ink-muted);
          font-size: 1.08rem;
          line-height: 1.6;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .field-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
          pointer-events: none;
        }
        .field-with-icon {
          padding-left: 48px !important;
          height: 54px;
          font-size: 1.06rem;
          border-radius: 12px;
        }
        .field-with-icon-r {
          padding-right: 48px !important;
        }
        .field-action {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--ink-faint);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
        }
        .field-action:hover {
          color: var(--ink);
        }
        .auth-switch {
          margin-top: 28px;
          text-align: center;
          font-size: 1.02rem;
          color: var(--ink-muted);
        }
        .auth-switch a {
          color: var(--accent);
          font-weight: 600;
          text-decoration: none;
        }
        .auth-switch a:hover {
          text-decoration: underline;
          color: #8fb2ff;
        }
        .auth-link-sm {
          font-size: 0.92rem;
          color: var(--ink-muted);
          text-decoration: none;
        }
        .auth-link-sm:hover {
          color: var(--accent);
        }
        .auth-foot {
          padding: 24px 24px 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          flex-wrap: wrap;
          color: var(--ink-faint);
          font-size: 0.82rem;
        }
        .auth-foot-dot {
          color: var(--ink-faint);
        }
        @media (max-width: 520px) {
          .auth-card {
            padding: 28px 22px;
            border-radius: 16px;
          }
          .auth-title {
            font-size: 1.65rem;
          }
        }
      `}</style>
    </div>
  );
}
