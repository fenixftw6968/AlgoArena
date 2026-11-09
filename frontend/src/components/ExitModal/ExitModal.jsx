import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export default function ExitModal({
  isOpen,
  onCancel,
  onConfirm,
  title = "Leave this session?",
  message = "Are you sure you want to exit? Progress for this round and any rating changes will be forfeited."
}) {
  if (!isOpen) return null;

  return (
    <div className="overlay" style={{ zIndex: 99999 }} role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.14 }}
        className="zine-modal"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div className="exit-icon">
          <AlertCircle size={18} />
        </div>

        <h2 className="exit-title">{title}</h2>
        <p className="exit-message">{message}</p>

        <div className="row" style={{ gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} className="btn btn--secondary btn--sm grow">
            Keep playing
          </button>
          <button onClick={onConfirm} className="btn btn--danger btn--sm grow">
            Leave session
          </button>
        </div>
      </motion.div>

      <style>{`
        .exit-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: #0A0A0A;
          border: 2px solid #0A0A0A;
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .exit-title {
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--ink);
        }

        .exit-message {
          margin-top: 6px;
          font-size: 0.8125rem;
          color: var(--ink-muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
