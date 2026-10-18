import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="zine-modal"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px 28px 26px',
          textAlign: 'center',
        }}
      >
        <span className="exit-icon">
          <AlertTriangle size={20} />
        </span>

        <h2 className="exit-title">{title}</h2>
        <p className="exit-message">{message}</p>

        <div className="row" style={{ gap: 10, marginTop: 26 }}>
          <button onClick={onCancel} className="btn btn--primary grow">
            Keep playing
          </button>
          <button onClick={onConfirm} className="btn btn--secondary grow" style={{ color: 'var(--err)', borderColor: '#fecaca' }}>
            Leave
          </button>
        </div>
      </motion.div>

      <style>{`
        .exit-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--err-soft);
          border: 1px solid #fecaca;
          color: var(--err);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }
        .exit-title { font-size: 1.1rem; font-weight: 600; letter-spacing: -0.02em; }
        .exit-message {
          margin-top: 8px;
          font-size: 0.85rem;
          color: var(--ink-muted);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
