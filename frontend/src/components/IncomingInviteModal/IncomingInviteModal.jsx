import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { GAME_REGISTRY } from '../../data/gameRegistry';

export default function IncomingInviteModal({
  invite,
  onAccept,
  onDecline
}) {
  if (!invite) return null;

  const gameInfo = GAME_REGISTRY[invite.gameSlug] || {
    title: invite.gameSlug ? invite.gameSlug.replace(/-/g, ' ').toUpperCase() : 'Game',
    icon: '🎮'
  };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        top: '88px',
        right: '24px',
        zIndex: 99999,
        maxWidth: '400px',
        width: 'calc(100vw - 48px)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="zine-card"
          style={{
            padding: '1.25rem 1.35rem',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--paper-card)',
            boxShadow: '7px 7px 0 var(--riso-violet)',
            transform: 'rotate(0.7deg)'
          }}
        >
          <div className="hazard-tape" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, borderBottom: '2px solid var(--ink)' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginTop: '0.35rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'var(--riso-violet)',
              border: '2px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              flexShrink: 0,
              boxShadow: '3px 3px 0 var(--ink)'
            }}>
              {gameInfo.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="font-mono" style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--riso-coral)', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                Incoming 1v1 Challenge
              </span>

              <h4 className="zine-display" style={{
                fontSize: '1rem',
                marginBottom: '0.25rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                @{invite.player1Username}
              </h4>

              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', lineHeight: 1.4, marginBottom: '0.9rem' }}>
                Dispatched challenge for <strong style={{ color: 'var(--ink)' }}>{gameInfo.title}</strong>
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onAccept(invite)} className="zine-btn-sm zine-btn-sm--violet" style={{ flex: 1, padding: '0.5rem 0.75rem' }}>
                  <Check size={12} /> ACCEPT
                </button>
                <button onClick={() => onDecline(invite)} className="zine-btn-sm" style={{ flex: 1, padding: '0.5rem 0.75rem' }}>
                  <X size={12} /> DECLINE
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
