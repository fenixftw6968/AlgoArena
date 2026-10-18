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
      title: 'Practice',
      desc: 'Play solo at your own pace.',
      Icon: Bot,
    },
    {
      id: 'RANKED',
      title: 'Ranked match',
      desc: 'Queue against a real opponent. Rating on the line.',
      Icon: Swords,
    },
    {
      id: 'FRIEND',
      title: 'Play with a friend',
      desc: 'Invite someone from your friends list.',
      Icon: Users,
    },
  ];

  return (
    <div className="overlay" style={{ zIndex: 9999 }} role="dialog" aria-modal="true" aria-label="Select game mode">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        className="zine-modal"
        style={{ width: '100%', maxWidth: '520px' }}
      >
        <div className="pm-head">
          <div>
            <h2 className="pm-title">Select mode</h2>
            <p className="pm-sub">{gameTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="pm-close">
            <X size={15} />
          </button>
        </div>

        <div className="pm-body">
          {modes.map(({ id, title, desc, Icon }) => (
            <button key={id} className="pm-mode" onClick={() => onSelectMode(id)}>
              <span className="pm-mode-icon"><Icon size={17} /></span>
              <span className="pm-mode-text">
                <span className="pm-mode-title">{title}</span>
                <span className="pm-mode-desc">{desc}</span>
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
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }
        .pm-title { font-size: 1.05rem; font-weight: 600; letter-spacing: -0.01em; }
        .pm-sub { font-size: 0.75rem; color: var(--ink-muted); margin-top: 2px; }
        .pm-close {
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
        .pm-close:hover { border-color: var(--border-strong); color: var(--ink); }
        .pm-body { padding: 16px 24px 24px; display: flex; flex-direction: column; gap: 10px; }
        .pm-mode {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-sm);
          background: var(--surface);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .pm-mode:hover { background: var(--surface-2); border-color: var(--ink-faint); }
        .pm-mode-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--ink-soft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pm-mode-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pm-mode-title { font-size: 0.9rem; font-weight: 550; color: var(--ink); }
        .pm-mode-desc { font-size: 0.78rem; color: var(--ink-muted); }
      `}</style>
    </div>
  );
}
