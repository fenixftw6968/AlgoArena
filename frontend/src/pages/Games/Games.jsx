import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import GameCard from '../../components/GameCard/GameCard';
import { getAllGamesList } from '../../data/gameRegistry';
import api from '../../utils/api';

const CATEGORIES = [
  { value: 'All', label: 'All tracks', short: 'All' },
  { value: 'Programming / DSA', label: 'Algorithms & DSA', short: 'DSA' },
  { value: 'Reasoning', label: 'Analytical Reasoning', short: 'Reasoning' },
];
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
      } catch {
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
    const needle = search.toLowerCase();
    const matchSrc  = !search
      || (g.title || '').toLowerCase().includes(needle)
      || (g.description || '').toLowerCase().includes(needle);
    return matchCat && matchDiff && matchSrc;
  });

  return (
    <div className="page">
      <div className="container stack">
        <header className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Arenas</h1>
        </header>

        {/* Search + filters toolbar */}
        <div className="games-toolbar">
          <div className="games-search">
            <Search size={14} className="games-search-icon" />
            <input
              type="text"
              placeholder="Filter arenas by title or concept…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="zine-field games-search-input"
              aria-label="Filter arenas"
            />
          </div>

          <div className="games-filter-group" role="group" aria-label="Category">
            <span className="games-filter-label">Track</span>
            <div className="tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`tab${category === cat.value ? ' active' : ''}`}
                >
                  <span className="tab-label-full">{cat.label}</span>
                  <span className="tab-label-short">{cat.short}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="games-filter-group" role="group" aria-label="Difficulty">
            <span className="games-filter-label">Tier</span>
            <div className="tabs">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`tab${difficulty === d ? ' active' : ''}`}
                >
                  {d === 'All' ? 'All' : d.charAt(0) + d.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results grid */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: '0.875rem' }}>No arenas match your current search and filter criteria.</p>
          </div>
        ) : (
          <div className="grid-cards">
            {filtered.map((g, i) => (
              <GameCard key={g.slug || i} game={g} index={i} activeDifficulty={difficulty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
