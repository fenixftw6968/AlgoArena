import { motion } from 'framer-motion';
import { Bot, Swords, Users, X } from 'lucide-react';

export default function PlayModeModal({
  isOpen,
  onClose,
  gameTitle = 'Game',
  onSelectMode,
  gameIcon = '🎮'
}) {
  if (!isOpen) return null;

  const modes = [
    {
      id: 'PRACTICE',
      title: 'Practice vs Computer',
      badge: 'Single Player',
      ink: 'var(--riso-teal)',
      icon: Bot,
      description: 'Standard single player mode. Solve challenges, earn XP for account level and unlock achievements. Rating is not affected.',
      benefits: ['Earn Account XP & Level Up', 'No Rating Risk', 'Casual Pace']
    },
    {
      id: 'RANKED',
      title: 'Ranked Matchmaking',
      badge: 'Competitive Elo',
      ink: 'var(--riso-violet)',
      icon: Swords,
      description: 'Match with a player of similar rating. Both receive the identical challenge. The fastest and most accurate wins rating points.',
      benefits: ['Fair Skill Matchmaking', 'Climb Competitive Tiers', 'Elo Rating at Stake']
    },
    {
      id: 'FRIEND',
      title: 'Play with a Friend',
      badge: 'Custom Lobby',
      ink: 'var(--riso-coral)',
      icon: Users,
      description: 'Create a private match or invite a friend directly. Compete head-to-head on the same synchronized challenge.',
      benefits: ['Direct Head-to-Head', 'Live Synchronized Results', 'Friendly Rivalry']
    }
  ];

  return (
    <div className="overlay" style={{ zIndex: 9999 }}>
      <div className="halftone-violet halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="zine-modal"
        style={{ width: '100%', maxWidth: '620px', overflow: 'hidden', position: 'relative' }}
      >
        <div className="halftone-coral halftone-fade-l" style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, opacity: 0.4 }} />

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '3px solid var(--ink)',
          background: 'var(--riso-yellow)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <span style={{
              fontSize: '1.5rem', width: '46px', height: '46px', flexShrink: 0,
              background: 'var(--paper-card)', border: '2px solid var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '3px 3px 0 var(--ink)', transform: 'rotate(-3deg)'
            }}>{gameIcon}</span>
            <div style={{ minWidth: 0 }}>
              <h2 className="zine-display" style={{ fontSize: '1.1rem', margin: 0 }}>Select Mode</h2>
              <p className="font-mono" style={{ fontSize: '0.68rem', margin: '0.15rem 0 0', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                {gameTitle}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="zine-btn-sm">
            <X size={14} />
          </button>
        </div>

        {/* Mode Cards */}
        <div style={{ padding: '1.25rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className="zine-card zine-card--flat"
                style={{
                  padding: '1.1rem 1.2rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'var(--paper-card)',
                  borderLeft: `10px solid ${m.ink}`,
                  boxShadow: '3px 3px 0 var(--ink)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  font: 'inherit'
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  background: m.ink,
                  border: '2px solid var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={20} color="#fffdf6" />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className="zine-display" style={{ fontSize: '0.95rem' }}>{m.title}</span>
                    <span className="zine-badge" style={{ background: m.ink, color: '#fffdf6' }}>{m.badge}</span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '0 0 0.6rem', lineHeight: 1.45 }}>{m.description}</p>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {m.benefits.map((b, i) => (
                      <span key={i} className="zine-badge" style={{ background: 'var(--paper-sunk)', fontSize: '0.6rem' }}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
