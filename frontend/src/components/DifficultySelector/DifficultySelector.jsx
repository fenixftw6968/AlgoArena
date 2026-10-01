import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Zap } from 'lucide-react';

const INKS = { EASY: 'var(--riso-teal)', MEDIUM: 'var(--riso-violet)', HARD: 'var(--riso-coral)' };

const DEFAULT_DIFFICULTIES = [
  {
    id: 'EASY',
    label: 'NOVICE',
    icon: '🌱',
    xp: '+10 XP',
    time: 'Standard',
    desc: 'Foundational drills for conditioning reflexes and core memory recall.'
  },
  {
    id: 'MEDIUM',
    label: 'INTERMEDIATE',
    icon: '⚡',
    xp: '+25 XP',
    time: 'Moderate',
    desc: 'Multi-layer analytical scenarios demanding quick pattern identification.'
  },
  {
    id: 'HARD',
    label: 'EXPERT',
    icon: '🔥',
    xp: '+50 XP',
    time: 'Fast Pace',
    desc: 'Ultra high-pressure combinatorial complexity under strict time decay.'
  }
];

export default function DifficultySelector({
  title = "Select Protocol Tier",
  subtitle = "Choose your operational complexity to initialize the challenge.",
  icon = "🎮",
  onSelectDifficulty,
  onBack,
  customTiers = null,
  loadingTier = null
}) {
  const tiers = customTiers || DEFAULT_DIFFICULTIES;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', paddingTop: '7.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', position: 'relative', overflow: 'hidden' }}>
      <div className="paper-grain" />
      <div className="halftone-teal halftone-fade-b" style={{ position: 'absolute', inset: 0, opacity: 0.22 }} />
      <div className="tape" style={{ top: 118, right: '9%', transform: 'rotate(6deg)', background: 'rgba(0, 151, 140, 0.55)' }} />

      <div style={{ maxWidth: '600px', width: '100%', padding: '2rem 1.5rem 4rem', position: 'relative', zIndex: 10 }}>
        {onBack && (
          <button onClick={onBack} className="zine-btn-sm" style={{ marginBottom: '2rem' }}>
            <ArrowLeft size={13} /> BACK TO ARENA
          </button>
        )}

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              width: '76px', height: '76px', margin: '0 auto 1rem',
              background: 'var(--riso-yellow)',
              border: '3px solid var(--ink)',
              boxShadow: '5px 5px 0 var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.2rem',
              transform: 'rotate(-4deg)'
            }}>
              {icon}
            </div>
            <span className="zine-kicker" style={{ display: 'block', marginBottom: '0.5rem' }}>Choose Your Tier</span>
            <h1 className="zine-display misreg" data-text={title} style={{ fontSize: 'clamp(1.6rem, 5.5vw, 2.4rem)', marginBottom: '0.5rem' }}>
              {title}
            </h1>
            <p className="zine-lede" style={{ fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto' }}>{subtitle}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {tiers.map((tier, idx) => {
              const ink = tier.ink || INKS[String(tier.id).toUpperCase()] || 'var(--riso-violet)';
              const isCurrentLoading = loadingTier && String(loadingTier).toUpperCase() === String(tier.id).toUpperCase();
              const isAnyLoading = !!loadingTier;

              return (
                <motion.button
                  key={tier.id}
                  whileHover={!isAnyLoading ? { x: -3, y: -3 } : {}}
                  whileTap={!isAnyLoading ? { scale: 0.99 } : {}}
                  disabled={isAnyLoading}
                  onClick={() => !isAnyLoading && onSelectDifficulty(tier.id)}
                  className="zine-card"
                  style={{
                    width: '100%',
                    padding: '1.15rem 1.25rem',
                    cursor: isAnyLoading ? (isCurrentLoading ? 'wait' : 'not-allowed') : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.1rem',
                    textAlign: 'left',
                    background: isCurrentLoading ? 'var(--riso-yellow)' : 'var(--paper-card)',
                    boxShadow: isCurrentLoading ? `6px 6px 0 ${ink}` : '4px 4px 0 var(--ink)',
                    opacity: isAnyLoading && !isCurrentLoading ? 0.45 : 1
                  }}
                >
                  <div style={{
                    width: '52px',
                    height: '52px',
                    background: ink,
                    border: '2px solid var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '1.4rem',
                    transform: `rotate(${(idx % 2 ? 1 : -1) * 3}deg)`
                  }}>
                    {isCurrentLoading ? <span className="zine-spinner" style={{ width: '22px', height: '22px', borderWidth: '3px' }} /> : tier.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span className="zine-display" style={{ fontSize: '1.05rem' }}>{tier.label || tier.id}</span>
                      {isCurrentLoading && (
                        <span className="font-mono" style={{ fontSize: '0.64rem', color: 'var(--riso-coral)', fontWeight: 800, letterSpacing: '0.12em' }}>
                          INITIALIZING...
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                      {isCurrentLoading ? 'Synthesizing a verified, non-repeating problem stream...' : tier.desc}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', color: 'var(--ink)' }}>
                      <Zap size={13} fill="var(--riso-coral)" color="var(--riso-coral)" />
                      <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 800 }}>{tier.xp}</span>
                    </div>
                    {tier.time && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', color: 'var(--ink-faint)', marginTop: '0.25rem' }}>
                        <Clock size={11} />
                        <span className="font-mono" style={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{tier.time}</span>
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
