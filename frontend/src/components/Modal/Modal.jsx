import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, children, title, size = 'md' }) {
  const widths = { sm: '420px', md: '560px', lg: '720px', xl: '900px' };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="overlay"
            style={{ zIndex: 200 }}
          >
            <div className="halftone-ink halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.35 }} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.16 }}
            className="zine-modal"
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '92%', maxWidth: widths[size],
              zIndex: 201,
              maxHeight: '90vh',
              overflow: 'auto',
              color: 'var(--ink)',
            }}
          >
            <div className="halftone-violet halftone-fade-r" style={{ position: 'absolute', top: 0, right: 0, width: 84, height: 84, opacity: 0.4 }} />
            {title && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '3px solid var(--ink)', background: 'var(--riso-yellow)', position: 'relative' }}>
                <h2 className="zine-display" style={{ fontSize: '1.15rem', margin: 0 }}>{title}</h2>
                {onClose && (
                  <button onClick={onClose} aria-label="Close" className="zine-btn-sm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            <div style={{ padding: '1.5rem', position: 'relative' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
