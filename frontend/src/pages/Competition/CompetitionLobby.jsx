import { Crown, LogOut, Play, Users } from 'lucide-react';

function secondsLeft(iso, serverNow) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((Date.parse(iso) - serverNow()) / 1000));
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Waiting room (LOBBY) and the pre-start countdown (STARTING). */
export default function CompetitionLobby({ state, serverNow, busy, error, onJoin, onLeave, onStart }) {
  const starting = state.status === 'STARTING';
  const full = state.playerCount >= state.maxPlayers;
  const needed = Math.max(0, state.minPlayers - state.playerCount);

  return (
    <div className="zine-card comp-card" style={{ boxShadow: '8px 8px 0 var(--riso-yellow)' }}>
      <div className="zine-kicker">{starting ? 'Get ready' : 'Lobby'}</div>
      <h1 className="zine-display" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '0.3rem 0 0.5rem' }}>
        {starting ? 'Starting in' : `Hosted by ${state.hostUsername}`}
      </h1>

      {starting ? (
        <>
          <div className="comp-countdown" aria-live="polite">{secondsLeft(state.startTime, serverNow)}</div>
          <p className="comp-muted" style={{ textAlign: 'center' }}>
            {state.questionCount} questions • {Math.round(state.durationSeconds / 60)} minutes • the roster is locked
          </p>
        </>
      ) : (
        <>
          <div className="comp-row">
            <span className="zine-badge" style={{ background: 'var(--riso-teal)', gap: '0.35rem' }}>
              <Users size={12} /> {state.playerCount}/{state.maxPlayers}
            </span>
            <span className="comp-muted">
              Auto-start when full, or at {formatClock(secondsLeft(state.lobbyDeadlineAt, serverNow))} from now
              {needed > 0 ? ` if at least ${state.minPlayers} players have joined` : ''}.
            </span>
          </div>
          {needed > 0 && <p className="comp-note">Waiting for {needed} more player{needed === 1 ? '' : 's'} before it can start.</p>}
        </>
      )}

      {state.member && (
        <ul className="comp-players">
          {state.players.map((p) => (
            <li key={p.username} className={`comp-player${p.you ? ' comp-player--you' : ''}`}>
              {p.host && <Crown size={14} aria-label="host" />}
              <span className="name">{p.username}{p.you ? ' (you)' : ''}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="comp-error" role="alert">{error}</p>}

      <div className="comp-row" style={{ marginTop: '1.25rem' }}>
        {!state.member && !starting && (
          <button className="zine-btn zine-btn--violet" disabled={busy || full} onClick={onJoin}>
            {full ? 'Lobby is full' : 'Join competition'}
          </button>
        )}
        {!state.member && starting && <span className="comp-muted">This competition is about to begin - the roster is locked.</span>}
        {state.member && state.canStart && !starting && (
          <button className="zine-btn zine-btn--teal" disabled={busy} onClick={onStart}>
            <Play size={16} /> Start now
          </button>
        )}
        {state.member && (
          <button className="zine-btn zine-btn--ghost zine-btn--sm" disabled={busy} onClick={onLeave}>
            <LogOut size={14} /> Leave
          </button>
        )}
      </div>
    </div>
  );
}
