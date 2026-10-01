import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Lock, ChevronRight, Hash, Eye, KeyRound, Code2, Puzzle, Sparkles, HelpCircle } from 'lucide-react';

const CATEGORY_TAGS = {
  'Programming / DSA': 'PROGRAMMING',
  'Reasoning': 'REASONING',
  'Brain Training': 'BRAIN TRAINING',
  'Logic': 'LOGIC',
  'Memory': 'MEMORY',
};

const DIFFICULTY_INKS = {
  EASY:   { ink: 'var(--riso-teal)',   label: 'Easy' },
  MEDIUM: { ink: 'var(--riso-yellow)', label: 'Medium' },
  HARD:   { ink: 'var(--riso-coral)',  label: 'Hard' },
};

const SLUG_ICONS = {
  'dsa-master-quiz': Code2,
  'logic-puzzle': Puzzle,
  'brain-teaser-battle': Sparkles,
  'number-detective': Hash,
  'memory-challenge': Eye,
  'code-breaker': KeyRound,
};

export default function GameCard({ game, index = 0, isDashboardFeatured = false, activeDifficulty = 'All' }) {
  const diffKey = (activeDifficulty && activeDifficulty !== 'All') ? activeDifficulty.toUpperCase() : game.difficulty;
  const diff = DIFFICULTY_INKS[diffKey] || DIFFICULTY_INKS[game.difficulty] || DIFFICULTY_INKS.MEDIUM;
  const IconComponent = SLUG_ICONS[game.slug] || HelpCircle;
  const categoryLabel = CATEGORY_TAGS[game.category] || game.category?.toUpperCase() || 'GAME';
  const unlocked = game.isUnlocked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      style={{ position: 'relative', height: '100%' }}
    >
      <Link
        to={unlocked ? `/games/${game.slug}` : '#'}
        className="zine-card"
        style={{
          display: 'block',
          textDecoration: 'none',
          padding: '1.2rem 1.3rem',
          cursor: unlocked ? 'pointer' : 'default',
          opacity: unlocked ? 1 : 0.55,
          boxShadow: '4px 4px 0 var(--ink)',
          transition: 'transform 0.12s steps(3), box-shadow 0.12s steps(3), background 0.12s linear',
          background: 'var(--paper-card)',
          height: '100%'
        }}
        onMouseEnter={e => { if (unlocked) { e.currentTarget.style.transform = 'translate(-3px, -3px)'; e.currentTarget.style.boxShadow = `6px 6px 0 ${diff.ink}`; e.currentTarget.style.background = 'var(--paper-card-hover)'; } }}
        onMouseLeave={e => { if (unlocked) { e.currentTarget.style.transform = 'translate(0, 0)'; e.currentTarget.style.boxShadow = '4px 4px 0 var(--ink)'; e.currentTarget.style.background = 'var(--paper-card)'; } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', gap: '0.5rem' }}>
          <span className="font-mono" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
            {categoryLabel}
          </span>
          {game.isNew && (
            <span className="sticker sticker-violet" style={{ fontSize: '0.58rem', padding: '0.15rem 0.4rem', boxShadow: '2px 2px 0 var(--ink)' }}>NEW</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            background: unlocked ? diff.ink : 'var(--paper-sunk)',
            border: '2px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '3px 3px 0 var(--ink)',
            transform: `rotate(${index % 2 ? 2 : -2}deg)`
          }}>
            {unlocked
              ? <IconComponent size={22} color={diff.ink === 'var(--riso-yellow)' ? 'var(--ink)' : '#fffdf6'} />
              : <Lock size={18} color="var(--ink-faint)" />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="zine-display" style={{
              fontSize: '0.98rem',
              marginBottom: '0.4rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {game.title}
            </h3>
            <span className="zine-badge" style={{ background: diff.ink, color: diff.ink === 'var(--riso-yellow)' ? 'var(--ink)' : '#fffdf6' }}>
              {diff.label}
            </span>
          </div>

          <div style={{
            width: '28px',
            height: '28px',
            background: 'var(--paper-sunk)',
            border: '2px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
            flexShrink: 0
          }}>
            <ChevronRight size={15} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
