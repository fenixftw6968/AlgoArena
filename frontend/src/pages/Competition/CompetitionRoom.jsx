import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCompetition } from '../../hooks/useCompetition';
import { competitionService, competitionErrorMessage } from '../../services/competitionService';
import CompetitionLobby from './CompetitionLobby';
import CompetitionPlay from './CompetitionPlay';
import CompetitionResults from './CompetitionResults';
import './Competition.css';

const CANCEL_TEXT = {
  NOT_ENOUGH_PLAYERS: 'Not enough players joined, so the competition was cancelled.',
  EMPTY: 'Everyone left, so the competition was cancelled.',
};

/** /competitions/:id - one component per phase, driven by the server's authoritative state. */
export default function CompetitionRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const valid = /^\d{1,18}$/.test(id || '');
  const { state, loading, error, refresh, serverNow } = useCompetition(valid ? id : null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!valid) return <Navigate to="/competitions" replace />;

  const run = async (action, fallback, after) => {
    setBusy(true);
    setActionError('');
    try {
      await action();
      if (after) after();
      else await refresh();
    } catch (err) {
      setActionError(competitionErrorMessage(err, fallback));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onJoin = () => run(() => competitionService.join(id), 'Could not join this competition.');
  const onStart = () => run(() => competitionService.start(id), 'Could not start the competition.');
  const onLeave = () => run(() => competitionService.leave(id), 'Could not leave.', () => navigate('/competitions'));

  let body;
  if (loading && !state) {
    body = <div className="zine-panel comp-card"><p className="comp-muted">Loading...</p></div>;
  } else if (!state) {
    body = (
      <div className="zine-card comp-card">
        <p className="comp-error" role="alert">{error?.message || 'Competition not found.'}</p>
        <Link to="/competitions" className="zine-btn zine-btn--violet zine-btn--sm">Back to lobbies</Link>
      </div>
    );
  } else if (state.status === 'LOBBY' || state.status === 'STARTING') {
    body = <CompetitionLobby state={state} serverNow={serverNow} busy={busy} error={actionError}
                             onJoin={onJoin} onLeave={onLeave} onStart={onStart} />;
  } else if (state.status === 'RUNNING') {
    if (!state.member) {
      body = <div className="zine-panel comp-card"><p className="comp-muted">This competition is already in progress. Results will be public when it ends.</p></div>;
    } else if (state.me?.finished) {
      body = (
        <div className="zine-card comp-card" style={{ boxShadow: '8px 8px 0 var(--riso-violet)' }}>
          <div className="zine-kicker">You are done</div>
          <h1 className="zine-display" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '0.3rem 0 0.5rem' }}>
            Waiting for the others
          </h1>
          <p className="zine-lede">
            {state.finishedCount} of {state.playerCount} players have finished. The final ranking appears when everyone is
            done or time runs out.
          </p>
          <p className="comp-mono">Your score: {state.me.score} • {state.me.correctCount} correct</p>
        </div>
      );
    } else {
      body = <CompetitionPlay state={state} serverNow={serverNow} onChanged={refresh} />;
    }
  } else if (state.status === 'FINISHED') {
    body = <CompetitionResults id={id} member={state.member} />;
  } else {
    body = (
      <div className="zine-card comp-card">
        <div className="zine-kicker">Cancelled</div>
        <p className="zine-lede">{CANCEL_TEXT[state.cancelledReason] || 'This competition was cancelled.'}</p>
        <Link to="/competitions" className="zine-btn zine-btn--violet zine-btn--sm">Back to lobbies</Link>
      </div>
    );
  }

  return (
    <div className="cosmic-void comp-page">
      <div className="paper-grain" />
      <div className="comp-wrap">{body}</div>
    </div>
  );
}
