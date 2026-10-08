import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { useTimer } from '../../hooks/useTimer';
import XPPopup from '../../components/XPPopup/XPPopup';
import DifficultySelector from '../../components/DifficultySelector/DifficultySelector';
import GameProgress from '../../components/GameProgress/GameProgress';
import GameResults from '../../components/GameResults/GameResults';
import PlayModeModal from '../../components/PlayModeModal/PlayModeModal';
import MatchmakingLobby from '../../components/MatchmakingLobby/MatchmakingLobby';
import CompetitiveResults from '../../components/CompetitiveResults/CompetitiveResults';
import SocialDrawer from '../../components/SocialDrawer/SocialDrawer';
import ExitModal from '../../components/ExitModal/ExitModal';
import { getDailyQuestionSet } from '../../services/dailyQuestionService';
import { getRandomQuestionSet } from '../../services/randomQuestionService';
import { selectQuestionsForGame } from '../../services/questionHistoryService';
import { numberDetectiveQuestions } from '../../data/numberDetectiveQuestions';
import { balanceAndRandomizeQuestionOptions, createSeededRandom } from '../../utils/optionRandomizer';
import { shuffleArray } from '../../utils/shuffleQuestions';
import api from '../../utils/api';
import { submitMatchAnswer, describeAnswerError } from '../../services/matchAnswerService';
import { useMatchSocket } from '../../hooks/useMatchSocket';

const TIMER_SECONDS = { EASY: 120, MEDIUM: 90, HARD: 60 };
const XP_PER_DIFFICULTY = { EASY: 10, MEDIUM: 25, HARD: 50 };
const QUESTION_COUNT = 5;

export default function NumberDetective() {
  const { user, refreshUser } = useAuth();
  const { xpPopups, showXPPopup } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const acceptedMatch = location.state?.acceptedMatch;

  // Mode state
  const [showModeModal, setShowModeModal] = useState(!acceptedMatch);
  const [playMode, setPlayMode] = useState(acceptedMatch ? 'FRIEND' : 'PRACTICE');
  const [showMatchmaking, setShowMatchmaking] = useState(!!acceptedMatch);
  const [showSocialDrawer, setShowSocialDrawer] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [invitedFriend, setInvitedFriend] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(acceptedMatch || null);
  const [competitiveResult, setCompetitiveResult] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const [difficulty, setDifficulty]   = useState(null); // null = selecting
  const [loadingDifficulty, setLoadingDifficulty] = useState(null);
  const [puzzles, setPuzzles]         = useState([]);
  const [index, setIndex]             = useState(0);
  const [answer, setAnswer]           = useState('');
  const [hintUsed, setHintUsed]       = useState(false);
  const [result, setResult]           = useState(null); // null | 'correct' | 'wrong'
  const [showResult, setShowResult]   = useState(false);
  const [score, setScore]             = useState(0);
  const [mistakes, setMistakes]       = useState(0);
  const [totalXP, setTotalXP]         = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [latestUser, setLatestUser]   = useState(null);
  const startTimeRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const mistakesRef = useRef(0);
  const durationRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const [serverFeedback, setServerFeedback] = useState(null); // server grading of the current question (match mode)
  const [gradingError, setGradingError] = useState('');
  const pendingAnswerRef = useRef(null);

  const clearMatchStorage = useCallback((matchId) => {
    localStorage.removeItem('activeMatchId_number-detective');
    if (matchId) {
      localStorage.removeItem('activeMatchIndex_' + matchId);
      localStorage.removeItem('activeMatchScore_' + matchId);
      localStorage.removeItem('activeMatchMistakes_' + matchId);
    }
  }, []);

  // Listen for MATCH_FINISHED / MATCH_COMPLETED from opponent's submission
  useMatchSocket(currentMatch?.id, (event) => {
    if (event.type === 'MATCH_FINISHED' || event.type === 'MATCH_COMPLETED' || event.data?.status === 'FINISHED') {
      setWaitingForOpponent(false);
      setCompetitiveResult(event.data);
      clearMatchStorage(currentMatch?.id);
    }
  });

  // Poll for match completion while waiting for opponent (fallback)
  useEffect(() => {
    if (!waitingForOpponent || !currentMatch?.id) return;
    
    let isCancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/matches/${currentMatch.id}`);
        if (!isCancelled && res.status === 200 && res.data?.status === 'FINISHED') {
          setWaitingForOpponent(false);
          setCompetitiveResult(res.data);
          clearMatchStorage(currentMatch.id);
        }
      } catch (e) {
        console.warn("Match status check while waiting:", e);
      }
    }, 1500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [waitingForOpponent, currentMatch?.id, clearMatchStorage]);

  // Check for active match on mount
  useEffect(() => {
    if (!user) return;
    const activeMatchId = localStorage.getItem('activeMatchId_number-detective');
    if (!activeMatchId) return;
    
    const checkActiveMatch = async () => {
      try {
        const res = await api.get(`/api/matches/active?gameSlug=number-detective`);
        if (res.status === 200 && res.data) {
          const match = res.data;
          
          if (match.status === 'FINISHED') {
            setCurrentMatch(match);
            setCompetitiveResult(match);
            setShowModeModal(false);
            clearMatchStorage(match.id);
          } else {
            setCurrentMatch(match);
            setShowModeModal(false);
            
            const isP1 = match.player1Id === user.id;
            const finished = isP1 ? match.player1Finished : match.player2Finished;
            
            if (finished) {
              setWaitingForOpponent(true);
            } else {
              handleMatchReady(match);
              
              const savedIndex = localStorage.getItem('activeMatchIndex_' + match.id);
              const savedScore = localStorage.getItem('activeMatchScore_' + match.id);
              const savedMistakes = localStorage.getItem('activeMatchMistakes_' + match.id);
              
              if (savedIndex !== null) setIndex(parseInt(savedIndex, 10));
              if (savedScore !== null) {
                setScore(parseInt(savedScore, 10));
                scoreRef.current = parseInt(savedScore, 10);
              }
              if (savedMistakes !== null) {
                setMistakes(parseInt(savedMistakes, 10));
                mistakesRef.current = parseInt(savedMistakes, 10);
              }

              // Server truth wins over local storage: resume exactly where the server recorded the player.
              if (Number.isInteger(match.viewerAnsweredCount)) {
                const answeredOnServer = match.viewerAnsweredCount;
                const correctOnServer = match.viewerCorrectCount || 0;
                setIndex(answeredOnServer);
                setScore(correctOnServer);
                scoreRef.current = correctOnServer;
                setMistakes(answeredOnServer - correctOnServer);
                mistakesRef.current = answeredOnServer - correctOnServer;
              }
            }
          }
        } else {
          localStorage.removeItem('activeMatchId_number-detective');
        }
      } catch (e) {
        console.error("Failed to check active match", e);
        localStorage.removeItem('activeMatchId_number-detective');
      }
    };
    
    checkActiveMatch();
  }, [user, clearMatchStorage]);

  const handleTimeout = useCallback(() => {
    if (isSubmittingRef.current || showResult || result !== null) return;
    isSubmittingRef.current = true;
    setResult('wrong');
    setShowResult(true);
    if (currentMatch && currentMatch.id) {
      // A timeout is recorded on the server as a wrong answer, in order.
      pendingAnswerRef.current = submitMatchAnswer(currentMatch.id, index, null)
        .then((fb) => setServerFeedback(fb))
        .catch(() => {});
    }
    setMistakes(m => {
      mistakesRef.current = m + 1;
      return m + 1;
    });
  }, [showResult, result, currentMatch, index]);

  const { timeLeft, formatted: formattedTime, urgency, reset, start, pause } = useTimer(
    TIMER_SECONDS[difficulty] || 90,
    handleTimeout
  );

  const startGame = useCallback(async (diff) => {
    setLoadingDifficulty(diff);
    isSubmittingRef.current = false;
    try {
      const selected = await selectQuestionsForGame({
        gameSlug: 'number-detective',
        difficulty: diff,
        questionBank: numberDetectiveQuestions,
        count: QUESTION_COUNT,
        userShuffle: true
      });
      let activeList = Array.isArray(selected) && selected.length > 0 ? selected : [];
      if (activeList.length === 0) {
        const fallback = numberDetectiveQuestions.filter(q => q.difficulty.toLowerCase() === diff.toLowerCase());
        const pool = fallback.length > 0 ? fallback : numberDetectiveQuestions;
        activeList = shuffleArray([...pool]).slice(0, QUESTION_COUNT);
      }
      setPuzzles(activeList);
      setDifficulty(diff);
      setIndex(0);
      setAnswer('');
      setHintUsed(false);
      setResult(null);
      setShowResult(false);
      setScore(0);
      setMistakes(0);
      setTotalXP(0);
      setShowComplete(false);
      scoreRef.current = 0;
      mistakesRef.current = 0;
      startTimeRef.current = Date.now();
      reset(TIMER_SECONDS[diff] || 90);
      start();
    } catch (e) {
      console.warn("Failed to load questions, using fallback set:", e);
      const fallback = numberDetectiveQuestions.filter(q => q.difficulty.toLowerCase() === diff.toLowerCase());
      const pool = fallback.length > 0 ? fallback : numberDetectiveQuestions;
      const activeList = shuffleArray([...pool]).slice(0, QUESTION_COUNT);
      setPuzzles(activeList);
      setDifficulty(diff);
      reset(TIMER_SECONDS[diff] || 90);
      start();
    } finally {
      setLoadingDifficulty(null);
    }
  }, [reset, start]);

  const handleMatchReady = useCallback((matchData) => {
    setCurrentMatch(matchData);
    setShowMatchmaking(false);
    setShowModeModal(false);

    let parsedQuestions = [];
    const rawChallenge = matchData.challengeData || matchData.puzzleSet;
    if (rawChallenge) {
      try {
        parsedQuestions = typeof rawChallenge === 'string' ? JSON.parse(rawChallenge) : rawChallenge;
      } catch (e) {
        console.warn("Could not parse match challengeData/puzzleSet JSON", e);
      }
    }

    if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
      setPuzzles(parsedQuestions);
      setDifficulty((matchData.difficulty || 'MEDIUM').toUpperCase());
      setIndex(0);
      setAnswer('');
      setHintUsed(false);
      setResult(null);
      setShowResult(false);
      setScore(0);
      setMistakes(0);
      setTotalXP(0);
      setShowComplete(false);
      scoreRef.current = 0;
      mistakesRef.current = 0;
      startTimeRef.current = Date.now();
      reset(TIMER_SECONDS[(matchData.difficulty || 'MEDIUM').toUpperCase()] || 90);
      start();
      return;
    }

    const matchSeed = matchData.id || matchData.createdAt || 'match-seed';
    const seededRandom = createSeededRandom(matchSeed);

    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      const matchDiff = matchData.difficulty ? matchData.difficulty.toLowerCase() : 'medium';
      const filtered = numberDetectiveQuestions.filter(q => q.difficulty.toLowerCase() === matchDiff);
      const pool = filtered.length > 0 ? filtered : numberDetectiveQuestions;
      const shuffledPool = shuffleArray(pool, seededRandom);
      parsedQuestions = shuffledPool.slice(0, QUESTION_COUNT);
    }

    parsedQuestions = balanceAndRandomizeQuestionOptions(parsedQuestions, seededRandom);

    setPuzzles(parsedQuestions);
    setDifficulty((matchData.difficulty || 'MEDIUM').toUpperCase());
    setIndex(0);
    setAnswer('');
    setHintUsed(false);
    setResult(null);
    setShowResult(false);
    setScore(0);
    setMistakes(0);
    setTotalXP(0);
    setShowComplete(false);
    scoreRef.current = 0;
    mistakesRef.current = 0;
    startTimeRef.current = Date.now();
    reset(TIMER_SECONDS[(matchData.difficulty || 'MEDIUM').toUpperCase()] || 90);
    start();
  }, [reset, start]);

  const handleExitGame = () => {
    setShowExitModal(false);
    if (currentMatch) {
      clearMatchStorage(currentMatch.id);
    }
    navigate('/games');
  };

  const puzzle = puzzles[index];

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || !puzzle || !answer.trim() || result !== null) return;
    isSubmittingRef.current = true;

    pause();

    let isCorrect = false;
    if (currentMatch && currentMatch.id) {
      // Match mode: the SERVER grades the answer (the client never holds the right answer).
      try {
        const feedback = await submitMatchAnswer(currentMatch.id, index, answer.trim());
        setServerFeedback(feedback);
        setGradingError('');
        isCorrect = feedback.correct === true;
      } catch (e) {
        setGradingError(describeAnswerError(e));
        isSubmittingRef.current = false;
        start();
        return;
      }
    } else {
      const expectedAnswer = String(puzzle.answer !== undefined ? puzzle.answer : (puzzle.correctAnswer !== undefined ? puzzle.correctAnswer : '')).trim().toLowerCase();
      isCorrect = answer.trim().toLowerCase() === expectedAnswer;
    }

    setResult(isCorrect ? 'correct' : 'wrong');
    setShowResult(true);

    if (playMode === 'PRACTICE') {
      const baseXP = XP_PER_DIFFICULTY[difficulty] || 25;
      const earned = isCorrect ? (hintUsed ? Math.floor(baseXP * 0.7) : baseXP) : 0;

      if (isCorrect) {
        setScore(s => s + 1);
        setTotalXP(t => t + earned);
        showXPPopup(earned);
      }

      try {
        const res = await api.post('/api/games/number-detective/attempts', {
          puzzleId: puzzle.id,
          userAnswer: answer.trim(),
          hintUsed: hintUsed,
          timeTakenSeconds: 15
        });

        if (res.data?.user) {
          setLatestUser(res.data.user);
        }
      } catch (e) {
        // Offline / fallback mode
      }
    } else {
      if (isCorrect) {
        setScore(s => {
          scoreRef.current = s + 1;
          return s + 1;
        });
      }
      setMistakes(m => {
        mistakesRef.current = m + (!isCorrect ? 1 : 0);
        return m + (!isCorrect ? 1 : 0);
      });
    }
  }, [puzzle, answer, hintUsed, result, difficulty, playMode, showXPPopup, pause, start, currentMatch, index]);

  const handleNext = async () => {
    isSubmittingRef.current = false;
    if (pendingAnswerRef.current) {
      try { await pendingAnswerRef.current; } finally { pendingAnswerRef.current = null; }
    }
    setServerFeedback(null);
    setGradingError('');
    setAnswer('');
    setHintUsed(false);
    setResult(null);
    setShowResult(false);
    if (index + 1 >= puzzles.length) {
      if (playMode === 'PRACTICE') {
        if (latestUser) {
          refreshUser(latestUser);
        }
        setShowComplete(true);
      } else if (currentMatch) {
        const totalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        durationRef.current = totalDuration;
        try {
          if (currentMatch.id) {
            setWaitingForOpponent(true);
            const res = await api.post(`/api/matches/${currentMatch.id}/submit`, {
              score: scoreRef.current,
              timeTakenSeconds: totalDuration,
              mistakes: mistakesRef.current,
              detailedAnswers: 'Number Detective Set Completed'
            });
            if (res.data?.status === 'FINISHED') {
              setWaitingForOpponent(false);
              setCompetitiveResult(res.data);
              clearMatchStorage(currentMatch.id);
              refreshUser();
              return;
            }
          }
        } catch (e) {
          console.warn("Match result submit error, using offline simulation fallback", e);
          setWaitingForOpponent(false);
        }

        if (currentMatch.player2Id === 999999 || currentMatch.isBotMatch) {
          const botScore = Math.max(0, scoreRef.current + (Math.random() > 0.4 ? (Math.random() > 0.5 ? 0 : -1) : 1));
          const botDelta = scoreRef.current > botScore ? -25 : (scoreRef.current === botScore ? 0 : 25);
          const myDelta = scoreRef.current > botScore ? 25 : (scoreRef.current === botScore ? 0 : -25);
          const simResult = {
            ...currentMatch,
            player1Score: scoreRef.current,
            player2Score: botScore,
            player1RatingChange: myDelta,
            player2RatingChange: botDelta,
            winnerId: scoreRef.current > botScore ? currentMatch.player1Id : (scoreRef.current < botScore ? 999999 : null)
          };
          setCompetitiveResult(simResult);
        }
      }
    } else {
      setIndex(i => i + 1);
      reset(TIMER_SECONDS[difficulty] || 90);
      start();
    }
  };

  // === PLAY MODE SELECT MODAL ===
  if (showModeModal) {
    return (
      <PlayModeModal
        isOpen={showModeModal}
        gameTitle="Number Detective"
        gameIcon="🔢"
        onClose={() => navigate('/games')}
        onSelectMode={(mode) => {
          setPlayMode(mode);
          setShowModeModal(false);
          if (mode === 'PRACTICE') {
            setDifficulty(null);
          } else if (mode === 'RANKED') {
            setShowMatchmaking(true);
          } else if (mode === 'FRIEND') {
            setShowSocialDrawer(true);
          }
        }}
      />
    );
  }

  // === SOCIAL DRAWER ===
  if (showSocialDrawer) {
    return (
      <SocialDrawer
        isOpen={showSocialDrawer}
        onClose={() => {
          setShowSocialDrawer(false);
          setShowModeModal(true);
        }}
        onInviteFriendToGame={(friend) => {
          setShowSocialDrawer(false);
          setInvitedFriend(friend);
          setPlayMode('FRIEND');
          setShowMatchmaking(true);
        }}
      />
    );
  }

  // === MATCHMAKING LOBBY ===
  if (showMatchmaking) {
    return (
      <MatchmakingLobby
        isOpen={showMatchmaking}
        onClose={() => {
          setShowMatchmaking(false);
          setShowModeModal(true);
        }}
        gameSlug="number-detective"
        gameTitle="Number Detective"
        mode={playMode === 'FRIEND' ? 'FRIEND' : 'RANKED'}
        friendTarget={invitedFriend}
        difficulty={difficulty || 'MEDIUM'}
        onMatchReady={handleMatchReady}
      />
    );
  }

  // === COMPETITIVE MATCH RESULTS SCREEN ===
  if (competitiveResult) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', paddingBottom: '3rem', position: 'relative' }}>
        <div className="paper-grain" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <CompetitiveResults
            matchResult={competitiveResult}
            currentUserId={user?.id || currentMatch?.player1Id}
            onRematch={() => {
              if (playMode === 'FRIEND' && currentMatch) {
                const oppId = currentMatch.player1Id === user?.id ? currentMatch.player2Id : currentMatch.player1Id;
                const oppName = currentMatch.player1Id === user?.id ? currentMatch.player2Username : currentMatch.player1Username;
                if (oppId && oppId !== 999999) {
                  setInvitedFriend({ id: oppId, username: oppName });
                }
              }
              clearMatchStorage(currentMatch?.id);
              setCompetitiveResult(null);
              setShowMatchmaking(true);
            }}
            onDashboard={() => {
              clearMatchStorage(currentMatch?.id);
              navigate('/dashboard');
            }}
          />
        </div>
      </div>
    );
  }

  // === WAITING FOR OPPONENT TO FINISH ===
  if (waitingForOpponent) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', position: 'relative' }}>
        <div className="paper-grain" />
        <div className="halftone-teal halftone-fade-r" style={{ position: 'absolute', top: 0, right: 0, width: '34%', height: '100%', opacity: 0.2 }} />

        <div className="zine-card" style={{ textAlign: 'center', padding: '2.5rem 2rem', maxWidth: '460px', width: '100%', position: 'relative', zIndex: 1, boxShadow: '10px 10px 0 var(--riso-teal)' }}>
          <div style={{
            width: '66px',
            height: '66px',
            background: 'var(--riso-teal)',
            border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            transform: 'rotate(4deg)',
            color: '#fffdf6'
          }}>
            <Clock size={30} />
          </div>

          <h2 className="zine-display misreg" data-text="CHALLENGE COMPLETE" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', marginBottom: '0.6rem' }}>
            CHALLENGE COMPLETE
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', marginBottom: '1.5rem' }}>
            Your score: <strong style={{ color: 'var(--riso-teal)' }}>{scoreRef.current} / {puzzles.length}</strong>
          </p>

          <div style={{
            background: 'var(--paper-sunk)',
            border: '2px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            padding: '0.9rem 1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--riso-violet)'
          }}>
            Waiting for opponent synchronization...
          </div>
        </div>
      </div>
    );
  }

  // === DIFFICULTY SELECT (Practice Mode) ===
  if (!difficulty && playMode === 'PRACTICE') {
    return (
      <DifficultySelector
        title="Number Detective"
        subtitle="Spot the hidden mathematical rule in the sequence. Choose your difficulty level."
        icon="🔢"
        loadingTier={loadingDifficulty}
        onSelectDifficulty={(diff) => startGame(diff)}
        onBack={() => setShowModeModal(true)}
      />
    );
  }

  // === COMPLETE SCREEN (Practice Mode) ===
  if (showComplete) {
    return (
      <GameResults
        score={score}
        total={puzzles.length}
        xpEarned={totalXP}
        gameTitle="Number Detective"
        onPlayAgain={() => startGame(difficulty)}
      />
    );
  }

  if (!puzzle) return null;

  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', position: 'relative', overflow: 'hidden' }}>
      <XPPopup popups={xpPopups} />
      <div className="paper-grain" />
      <div className="halftone-violet halftone-fade-l" style={{ position: 'absolute', top: 0, left: 0, width: '26%', height: '100%', opacity: 0.2 }} />

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '1.25rem 1.5rem 4rem', position: 'relative', zIndex: 1 }}>
        
        {/* Reusable Header Progress Bar */}
        <GameProgress
          current={index + 1}
          total={puzzles.length}
          score={score}
          difficulty={difficulty}
          onExit={() => setShowExitModal(true)}
          formattedTime={formattedTime}
          urgency={urgency}
          onMidnightRollover={() => startGame(difficulty)}
        />

        {/* Exit Game Confirmation Modal */}
        <ExitModal
          isOpen={showExitModal}
          onCancel={() => setShowExitModal(false)}
          onConfirm={handleExitGame}
        />

        {/* Puzzle Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="zine-card"
            style={{
              padding: '2rem 2.25rem',
              boxShadow: '7px 7px 0 var(--ink)',
              marginBottom: '1.5rem',
              position: 'relative'
            }}
          >
            <div className="tape" style={{ top: -14, left: '8%' }} />
            <span className="font-mono" style={{ position: 'absolute', top: 14, right: 18, fontSize: '0.6rem', fontWeight: 700, color: 'var(--ink-faint)', letterSpacing: '0.18em' }}>
              Q{String(index + 1).padStart(2, '0')}
            </span>

            {/* Sequence Board */}
            <div style={{ marginBottom: '2rem', paddingRight: '2.5rem' }}>
              <span className="zine-kicker" style={{ display: 'block', marginBottom: '0.75rem' }}>
                SEQUENCE RECOGNITION
              </span>
              <div className="zine-number-board">{puzzle.question}</div>
            </div>

            {/* Hint */}
            {hintUsed && puzzle.hint && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="zine-hint"
                style={{ marginBottom: '1.25rem' }}
              >
                <Lightbulb size={16} color="var(--ink)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500, margin: 0 }}>{puzzle.hint}</p>
              </motion.div>
            )}

            {/* Options or Text Input */}
            {!showResult ? (
              <div>
                {Array.isArray(puzzle.options) && puzzle.options.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    {puzzle.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setAnswer(String(opt)); }}
                        className={`zine-tile${answer === String(opt) ? ' selected' : ''}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                      type="text"
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && answer && handleSubmit()}
                      placeholder="Enter solution number..."
                      className="zine-input zine-input--mono"
                      style={{ flex: 1, textAlign: 'center', fontSize: '1.25rem', padding: '0.85rem' }}
                      autoFocus
                    />
                  </div>
                )}

                <button
                  onClick={() => answer && handleSubmit()}
                  disabled={!answer}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '1.5rem' }}
                >
                  SUBMIT SOLUTION →
                </button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                {/* Result banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    background: result === 'correct' ? 'var(--riso-teal)' : 'var(--riso-coral)',
                    color: '#fffdf6',
                    border: '2px solid var(--ink)',
                    boxShadow: '4px 4px 0 var(--ink)',
                    marginBottom: '1.25rem'
                  }}
                >
                  {result === 'correct' ? <CheckCircle size={22} /> : <XCircle size={22} />}
                  <div className="font-mono" style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {result === 'correct'
                      ? 'CORRECT NUMBER FOUND'
                      : `INCORRECT — EXPECTED: ${serverFeedback?.correctAnswer ?? (puzzle.correctAnswer || puzzle.answer)}`}
                  </div>
                </div>

                {/* Explanation */}
                {(serverFeedback?.explanation ?? puzzle.explanation) && (
                  <div style={{ padding: '1.15rem', background: 'var(--paper-sunk)', border: '2px dashed var(--ink-faint)', marginBottom: '1.5rem' }}>
                    <p className="font-mono" style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--riso-violet)', marginBottom: '0.45rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      SEQUENCE RULE
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, fontWeight: 400, margin: 0 }}>
                      {serverFeedback?.explanation ?? puzzle.explanation}
                    </p>
                  </div>
                )}

                <button onClick={handleNext} className="btn-primary" style={{ width: '100%' }}>
                  {index + 1 >= puzzles.length ? 'FINAL CLASSIFICATION →' : 'NEXT PUZZLE →'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom actions */}
        {!showResult && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {!hintUsed && puzzle.hint && (
              <button
                onClick={() => setHintUsed(true)}
                className="zine-btn-sm zine-btn-sm--yellow"
              >
                <Lightbulb size={14} color="var(--ink)" /> HINT (-30% XP)
              </button>
            )}
          </div>
        )}
      </div>
      {gradingError && (
        <div role="alert" style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--riso-coral)', color: '#fffdf6', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', padding: '0.6rem 1rem', fontWeight: 700 }}>
          {gradingError}
        </div>
      )}
    </div>
  );
}
