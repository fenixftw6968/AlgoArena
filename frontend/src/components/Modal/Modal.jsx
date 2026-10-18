import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, children, title, size = 'md' }) {
  const widths = { sm: '420px', md: '540px', lg: '680px', xl: '840px' };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="overlay"
            style={{ zIndex: 200 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.14 }}
            className="zine-modal"
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '92%', maxWidth: widths[size],
              zIndex: 201,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            {title && (
              <div className="modal-head">
                <h2 className="modal-title">{title}</h2>
                {onClose && (
                  <button onClick={onClose} aria-label="Close dialog" className="modal-close">
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
            <div style={{ padding: 24 }}>
              {children}
            </div>
          </motion.div>

          <style>{`
            .modal-head {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
              padding: 18px 24px;
              border-bottom: 1px solid var(--border);
            }
            .modal-title { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
            .modal-close {
              width: 30px;
              height: 30px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1px solid var(--border);
              border-radius: 7px;
              background: var(--surface);
              color: var(--ink-muted);
              cursor: pointer;
            }
            .modal-close:hover { border-color: var(--border-strong); color: var(--ink); }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
