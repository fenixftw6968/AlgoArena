import { Link } from 'react-router-dom';
import { ChevronRight, Hash, KeyRound, Code2, Puzzle, HelpCircle, Lock } from 'lucide-react';

const CATEGORY_TAGS = {
  'Programming / DSA': 'Programming',
  'Reasoning': 'Reasoning',
  'Logic': 'Logic',
};

const DIFFICULTY_CONFIG = {
  EASY:   { label: 'Easy',   cls: 'badge--success' },
  MEDIUM: { label: 'Medium', cls: 'badge--warn' },
  HARD:   { label: 'Hard',   cls: 'badge--danger' },
};

const SLUG_ICONS = {
  'dsa-master-quiz': Code2,
  'logic-puzzle': Puzzle,
  'number-detective': Hash,
  'code-breaker': KeyRound,
};

export default function GameCard({ game, index = 0, activeDifficulty = 'All' }) {
  const diffKey = (activeDifficulty && activeDifficulty !== 'All') ? activeDifficulty.toUpperCase() : game.difficulty;
  const diff = DIFFICULTY_CONFIG[diffKey] || DIFFICULTY_CONFIG[game.difficulty] || DIFFICULTY_CONFIG.MEDIUM;
  const IconComponent = SLUG_ICONS[game.slug] || HelpCircle;
  const categoryLabel = CATEGORY_TAGS[game.category] || game.category || 'Game';
  const unlocked = game.isUnlocked;
  const Tag = unlocked ? Link : 'div';

  return (
    <Tag
      to={unlocked ? `/games/${game.slug}` : undefined}
      className={`card game-card${unlocked ? '' : ' game-card--locked'}`}
      aria-disabled={!unlocked || undefined}
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <div className="game-card-top">
        <span className={`game-card-icon${unlocked ? '' : ' game-card-icon--locked'}`}>
          {unlocked ? <IconComponent size={22} /> : <Lock size={18} />}
        </span>
        <span className="game-card-category mono">{categoryLabel}</span>
        {game.isNew && <span className="badge" style={{ marginLeft: 6 }}>New</span>}
      </div>

      <h3 className="game-card-title truncate">{game.title}</h3>
      {game.description && (
        <p className="game-card-desc">{game.description}</p>
      )}

      <div className="game-card-bottom">
        <span className={`badge ${diff.cls}`}>{diff.label}</span>
        {game.estimatedTime && <span className="game-card-time faint mono">{game.estimatedTime}</span>}
        {unlocked && <ChevronRight size={18} className="game-card-arrow" />}
      </div>
    </Tag>
  );
}
