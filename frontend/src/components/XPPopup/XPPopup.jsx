import { AnimatePresence, motion } from 'framer-motion';

export default function XPPopup({ popups }) {
  return (
    <div style={{ position: 'fixed', bottom: '5rem', right: '2rem', zIndex: 999, pointerEvents: 'none', display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
      <AnimatePresence>
        {popups.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: 1, y: -50, scale: 1 }}
            exit={{ opacity: 0, y: -90, scale: 0.8 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            style={{
              background: 'var(--riso-yellow)',
              border: '3px solid var(--ink)',
              color: 'var(--ink)',
              fontWeight: 800,
              fontSize: '0.85rem',
              padding: '0.55rem 1.1rem',
              boxShadow: '5px 5px 0 var(--riso-coral)',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transform: 'rotate(-1.5deg)'
            }}
          >
            <span>+{p.amount} XP</span>
            <span style={{ fontSize: '0.95rem' }}>&#9889;</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
