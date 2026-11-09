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
import { selectQuestionsForGame } from '../../services/questionHistoryService';
import { balanceAndRandomizeQuestionOptions, createSeededRandom } from '../../utils/optionRandomizer';
import { shuffleArray } from '../../utils/shuffleQuestions';
import api from '../../utils/api';
import { submitMatchAnswer, describeAnswerError } from '../../services/matchAnswerService';
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
  codeLanguage: _codeLanguage = 'cpp',
  questionCount = null,
  directPlay = true
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

  const isSubmittingRef = useRef(false);
  const [serverFeedback, setServerFeedback] = useState(null); // server grading of the current question (match mode)
  const [gradingError, setGradingError] = useState('');
  const pendingAnswerRef = useRef(null);
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
    if (currentMatch && currentMatch.id) {
      // A timeout is recorded on the server as a wrong answer, in order.
      pendingAnswerRef.current = submitMatchAnswer(currentMatch.id, index, null)
        .then((fb) => setServerFeedback(fb))
        .catch(() => {});
    }
  };

  // Setup question timer
  const puzzle = puzzles[index];
  const { timeLeft, formattedTime, urgency, reset, start, pause } = useTimer(
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
  }, [gameSlug, questionBank, targetCount, reset, start]);

  // Submit selected option (Protected against duplicate triggers)
  const handleSubmit = async () => {
    if (isSubmittingRef.current || showResult || result || !selectedOption || !puzzle) return;
    isSubmittingRef.current = true;
    pause();
    const inMatch = !!(currentMatch && currentMatch.id);
    let isCorrect = false;
    if (inMatch) {
      // Match mode: the SERVER grades the answer (the client never holds the right answer).
      try {
        const feedback = await submitMatchAnswer(currentMatch.id, index, selectedOption);
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
      const targetAns = (puzzle.correctAnswer || puzzle.answer || '').trim().toLowerCase();
      const chosen = (selectedOption || '').trim().toLowerCase();
      isCorrect = chosen === targetAns;

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
    }
    const currentDiff = (puzzle.difficulty || difficulty || 'MEDIUM').toUpperCase();
    const baseXP = XP_PER_DIFFICULTY[currentDiff] || 30;
    const earnedXP = isCorrect ? (hintUsed ? Math.round(baseXP * 0.7) : baseXP) : 0;

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
    if (pendingAnswerRef.current) {
      try { await pendingAnswerRef.current; } finally { pendingAnswerRef.current = null; }
    }
    setServerFeedback(null);
    setGradingError('');
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
    setServerFeedback(null);
    setGradingError('');
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
      return <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>{text}</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
        {parts.map((part, idx) => {
          if (idx % 2 === 1) {
            const lines = part.replace(/^cpp\n|^c\n|^python\n|^java\n/, '');
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '2px solid #0A0A0A',
                  boxShadow: '3px 3px 0px #0A0A0A',
                  borderRadius: '0px',
                  padding: '1.25rem 1.4rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  color: 'var(--ink)',
                  lineHeight: 1.55,
                  overflowX: 'auto',
                  position: 'relative'
                }}
              >
                <span className="zine-badge" style={{ position: 'absolute', top: '-11px', left: '12px', background: 'var(--accent)', color: '#0A0A0A' }}>CODE</span>
                <pre style={{ margin: 0, fontFamily: 'inherit' }}>{lines.trim()}</pre>
              </div>
            );
          }
          return part.trim() ? (
            <div key={idx} style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>
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
            if (directPlay) {
              initGameSession('all');
            } else {
              setDifficulty(null);
            }
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
      <div style={{ minHeight: '100vh', paddingTop: '52px', padding: '2rem 1.5rem 4rem' }}>
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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}>
        <div className="card" style={{ padding: '28px 24px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: 'var(--ink)'
          }}>
            <Loader2 size={20} className="zine-bounce" />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 650, letterSpacing: '-0.02em', marginBottom: '0.4rem', color: 'var(--ink)' }}>
            Calculating Results
          </h2>

          <p style={{
            fontSize: '0.8125rem',
            color: 'var(--ink-muted)',
            marginBottom: '1.25rem',
            lineHeight: 1.5
          }}>
            Your submission has been verified. Waiting for opponent…
          </p>

          <div style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-around',
            gap: '0.75rem',
            fontSize: '0.78125rem',
            marginBottom: '1.25rem'
          }}>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Score: </span>
              <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{score}</span>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Mistakes: </span>
              <span className="mono" style={{ color: 'var(--err)', fontWeight: 600 }}>{mistakes}</span>
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
            className="btn btn--secondary btn--sm"
            style={{ width: '100%' }}
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
        ratingEarned={score * 5}
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
    <div style={{ minHeight: '100vh', paddingTop: '52px' }}>
      <XPPopup popups={xpPopups} />

      <ExitModal
        isOpen={showExitModal}
        onCancel={() => setShowExitModal(false)}
        onConfirm={() => navigate('/games')}
      />

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>
        {/* Progress & Header Bar */}
        <GameProgress
          current={index + 1}
          total={puzzles.length || 1}
          score={score}
          difficulty={difficulty}
          onExit={() => setShowExitModal(true)}
          formattedTime={formattedTime}
          urgency={urgency}
          scoreLabel="Correct"
        />

        {puzzles.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
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
                className="card"
                style={{
                  padding: '2.5rem 2.75rem',
                  marginBottom: '1.5rem',
                  position: 'relative',
                  borderRadius: '18px'
                }}
              >
                <span className="font-mono" style={{ position: 'absolute', top: 16, right: 20, fontSize: '0.7rem', fontWeight: 700, color: 'var(--ink-faint)', letterSpacing: '0.18em' }}>
                  Q{String(index + 1).padStart(2, '0')}
                </span>

                {/* Formatted Question Body */}
                <div style={{ marginBottom: '2.5rem', paddingRight: '2.5rem' }}>
                  {renderFormattedQuestion(puzzle.question)}
                </div>

                {/* Four Multiple-Choice Options */}
                {!showResult ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
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
                          style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', padding: '16px 20px' }}
                        >
                          <span
                            style={{
                              width: '36px',
                              height: '36px',
                              background: isSelected ? '#B9FF66' : 'var(--surface-subtle)',
                              border: '2px solid #0A0A0A',
                              boxShadow: '2px 2px 0px #0A0A0A',
                              borderRadius: '0px',
                              color: '#0A0A0A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              flexShrink: 0
                            }}
                          >
                            {optionLetter}
                          </span>
                          <span style={{ fontSize: '1.05rem', fontWeight: isSelected ? 700 : 550, lineHeight: 1.45 }}>
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
                        background: result === 'correct' ? 'var(--accent)' : '#0A0A0A',
                        color: result === 'correct' ? 'var(--ink)' : '#FFFFFF',
                        border: '3px solid #0A0A0A',
                        boxShadow: result === 'correct' ? '3px 3px 0px #0A0A0A' : '3px 3px 0px var(--accent)',
                        borderRadius: '0px',
                        marginBottom: '1.25rem'
                      }}
                    >
                      {result === 'correct' ? <CheckCircle size={22} /> : <XCircle size={22} />}
                      <div style={{ fontWeight: 650, fontSize: '0.9rem' }}>
                        {result === 'correct' ? 'Correct answer' : `Incorrect — expected: ${serverFeedback?.correctAnswer ?? puzzle.correctAnswer}`}
                      </div>
                    </div>

                    {(serverFeedback?.explanation ?? puzzle.explanation) && (
                      <div style={{ padding: '1.15rem', background: 'var(--surface-subtle)', border: '2px dashed var(--border-strong)', borderRadius: '0px', marginBottom: '1.5rem' }}>
                        <p className="font-mono" style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--accent-ink)', marginBottom: '0.45rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                          Explanation
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, fontWeight: 400, margin: 0 }}>
                          {serverFeedback?.explanation ?? puzzle.explanation}
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
                            background: 'var(--accent-subtle)',
                            border: '2px dashed #0A0A0A',
                            borderRadius: '0px',
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
                          <Lightbulb size={14} color="var(--ink)" /> Hint (-30% XP)
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
      {gradingError && (
        <div role="alert" style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--accent)', color: 'var(--ink)', border: '2px solid #0A0A0A', borderRadius: '0px', boxShadow: '4px 4px 0px #0A0A0A', padding: '0.6rem 1rem', fontWeight: 700 }}>
          {gradingError}
        </div>
      )}
    </div>
  );
}
