import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function ExitModal({
  isOpen,
  onCancel,
  onConfirm,
  title = "ABORT ARENA SESSION?",
  message = "Are you sure you wish to disconnect? Active match rating deltas and progression data for this round will be forfeited."
}) {
  if (!isOpen) return null;

  return (
    <div className="overlay" style={{ zIndex: 99999 }}>
      <div className="halftone-coral halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="zine-modal"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.25rem 2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: 'var(--riso-coral)' }} />

        <div style={{
          width: '72px',
          height: '72px',
          background: 'var(--riso-coral)',
          border: '3px solid var(--ink)',
          boxShadow: '5px 5px 0 var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '1.5rem auto 1.25rem',
          color: '#fffdf6',
          transform: 'rotate(-4deg)'
        }}>
          <AlertTriangle size={30} />
        </div>

        <h2 className="zine-display misreg" data-text={title} style={{ fontSize: 'clamp(1.3rem, 5vw, 1.75rem)', marginBottom: '0.6rem' }}>
          {title}
        </h2>

        <p className="zine-lede" style={{ fontSize: '0.85rem', marginBottom: '1.75rem' }}>{message}</p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={onCancel} className="btn-primary" style={{ flex: 1, minWidth: '140px' }}>
            RESUME MATCH
          </button>
          <button
            onClick={onConfirm}
            className="btn-rose"
            style={{ flex: 1, minWidth: '140px' }}
          >
            <LogOut size={14} /> FORFEIT
          </button>
        </div>
      </motion.div>
    </div>
  );
}
