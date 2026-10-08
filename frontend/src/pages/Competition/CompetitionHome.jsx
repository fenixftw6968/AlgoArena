import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, RefreshCw } from 'lucide-react';
import { competitionService, competitionErrorMessage } from '../../services/competitionService';
import './Competition.css';

/** /competitions - open lobbies, create a new one, or jump back into one you are already in. */
export default function CompetitionHome() {
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setPage(await competitionService.list(0, 20));
      setError('');
    } catch (err) {
      setError(competitionErrorMessage(err, 'Could not load the lobbies.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await competitionService.create();
      navigate(`/competitions/${created.id}`);
    } catch (err) {
      setError(competitionErrorMessage(err, 'Could not create a competition.'));
      setBusy(false);
    }
  };

  const join = async (id) => {
    setBusy(true);
    setError('');
    try {
      await competitionService.join(id);
      navigate(`/competitions/${id}`);
    } catch (err) {
      setError(competitionErrorMessage(err, 'Could not join this competition.'));
      setBusy(false);
      load();
    }
  };

  return (
    <div className="cosmic-void comp-page">
      <div className="paper-grain" />
      <div className="comp-wrap">
        <div className="zine-card comp-card" style={{ boxShadow: '8px 8px 0 var(--riso-violet)' }}>
          <div className="zine-kicker">DSA Competition • up to 25 players</div>
          <h1 className="zine-display" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', margin: '0.3rem 0 0.5rem' }}>
            Live DSA Showdown
          </h1>
          <p className="zine-lede">
            Everyone gets the same 10 questions and 20 minutes. Highest score wins; ties go to the faster finisher.
            This mode is leaderboard-only - no XP, coins or rating.
          </p>
          <div className="comp-row" style={{ marginTop: '1rem' }}>
            <button className="zine-btn zine-btn--violet" onClick={create} disabled={busy}>
              <Plus size={16} /> Create competition
            </button>
            <button className="zine-btn zine-btn--ghost zine-btn--sm" onClick={load} aria-label="Refresh lobbies">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {error && <p className="comp-error" role="alert">{error}</p>}
        </div>

        <div className="zine-kicker" style={{ margin: '0 0 0.6rem' }}>Open lobbies</div>
        {loading && <p className="comp-muted">Loading...</p>}
        {!loading && page?.items?.length === 0 && (
          <div className="zine-panel comp-card"><p className="comp-muted">No open lobbies right now. Create one and invite others!</p></div>
        )}
        {page?.items?.map((c) => (
          <div key={c.id} className="zine-panel comp-card comp-row" style={{ padding: '0.9rem 1rem', marginBottom: '0.7rem' }}>
            <div className="comp-grow">
              <div style={{ fontWeight: 800 }}>Hosted by {c.hostUsername}</div>
              <div className="comp-muted">Starts automatically when full or at the lobby deadline</div>
            </div>
            <span className="zine-badge" style={{ background: 'var(--riso-teal)', gap: '0.35rem' }}>
              <Users size={12} /> {c.playerCount}/{c.maxPlayers}
            </span>
            <button className="zine-btn zine-btn--sm zine-btn--yellow" disabled={busy || c.playerCount >= c.maxPlayers} onClick={() => join(c.id)}>
              {c.playerCount >= c.maxPlayers ? 'Full' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
