import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { competitionService, competitionErrorMessage } from '../../services/competitionService';

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The running competition. All questions are available from the start and can be visited in any order; each
 * answer is final. The server decides correctness and the time - the client only reports what was clicked.
 * Correct/wrong is shown after submitting, but the right option is never revealed until the competition ends.
 */
export default function CompetitionPlay({ state, serverNow, onChanged }) {
  const id = state.id;
  const [questions, setQuestions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});      // number -> { selected, correct }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const submittingRef = useRef(false);

  // answers already recorded on the server (page reload / second tab)
  useEffect(() => {
    const server = {};
    (state.me?.answers || []).forEach((a) => { server[a.questionNumber] = { selected: a.selectedOption, correct: a.correct }; });
    setAnswers((local) => ({ ...local, ...server }));
  }, [state.me?.answers]);

  const loadQuestions = useCallback(async () => {
    try {
      const data = await competitionService.questions(id);
      setQuestions(data.questions);
      setLoadError('');
    } catch (err) {
      setLoadError(competitionErrorMessage(err, 'Could not load the questions.'));
    }
  }, [id]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const question = questions?.[current];
  const answered = question ? answers[question.number] : null;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const choose = async (optionIndex) => {
    if (!question || answered || submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError('');
    try {
      const result = await competitionService.submit(id, question.number, optionIndex);
      // the verdict comes from the server; for a replay it is the ORIGINAL verdict
      setAnswers((prev) => ({ ...prev, [question.number]: { selected: optionIndex, correct: result.correct } }));
      if (result.finished) onChanged();
    } catch (err) {
      setError(competitionErrorMessage(err, 'Your answer could not be saved.'));
      if ([409, 403].includes(err?.response?.status)) onChanged();
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const finish = async () => {
    setPending(true);
    try {
      await competitionService.finish(id);
    } catch (err) {
      setError(competitionErrorMessage(err, 'Could not finish.'));
    } finally {
      setPending(false);
      setConfirmFinish(false);
      onChanged();
    }
  };

  const remainingMs = state.endTime ? Date.parse(state.endTime) - serverNow() : 0;
  const timerClass = remainingMs <= 30000 ? 'comp-timer--crit' : remainingMs <= 120000 ? 'comp-timer--warn' : '';

  return (
    <div className="zine-card comp-card">
      <div className="comp-row">
        <span className="zine-kicker">Question {current + 1} of {questions?.length || state.questionCount}</span>
        <span className="comp-grow" />
        <span className="comp-mono">{answeredCount}/{state.questionCount} answered</span>
        <span className={`comp-timer ${timerClass}`} aria-label="Time remaining" role="timer">{formatRemaining(remainingMs)}</span>
      </div>

      {loadError && (
        <p className="comp-error" role="alert">{loadError} <button className="zine-btn zine-btn--sm" onClick={loadQuestions}>Retry</button></p>
      )}

      {questions && (
        <div className="comp-qgrid" aria-label="Questions">
          {questions.map((q, i) => {
            const a = answers[q.number];
            const cls = ['comp-qdot', i === current ? 'comp-qdot--current' : '', a ? (a.correct ? 'comp-qdot--right' : 'comp-qdot--wrong') : ''].join(' ');
            return <button key={q.number} className={cls} onClick={() => setCurrent(i)} aria-label={`Question ${q.number}`}>{q.number}</button>;
          })}
        </div>
      )}

      {question && (
        <>
          <p className="comp-question">{question.text}</p>
          <div className="comp-options">
            {question.options.map((option, i) => {
              let cls = 'comp-option';
              if (answered) {
                if (answered.selected === i) cls += answered.correct ? ' comp-option--right' : ' comp-option--wrong';
                else cls += ' comp-option--dim';
              }
              return (
                <button key={i} className={cls} disabled={!!answered || pending} onClick={() => choose(i)}>
                  {String.fromCharCode(65 + i)}. {option}
                </button>
              );
            })}
          </div>
          {answered && (
            <p className="comp-muted" style={{ marginTop: '0.6rem' }}>
              {answered.correct ? 'Correct! +100' : 'Not quite - answers are final.'} The right answers are revealed when the competition ends.
            </p>
          )}
        </>
      )}

      {error && <p className="comp-error" role="alert">{error}</p>}

      <div className="comp-row" style={{ marginTop: '1.25rem' }}>
        <button className="zine-btn zine-btn--ghost zine-btn--sm" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          <ChevronLeft size={14} /> Prev
        </button>
        <button className="zine-btn zine-btn--ghost zine-btn--sm" disabled={!questions || current >= questions.length - 1} onClick={() => setCurrent((c) => c + 1)}>
          Next <ChevronRight size={14} />
        </button>
        <span className="comp-grow" />
        {!confirmFinish ? (
          <button className="zine-btn zine-btn--coral zine-btn--sm" disabled={pending} onClick={() => setConfirmFinish(true)}>
            <Flag size={14} /> Finish
          </button>
        ) : (
          <>
            <span className="comp-muted">Unanswered questions score 0. Finish now?</span>
            <button className="zine-btn zine-btn--coral zine-btn--sm" disabled={pending} onClick={finish}>Yes, finish</button>
            <button className="zine-btn zine-btn--ghost zine-btn--sm" onClick={() => setConfirmFinish(false)}>Keep playing</button>
          </>
        )}
      </div>
    </div>
  );
}
