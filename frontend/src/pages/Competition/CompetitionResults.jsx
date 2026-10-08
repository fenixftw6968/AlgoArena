import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { competitionService, competitionErrorMessage } from '../../services/competitionService';

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** FINISHED: final leaderboard, and - for participants only - the review with the correct answers. */
export default function CompetitionResults({ id, member }) {
  const [board, setBoard] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    competitionService.leaderboard(id)
      .then((d) => alive && setBoard(d))
      .catch((e) => alive && setError(competitionErrorMessage(e, 'Could not load the leaderboard.')));
    if (member) {
      competitionService.myResult(id).then((d) => alive && setReview(d)).catch(() => {});
    }
    return () => { alive = false; };
  }, [id, member]);

  return (
    <>
      <div className="zine-card comp-card" style={{ boxShadow: '8px 8px 0 var(--riso-teal)' }}>
        <div className="zine-kicker">Final leaderboard</div>
        {board?.you && (
          <h1 className="zine-display" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '0.3rem 0 0.5rem' }}>
            You placed #{board.you.rank} of {board.participantCount} • {board.you.score} pts
          </h1>
        )}
        {error && <p className="comp-error" role="alert">{error}</p>}
        {!board && !error && <p className="comp-muted">Loading...</p>}
        {board && (
          <div style={{ overflowX: 'auto' }}>
            <table className="comp-table">
              <thead>
                <tr><th>#</th><th>Player</th><th>Score</th><th>Correct</th><th>Time</th></tr>
              </thead>
              <tbody>
                {board.entries.map((e) => (
                  <tr key={`${e.rank}-${e.username}`} className={e.you ? 'you' : ''}>
                    <td>{e.rank}</td>
                    <td>{e.username}{e.you ? ' (you)' : ''}</td>
                    <td>{e.score}</td>
                    <td>{e.correctCount}</td>
                    <td>{e.answeredAll ? formatDuration(e.completionTimeMs) : `${formatDuration(e.completionTimeMs)}*`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="comp-muted" style={{ marginTop: '0.6rem' }}>* did not answer every question. Leaderboard only - no XP, coins or rating changes.</p>
          </div>
        )}
        <div className="comp-row" style={{ marginTop: '1rem' }}>
          <Link to="/competitions" className="zine-btn zine-btn--violet zine-btn--sm">Back to lobbies</Link>
        </div>
      </div>

      {review && (
        <div className="zine-card comp-card">
          <div className="zine-kicker">Your review</div>
          {review.items.map((item) => (
            <div key={item.number} className="comp-review">
              <h4>{item.number}. {item.text}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {item.options.map((option, i) => {
                  let cls = '';
                  if (i === item.correctOption) cls = 'right';
                  else if (i === item.yourSelectedOption) cls = 'mine-wrong';
                  return (
                    <li key={i} className={cls}>
                      {String.fromCharCode(65 + i)}. {option}
                      {i === item.correctOption ? '  ✓ correct' : ''}
                      {i === item.yourSelectedOption && i !== item.correctOption ? '  (your answer)' : ''}
                    </li>
                  );
                })}
              </ul>
              {item.yourSelectedOption == null && <div className="comp-muted">Not answered</div>}
              {item.explanation && <div className="comp-explanation">{item.explanation}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
