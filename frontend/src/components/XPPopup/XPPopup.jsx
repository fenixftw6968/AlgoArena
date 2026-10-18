import { AnimatePresence, motion } from 'framer-motion';

export default function XPPopup({ popups }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 999, pointerEvents: 'none', display: 'flex', flexDirection: 'column-reverse', gap: '8px' }}>
      <AnimatePresence>
        {popups.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="xp-popup"
          >
            <span className="xp-popup-amount mono">+{p.amount} XP</span>
            {p.label && <span className="xp-popup-label">{p.label}</span>}
          </motion.div>
        ))}
      </AnimatePresence>

      <style>{`
        .xp-popup {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          white-space: nowrap;
        }
        .xp-popup-amount {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--ink);
        }
        .xp-popup-label {
          font-size: 0.78rem;
          color: var(--ink-muted);
        }
      `}</style>
    </div>
  );
}
