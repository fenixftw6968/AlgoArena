import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import GameCard from '../../components/GameCard/GameCard';
import { getAllGamesList } from '../../data/gameRegistry';
import api from '../../utils/api';

const CATEGORIES = ['All', 'Programming / DSA', 'Reasoning'];
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
    <div className="page">
      <div className="container stack">
        <header className="page-head" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Arena</h1>
          <p className="page-lede">
            Four disciplines, three difficulty tiers. Practice solo or take it ranked.
          </p>
        </header>

        {/* Search + filters */}
        <div className="games-toolbar">
          <div className="games-search">
            <Search size={15} className="games-search-icon" />
            <input
              type="text"
              placeholder="Search arenas…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="zine-field games-search-input"
              aria-label="Search arenas"
            />
          </div>

          <div className="games-filter-group" role="group" aria-label="Category">
            <span className="games-filter-label">Category</span>
            <div className="tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`tab${category === cat ? ' active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="games-filter-group" role="group" aria-label="Difficulty">
            <span className="games-filter-label">Difficulty</span>
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

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="card games-empty">
            <p className="muted">No arenas match your filters.</p>
          </div>
        ) : (
          <div className="games-grid">
            {filtered.map((game, i) => (
              <GameCard key={game.slug} game={game} index={i} activeDifficulty={difficulty} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .games-toolbar {
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
          padding: 24px 32px;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface);
        }
        .games-search { position: relative; flex: 1 1 320px; max-width: 480px; }
        .games-search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ink-faint);
          pointer-events: none;
        }
        .games-search-input { padding-left: 48px !important; height: 50px; font-size: 1.05rem; border-radius: 10px; }
        .games-filter-group { display: flex; align-items: center; gap: 14px; }
        .games-filter-label {
          font-family: var(--font-mono);
          font-size: 0.82rem;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-muted);
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 28px;
        }
        .games-empty { padding: 64px 24px; text-align: center; font-size: 1.05rem; }
        @media (max-width: 900px) {
          .games-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .games-search { max-width: 100%; }
          .games-filter-group { width: 100%; flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
