import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Swords } from 'lucide-react';
import { GAME_REGISTRY } from '../../data/gameRegistry';

export default function IncomingInviteModal({
  invite,
  onAccept,
  onDecline
}) {
  if (!invite) return null;

  const gameInfo = GAME_REGISTRY[invite.gameSlug] || {
    title: invite.gameSlug ? invite.gameSlug.replace(/-/g, ' ').toUpperCase() : 'Arena',
  };

  return (
    <AnimatePresence>
      <div className="ii-wrap">
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          className="card ii-card"
          role="dialog"
          aria-label="Incoming match invitation"
        >
          <div className="ii-head">
            <span className="ii-icon"><Swords size={13} /></span>
            <span className="zine-kicker">Match Invitation</span>
          </div>

          <div className="ii-body">
            <h4 className="ii-name truncate">@{invite.player1Username}</h4>
            <p className="ii-text">
              Invited you to a 1v1 showdown in <strong>{gameInfo.title}</strong>
            </p>
          </div>

          <div className="ii-actions">
            <button onClick={() => onAccept(invite)} className="btn btn--primary btn--sm grow">
              <Check size={13} /> Accept
            </button>
            <button onClick={() => onDecline(invite)} className="btn btn--secondary btn--sm grow">
              <X size={13} /> Decline
            </button>
          </div>
        </motion.div>

        <style>{`
          .ii-wrap {
            position: fixed;
            top: 64px;
            right: 20px;
            z-index: 99999;
            max-width: 340px;
            width: calc(100vw - 40px);
          }

          .ii-card {
            padding: 16px;
            border-radius: var(--radius);
            box-shadow: var(--shadow-md);
            background: var(--surface);
          }

          .ii-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }

          .ii-icon {
            width: 22px;
            height: 22px;
            border-radius: var(--radius-xs);
            background: var(--surface-3);
            border: 1px solid var(--border);
            color: var(--accent);
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .ii-body {
            margin-bottom: 14px;
          }

          .ii-name {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--ink);
          }

          .ii-text {
            font-size: 0.78125rem;
            color: var(--ink-muted);
            line-height: 1.45;
            margin-top: 2px;
          }

          .ii-text strong {
            color: var(--accent);
            font-weight: 550;
          }

          .ii-actions {
            display: flex;
            gap: 8px;
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
}
