import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, Lightbulb, CheckCircle2, XCircle, Delete, Lock } from 'lucide-react';
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
import { codeBreakerQuestions } from '../../data/codeBreakerQuestions';
import api from '../../utils/api';
import { submitMatchAnswer, describeAnswerError } from '../../services/matchAnswerService';
import { useMatchSocket } from '../../hooks/useMatchSocket';

const TIMER_SECONDS = { EASY: 150, MEDIUM: 120, HARD: 90 };
const XP_PER_DIFFICULTY = { EASY: 15, MEDIUM: 30, HARD: 60 };

export default function CodeBreaker() {
  const { user, refreshUser } = useAuth();
  const { showXPPopup } = useGame();
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

  const [difficulty, setDifficulty] = useState(null);
  const [loadingDifficulty, setLoadingDifficulty] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [index, setIndex] = useState(0);
  const [digits, setDigits] = useState(['', '', '']);
  const [activeDigit, setActiveDigit] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'wrong' | null
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const startTimeRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const mistakesRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const [serverFeedback, setServerFeedback] = useState(null); // server grading of the current question (match mode)
  const [gradingError, setGradingError] = useState('');

  const clearMatchStorage = useCallback((matchId) => {
    localStorage.removeItem('activeMatchId_code-breaker');
    if (matchId) {
      localStorage.removeItem('activeMatchIndex_' + matchId);
      localStorage.removeItem('activeMatchScore_' + matchId);
      localStorage.removeItem('activeMatchMistakes_' + matchId);
    }
  }, []);

  // Listen for MATCH_FINISHED / MATCH_COMPLETED from opponent
  useMatchSocket(currentMatch?.id, (event) => {
    if (event.type === 'MATCH_FINISHED' || event.type === 'MATCH_COMPLETED' || event.data?.status === 'FINISHED') {
      setWaitingForOpponent(false);
      setCompetitiveResult(event.data);
      clearMatchStorage(currentMatch?.id);
    }
  });

  // Poll for match completion while waiting for opponent (as bulletproof fallback)
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

  const puzzle = puzzles[index];
  const digitCount = puzzle?.digitCount || 3;
  const currentDiff = (puzzle?.difficulty || difficulty || 'MEDIUM').toUpperCase();
  const timerLimit = TIMER_SECONDS[currentDiff] || 120;

  const { timeLeft, formattedTime, urgency, start, reset, pause } = useTimer(
    timerLimit,
    { onComplete: () => handleSubmit(true) }
  );

  // Check for active match on mount
  useEffect(() => {
    if (!user) return;
    const activeMatchId = localStorage.getItem('activeMatchId_code-breaker');
    if (!activeMatchId) return;
    
    const checkActiveMatch = async () => {
      try {
        const res = await api.get(`/api/matches/active?gameSlug=code-breaker`);
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
          localStorage.removeItem('activeMatchId_code-breaker');
        }
      } catch (e) {
        console.error("Failed to check active match", e);
        localStorage.removeItem('activeMatchId_code-breaker');
      }
    };
    
    checkActiveMatch();
  }, [user, clearMatchStorage]);

  // Save active match progress in localStorage
  useEffect(() => {
    if (currentMatch && currentMatch.status !== 'FINISHED' && puzzles.length > 0) {
      localStorage.setItem('activeMatchId_code-breaker', currentMatch.id);
      localStorage.setItem('activeMatchIndex_' + currentMatch.id, index);
      localStorage.setItem('activeMatchScore_' + currentMatch.id, score);
      localStorage.setItem('activeMatchMistakes_' + currentMatch.id, mistakes);
    }
  }, [index, score, mistakes, currentMatch, puzzles]);

  // Auto-start match if accepted from invite
  useEffect(() => {
    if (location.state?.acceptedMatch) {
      const match = location.state.acceptedMatch;
      setCurrentMatch(match);
      setPlayMode('FRIEND');
      setShowModeModal(false);
      setShowMatchmaking(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSelectMode = (mode) => {
    setPlayMode(mode);
    setShowModeModal(false);
    if (mode === 'RANKED') {
      setInvitedFriend(null);
      setShowMatchmaking(true);
    } else if (mode === 'FRIEND') {
      setShowSocialDrawer(true);
    }
  };

  const handleExitGame = async () => {
    setShowExitModal(false);
    if (currentMatch?.id) {
      try {
        await api.post(`/api/matches/${currentMatch.id}/abandon`);
      } catch (e) {}
      clearMatchStorage(currentMatch.id);
    } else if (showMatchmaking) {
      try {
        await api.post('/api/matches/queue/cancel?gameSlug=code-breaker');
      } catch (e) {}
    }
    navigate('/games');
  };

  const handleMatchReady = (match) => {
    setShowMatchmaking(false);
    setShowSocialDrawer(false);
    setCurrentMatch(match);
    startTimeRef.current = Date.now();

    let challengeQuestions = [];
    try {
      if (match.challengeData) {
        const parsed = typeof match.challengeData === 'string' ? JSON.parse(match.challengeData) : match.challengeData;
        if (Array.isArray(parsed) && parsed.length > 0) {
          challengeQuestions = parsed;
        }
      }
    } catch (e) {
      console.warn("Could not parse match challengeData", e);
    }

    if (challengeQuestions.length === 0) {
      const selected = getDailyQuestionSet({
        gameType: 'code-breaker',
        difficulty: 'MEDIUM',
        questionBank: codeBreakerQuestions,
        count: 4,
        userShuffle: false
      });
      challengeQuestions = selected.length > 0 ? selected : codeBreakerQuestions.slice(0, 4);
    }

    setPuzzles(challengeQuestions);
    const matchDiff = match.difficulty || 'MEDIUM';
    setDifficulty(matchDiff);
    setIndex(0);
    setScore(0);
    setMistakes(0);
    setTotalXP(0);
    setHintUsed(false);
    setShowHint(false);
    setResult(null);
    setShowResult(false);
    setShowComplete(false);
    setCompetitiveResult(null);

    const count = challengeQuestions[0]?.digitCount || 3;
    setDigits(new Array(count).fill(''));
    setActiveDigit(0);
  };

  const startGame = async (diff) => {
    setLoadingDifficulty(diff);
    try {
      const selected = await selectQuestionsForGame({
        gameSlug: 'code-breaker',
        difficulty: diff,
        questionBank: codeBreakerQuestions,
        count: 6,
        userShuffle: true
      });

      const activeList = Array.isArray(selected) && selected.length > 0
        ? selected
        : codeBreakerQuestions.filter(q => q.difficulty && q.difficulty.toLowerCase() === diff.toLowerCase());

      setPuzzles(activeList);
      setDifficulty(diff);
      setIndex(0);
      setScore(0);
      setMistakes(0);
      setTotalXP(0);
      setHintUsed(false);
      setShowHint(false);
      setResult(null);
      setShowResult(false);
      setShowComplete(false);
      setCompetitiveResult(null);

      const count = activeList[0]?.digitCount || (diff === 'HARD' ? 4 : 3);
      setDigits(new Array(count).fill(''));
      setActiveDigit(0);
    } catch (e) {
      console.warn("Could not start code breaker via service, using local pool", e);
      const activeList = codeBreakerQuestions.filter(q => q.difficulty && q.difficulty.toLowerCase() === diff.toLowerCase());
      setPuzzles(activeList.slice(0, 6));
      setDifficulty(diff);
      const count = activeList[0]?.digitCount || (diff === 'HARD' ? 4 : 3);
      setDigits(new Array(count).fill(''));
      setActiveDigit(0);
    } finally {
      setLoadingDifficulty(null);
    }
  };

  // Guarantee clean input and result state on every question index change
  useEffect(() => {
    if (puzzles.length > 0) {
      const count = puzzles[index]?.digitCount || 3;
      setDigits(new Array(count).fill(''));
      setActiveDigit(0);
      setHintUsed(false);
      setShowHint(false);
      setResult(null);
      setShowResult(false);
      if (!showComplete) {
        reset(TIMER_SECONDS[(puzzles[index]?.difficulty || difficulty || 'MEDIUM').toUpperCase()] || 120);
        start();
      }
    }
  }, [index, puzzles, showComplete]);

  const handleDigitInput = (val) => {
    if (showResult || !puzzle) return;
    const newDigits = [...digits];
    newDigits[activeDigit] = String(val);
    setDigits(newDigits);
    if (activeDigit < digitCount - 1) {
      setActiveDigit(activeDigit + 1);
    }
  };

  const handleBackspace = () => {
    if (showResult || !puzzle) return;
    const newDigits = [...digits];
    if (newDigits[activeDigit] !== '') {
      newDigits[activeDigit] = '';
      setDigits(newDigits);
    } else if (activeDigit > 0) {
      newDigits[activeDigit - 1] = '';
      setDigits(newDigits);
      setActiveDigit(activeDigit - 1);
    }
  };

  const handleSubmit = useCallback(async (timedOut = false) => {
    if (isSubmittingRef.current || !puzzle || result) return;
    isSubmittingRef.current = true;
    pause();

    const userGuess = digits.join('');
    let isCorrect = false;
    if (currentMatch && currentMatch.id) {
      // Match mode: the SERVER grades the guess; the secret code never reaches this client.
      try {
        const feedback = await submitMatchAnswer(currentMatch.id, index, timedOut ? null : userGuess);
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
      const correctSecret = String(puzzle.secret || puzzle.correctAnswer).trim();
      isCorrect = !timedOut && userGuess === correctSecret;
    }

    setResult(isCorrect ? 'correct' : 'wrong');
    setShowResult(true);

    if (!isCorrect) {
      setMistakes(m => m + 1);
    }

    if (playMode === 'PRACTICE') {
      const baseXP = XP_PER_DIFFICULTY[currentDiff] || 30;
      const earned = isCorrect ? (hintUsed ? Math.floor(baseXP * 0.7) : baseXP) : 0;

      if (isCorrect) {
        setScore(s => s + 1);
        setTotalXP(t => t + earned);
        showXPPopup(earned);
      }

      try {
        const res = await api.post('/api/games/code-breaker/attempts', {
          puzzleId: puzzle.id,
          userAnswer: userGuess,
          hintUsed,
          timeTakenSeconds: timerLimit - timeLeft
        });
        if (res.data?.user) {
          refreshUser(res.data.user);
        }
      } catch (e) {
        // Offline fallback
      }
    } else {
      if (isCorrect) {
        setScore(s => s + 1);
      }
    }
  }, [puzzle, result, digits, hintUsed, currentDiff, timerLimit, timeLeft, pause, start, showXPPopup, refreshUser, playMode, currentMatch, index]);

  const handleNext = async () => {
    isSubmittingRef.current = false;
    setServerFeedback(null);
    setGradingError('');
    const nextCount = puzzles[index + 1]?.digitCount || 3;
    setDigits(new Array(nextCount).fill(''));
    setActiveDigit(0);
    setHintUsed(false);
    setShowHint(false);
    setResult(null);
    setShowResult(false);
    if (index + 1 < puzzles.length) {
      setIndex(i => i + 1);
    } else {
      if (playMode === 'PRACTICE') {
        setShowComplete(true);
      } else if (currentMatch) {
        const totalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        try {
          if (currentMatch.id) {
            setWaitingForOpponent(true);
            const res = await api.post(`/api/matches/${currentMatch.id}/submit`, {
              score: score,
              timeTakenSeconds: totalDuration,
              mistakes: mistakes,
              detailedAnswers: 'Code Breaker Set Completed'
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
          console.warn("Code Breaker match submit error, using offline fallback", e);
          setWaitingForOpponent(false);
        }

        if (currentMatch.player2Id === 999999 || currentMatch.isBotMatch) {
          const botScore = Math.max(0, score + (Math.random() > 0.4 ? (Math.random() > 0.5 ? 0 : -1) : 1));
          const botDelta = score > botScore ? -25 : (score === botScore ? 0 : 25);
          const myDelta = score > botScore ? 25 : (score === botScore ? 0 : -25);
          const simResult = {
            ...currentMatch,
            player1Score: score,
            player2Score: botScore,
            player1RatingChange: myDelta,
            player2RatingChange: botDelta,
            winnerId: score > botScore ? currentMatch.player1Id : (score < botScore ? 999999 : null)
          };
          setCompetitiveResult(simResult);
        }
      }
    }
  };

  // === PLAY MODE SELECT MODAL ===
  if (showModeModal) {
    return (
      <PlayModeModal
        isOpen={showModeModal}
        gameTitle="Code Breaker"
        gameIcon="🔐"
        onClose={() => navigate('/games')}
        onSelectMode={handleSelectMode}
      />
    );
  }

  // === MATCHMAKING LOBBY ===
  if (showMatchmaking) {
    return (
      <MatchmakingLobby
        isOpen={showMatchmaking}
        gameSlug="code-breaker"
        gameTitle="Code Breaker"
        mode={playMode === 'FRIEND' ? 'FRIEND' : 'RANKED'}
        friendTarget={invitedFriend}
        initialMatch={playMode === 'FRIEND' ? currentMatch : null}
        onClose={() => {
          setShowMatchmaking(false);
          setInvitedFriend(null);
          setShowModeModal(true);
        }}
        onMatchReady={handleMatchReady}
      />
    );
  }

  // === SOCIAL DRAWER (PLAY WITH FRIEND) ===
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

  // === WAITING FOR OPPONENT TO FINISH ===
  if (waitingForOpponent) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div className="paper-grain" />
        <div className="halftone-violet halftone-fade-r" style={{ position: 'absolute', top: 0, right: 0, width: '38%', height: '100%', opacity: 0.2 }} />

        <div className="zine-card" style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: '440px', width: '100%', position: 'relative', zIndex: 1, boxShadow: '10px 10px 0 var(--riso-violet)' }}>
          <div style={{
            width: '66px',
            height: '66px',
            background: 'var(--riso-violet)',
            border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            transform: 'rotate(4deg)',
            color: '#fffdf6'
          }}>
            <Lock size={30} />
          </div>

          <h2 className="zine-display misreg" data-text="SET COMPLETED" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', marginBottom: '0.6rem' }}>
            SET COMPLETED
          </h2>

          <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Synchronizing neural stream. Awaiting opponent submission...
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                style={{ width: '10px', height: '10px', background: 'var(--riso-violet)', border: '2px solid var(--ink)' }}
              />
            ))}
          </div>
        </div>
      </div>
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

  // === DIFFICULTY SELECT (Practice Mode) ===
  if (!difficulty && playMode === 'PRACTICE') {
    return (
      <DifficultySelector
        title="Code Breaker"
        subtitle="Deduce the multi-digit classified access code using cryptographic feedback clues."
        icon="🔐"
        loadingTier={loadingDifficulty}
        onSelectDifficulty={(diff) => startGame(diff)}
        onBack={() => setShowModeModal(true)}
      />
    );
  }

  if (showComplete) {
    return (
      <GameResults
        score={score}
        total={puzzles.length}
        xpEarned={totalXP}
        onPlayAgain={() => startGame(difficulty)}
        gameTitle="Code Breaker"
      />
    );
  }

  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', position: 'relative', overflow: 'hidden' }}>
      <div className="paper-grain" />
      <div className="halftone-teal halftone-fade-l" style={{ position: 'absolute', top: 0, left: 0, width: '26%', height: '100%', opacity: 0.18 }} />

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '1.25rem 1.5rem 4rem', position: 'relative', zIndex: 1 }}>
        <GameProgress
          current={index + 1}
          total={puzzles.length}
          score={score}
          difficulty={difficulty}
          onExit={() => setShowExitModal(true)}
          formattedTime={formattedTime}
          urgency={urgency}
        />

        {/* Exit Game Confirmation Modal */}
        <ExitModal
          isOpen={showExitModal}
          onCancel={() => setShowExitModal(false)}
          onConfirm={handleExitGame}
        />

        <AnimatePresence mode="wait">
          {puzzle && (
            <motion.div
              key={puzzle.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="zine-card"
              style={{
                padding: '2rem 2.25rem',
                boxShadow: '7px 7px 0 var(--ink)',
                position: 'relative'
              }}
            >
              <div className="tape" style={{ top: -14, left: '8%' }} />

              {/* Header Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    background: 'var(--riso-violet)',
                    border: '2px solid var(--ink)',
                    boxShadow: '3px 3px 0 var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fffdf6',
                    transform: 'rotate(-3deg)'
                  }}>
                    <KeyRound size={22} />
                  </div>
                  <div>
                    <h2 className="zine-display" style={{ fontSize: 'clamp(1.1rem, 3.4vw, 1.5rem)', margin: 0 }}>
                      {puzzle.title || "DECRYPT CIPHER"}
                    </h2>
                    <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', margin: '0.2rem 0 0', letterSpacing: '0.08em' }}>
                      Crack the {digitCount}-digit secret sequence using the constraints
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => { setShowHint(true); setHintUsed(true); }}
                  disabled={showHint || showResult}
                  className={`zine-btn-sm${showHint ? '' : ' zine-btn-sm--yellow'}`}
                >
                  <Lightbulb size={14} color={showHint ? 'var(--ink-faint)' : 'var(--ink)'} /> {showHint ? 'HINT ACTIVE' : 'REQUEST HINT'}
                </button>
              </div>

              {/* Clue Strips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '2rem' }}>
                {puzzle.clues.map((clue, idx) => (
                  <div key={idx} className="zine-clue">
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      {clue.guess.split('').map((char, cIdx) => (
                        <div key={cIdx} className="zine-clue-digit">{char}</div>
                      ))}
                    </div>
                    <div className="zine-clue__text">{clue.text}</div>
                  </div>
                ))}
              </div>

              {/* Hint Box */}
              {showHint && puzzle.hint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="zine-hint"
                  style={{ marginBottom: '2rem' }}
                >
                  <Lightbulb size={16} color="var(--ink)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.825rem', color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>
                    <strong>DECRYPT HINT:</strong> {puzzle.hint}
                  </span>
                </motion.div>
              )}

              {/* Player Code Input Slots */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', marginBottom: '2rem' }}>
                <span className="zine-kicker">[ ENTER SECRET CODE ]</span>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {digits.map((digit, dIdx) => {
                    const isSelected = activeDigit === dIdx;
                    return (
                      <button
                        key={dIdx}
                        onClick={() => !showResult && setActiveDigit(dIdx)}
                        className={`zine-digit${digit !== '' ? ' filled' : ''}${isSelected ? ' active' : ''}`}
                      >
                        {digit || (isSelected ? '_' : '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Keypad */}
              {!showResult && (
                <div style={{ maxWidth: '360px', margin: '0 auto 1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button key={n} onClick={() => handleDigitInput(n)} className="zine-key">
                      {n}
                    </button>
                  ))}
                  <button onClick={handleBackspace} className="zine-key zine-key--action" style={{ color: 'var(--ink-muted)' }}>
                    <Delete size={18} />
                  </button>
                  <button onClick={() => handleDigitInput(0)} className="zine-key">
                    0
                  </button>
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={digits.some(d => d === '')}
                    className="zine-key zine-key--action zine-key--unlock"
                  >
                    UNLOCK
                  </button>
                </div>
              )}

              {/* Results feedback */}
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: result === 'correct' ? 'var(--riso-teal)' : 'var(--riso-coral)',
                    color: '#fffdf6',
                    border: '2px solid var(--ink)',
                    boxShadow: '6px 6px 0 var(--ink)',
                    padding: '1.5rem',
                    marginTop: '1.5rem',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    {result === 'correct' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                    <h3 className="zine-display" style={{ fontSize: 'clamp(1.05rem, 3.2vw, 1.35rem)', margin: 0, color: '#fffdf6' }}>
                      {result === 'correct' ? 'VAULT UNLOCKED' : 'ACCESS DENIED'}
                    </h3>
                  </div>

                  <p style={{ color: '#fffdf6', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5, fontWeight: 500 }}>
                    {serverFeedback?.explanation ?? puzzle.explanation}
                  </p>

                  <button onClick={handleNext} className="zine-btn" style={{ background: '#fffdf6', color: 'var(--ink)' }}>
                    {index + 1 < puzzles.length ? 'NEXT CIPHER →' : 'VIEW CLASSIFICATION'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {gradingError && (
        <div role="alert" style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--riso-coral)', color: '#fffdf6', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', padding: '0.6rem 1rem', fontWeight: 700 }}>
          {gradingError}
        </div>
      )}
    </div>
  );
}
