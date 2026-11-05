import { Link } from 'react-router-dom';
import { ChevronRight, Hash, KeyRound, Code2, Puzzle, HelpCircle, Lock } from 'lucide-react';

const CATEGORY_TAGS = {
  'Programming / DSA': 'DSA',
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
  const categoryLabel = CATEGORY_TAGS[game.category] || game.category || 'Discipline';
  const unlocked = game.isUnlocked !== false;
  const Tag = unlocked ? Link : 'div';

  return (
    <Tag
      to={unlocked ? `/games/${game.slug}` : undefined}
      className={`game-card${unlocked ? '' : ' game-card--locked'}`}
      aria-disabled={!unlocked || undefined}
    >
      <div className="game-card-top">
        <span className="game-card-icon">
          {unlocked ? <IconComponent size={16} /> : <Lock size={15} />}
        </span>
        <span className="game-card-category mono">{categoryLabel}</span>
        {game.isNew && <span className="badge" style={{ marginLeft: 6 }}>New</span>}
      </div>

      <h3 className="game-card-title truncate">{game.title}</h3>

      <div className="game-card-bottom">
        <span className={`badge ${diff.cls}`}>{diff.label}</span>
        {game.estimatedTime && <span className="game-card-time mono">{game.estimatedTime}</span>}
        {unlocked && <ChevronRight size={15} className="game-card-arrow" />}
      </div>
    </Tag>
  );
}
