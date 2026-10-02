import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, CheckCircle, XCircle, Loader2 } from 'lucide-react';
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
import { balanceAndRandomizeQuestionOptions, createSeededRandom } from '../../utils/optionRandomizer';
import { shuffleArray } from '../../utils/shuffleQuestions';
import api from '../../utils/api';
import { useMatchSocket } from '../../hooks/useMatchSocket';

const TIMER_SECONDS = { EASY: 90, MEDIUM: 60, HARD: 45 };
const XP_PER_DIFFICULTY = { EASY: 15, MEDIUM: 30, HARD: 60 };

export default function MCQGameEngine({
  gameSlug,
  gameTitle,
  gameIcon = '🧠',
  category = 'Logic',
  questionBank = [],
  customDifficulties = null,
  codeLanguage = 'cpp',
  questionCount = null
}) {
  const targetCount = questionCount || (gameSlug === 'dsa-master-quiz' || gameSlug === 'number-detective' || gameSlug === 'logic-puzzle' ? 5 : 10);
  const { user, refreshUser } = useAuth();
  const { xpPopups, showXPPopup } = useGame();
  const navigate = useNavigate();
  const location = useLocation();
  const acceptedMatch = location.state?.acceptedMatch;

  // Mode & Lobby states
  const [showModeModal, setShowModeModal] = useState(!acceptedMatch);
  const [playMode, setPlayMode] = useState(acceptedMatch ? 'FRIEND' : 'PRACTICE');
  const [showMatchmaking, setShowMatchmaking] = useState(!!acceptedMatch);
  const [showSocialDrawer, setShowSocialDrawer] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [invitedFriend, setInvitedFriend] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(acceptedMatch || null);
  const [competitiveResult, setCompetitiveResult] = useState(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Gameplay states
  const [difficulty, setDifficulty] = useState(null); // null = selecting difficulty
  const [loadingDifficulty, setLoadingDifficulty] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [totalXP, setTotalXP] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [latestUser, setLatestUser] = useState(null);

  const isSubmittingRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const mistakesRef = useRef(0);
  const durationRef = useRef(0);

  const clearMatchStorage = useCallback((matchId) => {
    localStorage.removeItem(`activeMatchId_${gameSlug}`);
    if (matchId) {
      localStorage.removeItem(`activeMatchIndex_${matchId}`);
      localStorage.removeItem(`activeMatchScore_${matchId}`);
      localStorage.removeItem(`activeMatchMistakes_${matchId}`);
    }
  }, [gameSlug]);

  // WebSocket listener for real-time 1v1 match results
  useMatchSocket(currentMatch?.id, (event) => {
    if (event.type === 'MATCH_FINISHED' || event.type === 'MATCH_COMPLETED' || event.data?.status === 'FINISHED') {
      setWaitingForOpponent(false);
      setCompetitiveResult(event.data);
      clearMatchStorage(currentMatch?.id);
      refreshUser();
    }
  });

  // Polling fallback when waiting for opponent
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
          refreshUser();
        }
      } catch (err) {
        console.warn("Polling match status fallback failed:", err);
      }
    }, 1200);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [waitingForOpponent, currentMatch?.id, clearMatchStorage, refreshUser]);

  // Handle timeout on a question
  const handleTimeout = () => {
    if (isSubmittingRef.current || showResult || result) return;
    isSubmittingRef.current = true;
    pause();
    mistakesRef.current += 1;
    setMistakes(mistakesRef.current);
    setResult('wrong');
    setShowResult(true);
  };

  // Setup question timer
  const puzzle = puzzles[index];
  const { timeLeft, formatted, urgency, reset, start, pause } = useTimer(
    TIMER_SECONDS[difficulty?.toUpperCase()] || 60,
    () => handleTimeout()
  );

  // Initialize a practice session with questions
  const initGameSession = useCallback(async (selectedDiff) => {
    setLoadingDifficulty(selectedDiff);
    isSubmittingRef.current = false;
    try {
      const selected = await selectQuestionsForGame({
        gameSlug,
        difficulty: selectedDiff,
        questionBank,
        count: targetCount,
        userShuffle: true
      });

      let activeList = Array.isArray(selected) && selected.length > 0 ? selected : [];

      if (activeList.length === 0 && Array.isArray(questionBank) && questionBank.length > 0) {
        const matching = questionBank.filter(q => q.difficulty && q.difficulty.toLowerCase() === selectedDiff.toLowerCase());
        const pool = matching.length > 0 ? matching : questionBank;
        activeList = shuffleArray([...pool]).slice(0, targetCount);
      }

      setPuzzles(activeList);
      setDifficulty(selectedDiff);
      setIndex(0);
      setSelectedOption('');
      setScore(0);
      setMistakes(0);
      setTotalXP(0);
      setShowResult(false);
      setResult(null);
      setHintUsed(false);
      setShowHint(false);
      setShowComplete(false);
      scoreRef.current = 0;
      mistakesRef.current = 0;
      startTimeRef.current = Date.now();
      reset(TIMER_SECONDS[selectedDiff?.toUpperCase()] || 60);
      start();
    } catch (err) {
      console.warn("Failed to load questions, using fallback set:", err);
      const fallback = questionBank.filter(q => q.difficulty && q.difficulty.toLowerCase() === selectedDiff.toLowerCase());
      const pool = fallback.length > 0 ? fallback : questionBank;
      const activeList = shuffleArray([...pool]).slice(0, targetCount);
      setPuzzles(activeList);
      setDifficulty(selectedDiff);
      reset(TIMER_SECONDS[selectedDiff?.toUpperCase()] || 60);
      start();
    } finally {
      setLoadingDifficulty(null);
    }
  }, [gameSlug, questionBank, reset, start]);

  // Submit selected option (Protected against duplicate triggers)
  const handleSubmit = async () => {
    if (isSubmittingRef.current || showResult || result || !selectedOption || !puzzle) return;
    isSubmittingRef.current = true;
    pause();
    const targetAns = (puzzle.correctAnswer || puzzle.answer || '').trim().toLowerCase();
    const chosen = (selectedOption || '').trim().toLowerCase();
    let isCorrect = chosen === targetAns;

    if (!isCorrect && Array.isArray(puzzle.options)) {
      const correctIdx = puzzle.options.findIndex(
        opt => String(opt).trim().toLowerCase() === targetAns
      );
      if (correctIdx !== -1) {
        const letters = ['a', 'b', 'c', 'd'];
        if (chosen === letters[correctIdx]) {
          isCorrect = true;
        }
      }
      const letterIdx = ['a', 'b', 'c', 'd'].indexOf(targetAns);
      if (letterIdx >= 0 && letterIdx < puzzle.options.length) {
        if (chosen === String(puzzle.options[letterIdx]).trim().toLowerCase()) {
          isCorrect = true;
        }
      }
    }
    const currentDiff = (puzzle.difficulty || difficulty || 'MEDIUM').toUpperCase();
    const baseXP = XP_PER_DIFFICULTY[currentDiff] || 30;
    const earnedXP = isCorrect ? (hintUsed ? Math.round(baseXP * 0.7) : baseXP) : 0;
    const earnedCoins = isCorrect ? Math.max(1, Math.round(earnedXP / 2.5)) : 0;

    setResult(isCorrect ? 'correct' : 'wrong');
    setShowResult(true);

    if (isCorrect) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setTotalXP(prev => prev + earnedXP);
      showXPPopup(earnedXP);

      if (playMode === 'PRACTICE') {
        try {
          const res = await api.post(`/api/games/${gameSlug}/attempts`, {
            puzzleId: typeof puzzle.id === 'number' ? puzzle.id : null,
            userAnswer: selectedOption,
            hintUsed: hintUsed,
            timeTakenSeconds: (TIMER_SECONDS[currentDiff] || 60) - (timeLeft !== undefined ? timeLeft : 0)
          });
          if (res.data?.user) {
            setLatestUser(res.data.user);
            refreshUser(res.data.user);
          }
        } catch (e) {
          console.warn('Could not record attempt to backend:', e);
        }
      }
    } else {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
    }
  };

  // Progress to next question or show completion screen
  const handleNext = async () => {
    isSubmittingRef.current = false;
    if (index + 1 >= puzzles.length) {
      pause();
      durationRef.current = Math.round((Date.now() - startTimeRef.current) / 1000);
      setShowComplete(true);

      // Submit final match score if multiplayer
      if (currentMatch && currentMatch.id) {
        try {
          setWaitingForOpponent(true);
          const res = await api.post(`/api/matches/${currentMatch.id}/submit`, {
            score: scoreRef.current,
            mistakes: mistakesRef.current,
            timeTakenSeconds: durationRef.current
          });
          if (res.data?.status === 'FINISHED') {
            setWaitingForOpponent(false);
            setCompetitiveResult(res.data);
            clearMatchStorage(currentMatch.id);
            refreshUser();
          }
        } catch (e) {
          console.error('Failed to submit competitive score:', e);
        }
      }
    } else {
      setIndex(prev => prev + 1);
      setSelectedOption('');
      setShowResult(false);
      setResult(null);
      setShowHint(false);
      setHintUsed(false);
      reset(TIMER_SECONDS[(puzzle?.difficulty || difficulty || 'MEDIUM').toUpperCase()] || 60);
      start();
    }
  };

  // Handle competitive match start from MatchmakingLobby
  const handleMatchReady = (matchData) => {
    isSubmittingRef.current = false;
    setCurrentMatch(matchData);
    setShowMatchmaking(false);
    setShowModeModal(false);

    let parsedQuestions = [];
    const rawChallenge = matchData.challengeData || matchData.puzzleSet;
    if (rawChallenge) {
      try {
        parsedQuestions = typeof rawChallenge === 'string' ? JSON.parse(rawChallenge) : rawChallenge;
      } catch (err) {
        console.warn("Could not parse match challengeData/puzzleSet JSON", err);
      }
    }

    if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
      // Authoritative questions directly from server: guarantees both players get the EXACT SAME questions
      setPuzzles(parsedQuestions);
      setDifficulty(matchData.difficulty || 'MEDIUM');
      setIndex(0);
      setScore(0);
      setMistakes(0);
      setTotalXP(0);
      setShowResult(false);
      setSelectedOption('');
      setShowHint(false);
      setHintUsed(false);
      scoreRef.current = 0;
      mistakesRef.current = 0;
      startTimeRef.current = Date.now();
      reset(TIMER_SECONDS[(matchData.difficulty || 'MEDIUM').toUpperCase()] || 60);
      start();
      return;
    }

    const matchSeed = matchData.id || matchData.createdAt || 'match-seed';
    const seededRandom = createSeededRandom(matchSeed);

    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      const matchDiff = (matchData.difficulty || 'MEDIUM').toUpperCase();
      const filtered = questionBank.filter(q => (q.difficulty || 'MEDIUM').toUpperCase() === matchDiff);
      const pool = filtered.length > 0 ? filtered : questionBank;
      const shuffledPool = shuffleArray(pool, seededRandom);
      parsedQuestions = shuffledPool.slice(0, targetCount);
    }

    // Balance and randomize option positions deterministically with match seed so correct answer isn't always A
    parsedQuestions = balanceAndRandomizeQuestionOptions(parsedQuestions, seededRandom);

    setPuzzles(parsedQuestions);
    setDifficulty(matchData.difficulty || 'MEDIUM');
    setIndex(0);
    setScore(0);
    setMistakes(0);
    setTotalXP(0);
    setShowResult(false);
    setSelectedOption('');
    setShowHint(false);
    setHintUsed(false);
    scoreRef.current = 0;
    mistakesRef.current = 0;
    startTimeRef.current = Date.now();
    reset(TIMER_SECONDS[(matchData.difficulty || 'MEDIUM').toUpperCase()] || 60);
    start();
  };

  // Render Code Block helper
  const renderFormattedQuestion = (text) => {
    if (!text) return null;
    const parts = text.split('```');
    if (parts.length === 1) {
      return <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>{text}</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
        {parts.map((part, idx) => {
          if (idx % 2 === 1) {
            const lines = part.replace(/^cpp\n|^c\n|^python\n|^java\n/, '');
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--paper-deep)',
                  border: '2px solid var(--ink)',
                  boxShadow: '4px 4px 0 var(--riso-violet)',
                  padding: '1.1rem 1.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: 'var(--ink)',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                  position: 'relative'
                }}
              >
                <span className="zine-badge" style={{ position: 'absolute', top: '-11px', left: '12px', background: 'var(--riso-violet)', color: '#fffdf6' }}>CODE</span>
                <pre style={{ margin: 0, fontFamily: 'inherit' }}>{lines.trim()}</pre>
              </div>
            );
          }
          return part.trim() ? (
            <div key={idx} style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
              {part.trim()}
            </div>
          ) : null;
        })}
      </div>
    );
  };

  // 1. Play Mode Selector Modal
  if (showModeModal) {
    return (
      <PlayModeModal
        isOpen={showModeModal}
        onClose={() => navigate('/games')}
        gameTitle={gameTitle}
        gameIcon={gameIcon}
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

  // 2. Social Drawer (Play with Friend)
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

  // 2. Matchmaking Lobby Overlay
  if (showMatchmaking) {
    return (
      <MatchmakingLobby
        isOpen={showMatchmaking}
        onClose={() => {
          setShowMatchmaking(false);
          setShowModeModal(true);
          setPlayMode('PRACTICE');
        }}
        gameSlug={gameSlug}
        gameTitle={gameTitle}
        mode={playMode === 'FRIEND' ? 'FRIEND' : 'RANKED'}
        friendTarget={invitedFriend}
        difficulty={difficulty || 'MEDIUM'}
        onMatchReady={handleMatchReady}
        initialMatch={playMode === 'FRIEND' ? currentMatch : null}
      />
    );
  }

  // 3. Competitive 1v1 Final Results Screen
  if (competitiveResult) {
    return (
      <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', padding: '2rem 1.5rem 4rem', position: 'relative' }}>
        <div className="paper-grain" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <CompetitiveResults
            matchResult={competitiveResult}
            currentUserId={user?.id}
            onRematch={() => {
              setCompetitiveResult(null);
              setShowModeModal(true);
            }}
            onDashboard={() => navigate('/dashboard')}
          />
        </div>
      </div>
    );
  }

  // 4. Waiting for Opponent in Competitive 1v1
  if (waitingForOpponent) {
    return (
      <div className="cosmic-void" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="paper-grain" />
        <div className="halftone-violet halftone-fade-r" style={{ position: 'absolute', top: 0, right: 0, width: '38%', height: '100%', opacity: 0.2 }} />

        <div className="zine-card" style={{ position: 'relative', zIndex: 1, padding: '2.5rem 2rem', maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '10px 10px 0 var(--riso-violet)' }}>
          <div style={{
            width: '66px',
            height: '66px',
            background: 'var(--riso-yellow)',
            border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            transform: 'rotate(4deg)'
          }}>
            <Loader2 size={30} className="zine-bounce" color="var(--ink)" />
          </div>

          <h2 className="zine-display misreg" data-text="CALCULATING RESULTS" style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', marginBottom: '0.6rem' }}>
            CALCULATING RESULTS
          </h2>

          <p style={{
            fontSize: '0.875rem',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '1.5rem'
          }}>
            Your submission has been recorded. Waiting for your opponent to complete their challenge...
          </p>

          <div style={{
            background: 'var(--paper-sunk)',
            border: '2px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            padding: '0.9rem 1rem',
            display: 'flex',
            justifyContent: 'space-around',
            gap: '0.75rem',
            flexWrap: 'wrap',
            fontSize: '0.825rem',
            fontFamily: 'var(--font-mono)',
            marginBottom: '1.25rem'
          }}>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Your Score: </span>
              <span style={{ color: 'var(--riso-teal)', fontWeight: 800 }}>{score}</span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Mistakes: </span>
              <span style={{ color: 'var(--riso-coral)', fontWeight: 800 }}>{mistakes}</span>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!currentMatch?.id) return;
              try {
                const res = await api.get(`/api/matches/${currentMatch.id}`);
                if (res.status === 200 && res.data?.status === 'FINISHED') {
                  setWaitingForOpponent(false);
                  setCompetitiveResult(res.data);
                  clearMatchStorage(currentMatch.id);
                  refreshUser();
                }
              } catch (e) {
                console.warn("Manual match status check:", e);
              }
            }}
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.825rem', padding: '0.6rem 1rem' }}
          >
            Check Status
          </button>
        </div>
      </div>
    );
  }

  // 4. Single-Player / Practice Summary Screen
  if (showComplete) {
    return (
      <GameResults
        score={score}
        total={puzzles.length}
        xpEarned={totalXP}
        onPlayAgain={() => initGameSession(difficulty || 'MEDIUM')}
        gameTitle={gameTitle}
      />
    );
  }

  // 5. Difficulty Selection Screen
  if (!difficulty) {
    return (
      <DifficultySelector
        title={gameTitle}
        subtitle={`Select challenge level to begin your ${category} training session.`}
        icon={gameIcon}
        customTiers={customDifficulties}
        loadingTier={loadingDifficulty}
        onSelectDifficulty={(diff) => initGameSession(diff)}
        onBack={() => setShowModeModal(true)}
      />
    );
  }

  // 6. Active MCQ Question Gameplay Screen
  return (
    <div className="cosmic-void" style={{ minHeight: '100vh', paddingTop: '6.5rem', position: 'relative', overflow: 'hidden' }}>
      <XPPopup popups={xpPopups} />
      <div className="paper-grain" />
      <div className="halftone-coral halftone-fade-l" style={{ position: 'absolute', top: 0, left: 0, width: '26%', height: 100, opacity: 0.22 }} />

      <ExitModal
        isOpen={showExitModal}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => navigate('/games')}
      />

      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1.5rem 4rem', position: 'relative', zIndex: 1 }}>
        {/* Progress & Header Bar */}
        <GameProgress
          current={index + 1}
          total={puzzles.length || 1}
          score={score}
          difficulty={difficulty}
          onExit={() => setShowExitModal(true)}
          formattedTime={formatted}
          urgency={urgency}
          scoreLabel="Correct"
        />

        {puzzles.length === 0 ? (
          <div className="zine-card" style={{ textAlign: 'center', padding: '4rem 2rem', boxShadow: '6px 6px 0 var(--riso-violet)' }}>
            <div className="zine-spinner" style={{ margin: '0 auto 1rem' }} />
            <p className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Synchronizing problem set...
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {puzzle && (
              <motion.div
                key={puzzle.id || index}
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

                {/* Formatted Question Body */}
                <div style={{ marginBottom: '2rem', paddingRight: '2.5rem' }}>
                  {renderFormattedQuestion(puzzle.question)}
                </div>

                {/* Four Multiple-Choice Options */}
                {!showResult ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {puzzle.options?.map((opt, optIdx) => {
                      const isSelected = selectedOption === opt;
                      const optionLetter = String.fromCharCode(65 + optIdx); // A, B, C, D

                      return (
                        <motion.button
                          key={optIdx}
                          whileHover={{ x: -2, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          type="button"
                          onClick={() => setSelectedOption(opt)}
                          className={`choice-btn${isSelected ? ' selected' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              background: isSelected ? '#fffdf6' : 'var(--paper-sunk)',
                              border: '2px solid var(--ink)',
                              color: isSelected ? 'var(--riso-violet)' : 'var(--ink)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              flexShrink: 0
                            }}
                          >
                            {optionLetter}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 700 : 600, lineHeight: 1.4 }}>
                            {opt}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : (
                  /* Post-Submission Result & Explanation Card */
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
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
                        {result === 'correct' ? 'CORRECT EVALUATION' : `INCORRECT — EXPECTED: ${puzzle.correctAnswer}`}
                      </div>
                    </div>

                    {puzzle.explanation && (
                      <div style={{ padding: '1.15rem', background: 'var(--paper-sunk)', border: '2px dashed var(--ink-faint)', marginBottom: '1.5rem' }}>
                        <p className="font-mono" style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--riso-violet)', marginBottom: '0.45rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                          Decrypted Analysis
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, fontWeight: 400, margin: 0 }}>
                          {puzzle.explanation}
                        </p>
                      </div>
                    )}

                    <button onClick={handleNext} className="btn-primary" style={{ width: '100%' }}>
                      {index + 1 >= puzzles.length ? 'VIEW FINAL CLASSIFICATION →' : 'NEXT CHALLENGE →'}
                    </button>
                  </motion.div>
                )}

                {/* Submit & Hint Actions */}
                {!showResult && (
                  <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Hint Card */}
                    <AnimatePresence>
                      {showHint && puzzle.hint && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{
                            background: 'var(--riso-yellow)',
                            border: '2px solid var(--ink)',
                            boxShadow: '3px 3px 0 var(--ink)',
                            padding: '0.9rem 1.15rem',
                            display: 'flex',
                            gap: '0.65rem',
                            alignItems: 'flex-start'
                          }}
                        >
                          <Lightbulb size={16} color="var(--ink)" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ fontSize: '0.825rem', color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>
                            {puzzle.hint}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {!showHint && puzzle.hint && (
                        <button
                          type="button"
                          onClick={() => { setShowHint(true); setHintUsed(true); }}
                          className="zine-btn-sm"
                          style={{ padding: '0.7rem 1rem' }}
                        >
                          <Lightbulb size={14} color="var(--riso-yellow)" /> HINT (-30% XP)
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={!selectedOption || showResult || !!result}
                        onClick={handleSubmit}
                        className="btn-primary"
                        style={{ flex: 1, minWidth: '180px' }}
                      >
                        CONFIRM CHOICE →
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
