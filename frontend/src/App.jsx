import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import GuestRoute from './components/GuestRoute/GuestRoute';

// Pages
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Signup from './pages/Signup/Signup';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Games from './pages/Games/Games';
import Profile from './pages/Profile/Profile';
import Leaderboard from './pages/Leaderboard/Leaderboard';
import DailyChallenge from './pages/DailyChallenge/DailyChallenge';
import CompetitionHome from './pages/Competition/CompetitionHome';
import CompetitionRoom from './pages/Competition/CompetitionRoom';
import { COMPETITION_ENABLED } from './utils/competitionConfig';

// Game pages
import DsaMasterQuiz from './pages/Games/DsaMasterQuiz';
import LogicPuzzle from './pages/Games/LogicPuzzle';
import NumberDetective from './pages/Games/NumberDetective';
import CodeBreaker from './pages/Games/CodeBreaker';



export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <Navbar />
          <Routes>
            {/* Public */}
            <Route path="/"                element={<Home />} />
            <Route path="/login"           element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup"          element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
            <Route path="/reset-password"  element={<GuestRoute><ResetPassword /></GuestRoute>} />

            {/* Protected */}
            <Route path="/dashboard"       element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/games"           element={<ProtectedRoute><Games /></ProtectedRoute>} />
            <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/leaderboard"     element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/daily-challenge" element={<ProtectedRoute><DailyChallenge /></ProtectedRoute>} />

            {/* DSA competition (opt-in via VITE_COMPETITION_ENABLED) */}
            {COMPETITION_ENABLED && (
              <>
                <Route path="/competitions"     element={<ProtectedRoute><CompetitionHome /></ProtectedRoute>} />
                <Route path="/competitions/:id" element={<ProtectedRoute><CompetitionRoom /></ProtectedRoute>} />
              </>
            )}

            {/* Game routes */}
            <Route path="/games/dsa-master-quiz"    element={<ProtectedRoute><DsaMasterQuiz /></ProtectedRoute>} />
            <Route path="/games/logic-puzzle"       element={<ProtectedRoute><LogicPuzzle /></ProtectedRoute>} />
            <Route path="/games/number-detective"   element={<ProtectedRoute><NumberDetective /></ProtectedRoute>} />
            <Route path="/games/code-breaker"       element={<ProtectedRoute><CodeBreaker /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
