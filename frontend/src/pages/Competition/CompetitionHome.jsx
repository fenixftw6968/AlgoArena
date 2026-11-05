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
    <div className="comp-page">
      <div className="comp-wrap">
        <div className="zine-card comp-card">
          <div className="zine-kicker">DSA Competition • up to 25 players</div>
          <h1 className="zine-display" style={{ fontSize: 'clamp(2.4rem, 4vw, 3.2rem)', margin: '0.5rem 0 0.8rem' }}>
            Custom Live Showdown
          </h1>
          <p className="zine-lede" style={{ fontSize: '1.12rem', maxWidth: '75ch', lineHeight: 1.65 }}>
            Everyone gets the same 10 questions and 20 minutes. Highest score wins; ties go to the faster finisher.
            This mode is leaderboard-only - no XP, coins or rating.
          </p>
          <div className="comp-row" style={{ marginTop: '1.5rem' }}>
            <button className="zine-btn zine-btn--violet" onClick={create} disabled={busy} style={{ height: 50, padding: '0 28px', fontSize: '1.05rem' }}>
              <Plus size={18} /> Create competition
            </button>
            <button className="zine-btn zine-btn--ghost" onClick={load} aria-label="Refresh lobbies" style={{ height: 50, padding: '0 22px', fontSize: '1rem' }}>
              <RefreshCw size={16} /> Refresh
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
          <div key={c.id} className="zine-panel comp-card comp-row" style={{ padding: '1.2rem 1.4rem', marginBottom: '1rem' }}>
            <div className="comp-grow">
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>Hosted by {c.hostUsername}</div>
              <div className="comp-muted" style={{ fontSize: '0.94rem', marginTop: 4 }}>Starts automatically when full or at the lobby deadline</div>
            </div>
            <span className="badge" style={{ gap: 8, padding: '6px 12px', fontSize: '0.88rem' }}>
              <Users size={15} /> {c.playerCount}/{c.maxPlayers}
            </span>
            <button className="zine-btn zine-btn--primary" disabled={busy || c.playerCount >= c.maxPlayers} onClick={() => join(c.id)} style={{ height: 42, padding: '0 20px', fontSize: '0.95rem' }}>
              {c.playerCount >= c.maxPlayers ? 'Full' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
