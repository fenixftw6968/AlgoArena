import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import GameCard from '../../components/GameCard/GameCard';
import { getAllGamesList } from '../../data/gameRegistry';
import api from '../../utils/api';

const CATEGORIES = ['All', 'Programming / DSA', 'Reasoning', 'Brain Training'];
const DIFFICULTIES = ['All', 'EASY', 'MEDIUM', 'HARD'];

export default function Games() {
  const [category,   setCategory]   = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [search,     setSearch]     = useState('');
  const [games,      setGames]      = useState(() => getAllGamesList());

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await api.get('/api/games');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setGames(res.data);
        }
      } catch (e) {
        console.warn("Using local game registry for games list");
      }
    };
    fetchGames();
  }, []);

  const filtered = games.filter(g => {
    const matchCat  = category   === 'All' || g.category   === category;
    const matchDiff = difficulty === 'All' 
      || g.difficulty === difficulty 
      || (g.xpReward && g.xpReward[difficulty.toLowerCase()] !== undefined)
      || (Array.isArray(g.difficulties) && g.difficulties.includes(difficulty));
    const matchSrc  = !search || g.title.toLowerCase().includes(search.toLowerCase()) || g.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchDiff && matchSrc;
  });

  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6rem', position: 'relative' }}>
      <div className="paper-grain" />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 5rem', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2rem', position: 'relative' }}>
          <div className="tape" style={{ top: -6, right: '6%' }} />
          <div className="zine-kicker" style={{ marginBottom: '0.4rem' }}>Discipline Library</div>
          <h1 className="zine-display misreg" data-text="COGNITIVE ARENAS" style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)', marginBottom: '0.5rem' }}>
            COGNITIVE ARENAS
          </h1>
          <p className="zine-lede" style={{ maxWidth: '54ch' }}>
            Select your discipline. Each arena targets specific algorithmic and analytical faculties.
          </p>
        </motion.div>

        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zine-card"
          style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.15rem', padding: '1.4rem 1.5rem', boxShadow: '6px 6px 0 var(--ink)' }}
        >
          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: '460px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search arenas or topics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="zine-field"
              style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
            />
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`zine-btn-sm${active ? ' zine-btn-sm--violet' : ''}`}
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.7rem' }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Difficulty filter row */}
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="zine-label" style={{ marginBottom: 0, marginRight: '0.35rem' }}>
              Complexity
            </span>
            {DIFFICULTIES.map(d => {
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`zine-btn-sm${active ? ' zine-btn-sm--teal' : ''}`}
                  style={{ padding: '0.3rem 0.8rem' }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Game grid */}
        {filtered.length === 0 ? (
          <div className="zine-card" style={{ textAlign: 'center', padding: '4rem 2rem', boxShadow: '6px 6px 0 var(--riso-coral)' }}>
            <p className="zine-lede">No arenas found matching your current filter criteria.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.15rem' }}>
            {filtered.map((game, i) => (
              <GameCard key={game.slug} game={game} index={i} activeDifficulty={difficulty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
