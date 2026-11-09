import { motion } from 'framer-motion';
import { Bot, Swords, Users, X } from 'lucide-react';

export default function PlayModeModal({
  isOpen,
  onClose,
  gameTitle = 'Game',
  onSelectMode,
}) {
  if (!isOpen) return null;

  const modes = [
    {
      id: 'PRACTICE',
      title: 'Solo Practice',
      desc: 'Work through problem sets unranked at your own pace.',
      Icon: Bot,
    },
    {
      id: 'RANKED',
      title: 'Ranked 1v1 Duel',
      desc: 'Queue against live players on the global rating ladder.',
      Icon: Swords,
    },
    {
      id: 'FRIEND',
      title: 'Challenge a Friend',
      desc: 'Send an instant match invitation from your network.',
      Icon: Users,
    },
  ];

  return (
    <div className="overlay" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Select game mode">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.14 }}
        className="zine-modal"
        style={{ width: '100%', maxWidth: '440px' }}
      >
        <div className="pm-head">
          <div>
            <h2 className="pm-title">Select Mode</h2>
            <p className="pm-sub">{gameTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="pm-close">
            <X size={14} />
          </button>
        </div>

        <div className="pm-body">
          {modes.map(({ id, title, Icon }) => (
            <button key={id} className="pm-mode" onClick={() => onSelectMode(id)}>
              <span className="pm-mode-icon"><Icon size={16} /></span>
              <span className="pm-mode-text">
                <span className="pm-mode-title">{title}</span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <style>{`
        .pm-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }

        .pm-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink);
        }

        .pm-sub {
          font-size: 0.75rem;
          color: var(--ink-muted);
          margin-top: 1px;
        }

        .pm-close {
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          background: var(--surface-subtle);
          color: var(--ink-muted);
          cursor: pointer;
        }

        .pm-close:hover {
          border-color: var(--border-strong);
          color: var(--ink);
        }

        .pm-body {
          padding: 14px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-mode {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--surface-elevated);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.12s ease, background 0.12s ease;
        }

        .pm-mode:hover {
          border-color: #0A0A0A;
          background: var(--accent-subtle);
        }

        .pm-mode:hover .pm-mode-icon {
          border-color: #0A0A0A;
          color: #0A0A0A;
          background: var(--accent);
        }

        .pm-mode-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-xs);
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--ink);
          flex-shrink: 0;
          transition: all 0.12s ease;
        }
        }

        .pm-mode-text {
          display: flex;
          flex-direction: column;
        }

        .pm-mode-title {
          font-size: 0.84375rem;
          font-weight: 600;
          color: var(--ink);
        }

        .pm-mode-desc {
          font-size: 0.75rem;
          color: var(--ink-muted);
          margin-top: 1px;
        }
      `}</style>
    </div>
  );
}
