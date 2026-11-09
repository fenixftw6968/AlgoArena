import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockUser, getLevelFromXP, getRankForLevel, getXPForNextLevel, getXPForCurrentLevel } from '../data/mockUser';
import api from '../utils/api';

const AuthContext = createContext(null);

const USE_MOCK = false; // Phase 3: Connect to live backend API

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const enrichUser = useCallback((u) => {
    const level = getLevelFromXP(u.xp);
    const rank  = getRankForLevel(level);
    const xpForCurrentLevel = getXPForCurrentLevel(level);
    const xpForNextLevel    = getXPForNextLevel(level);
    const xpInCurrentLevel  = u.xp - xpForCurrentLevel;
    const xpNeededForLevel  = xpForNextLevel - xpForCurrentLevel;
    const xpProgress = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100));
    return { ...u, level, rank, xpProgress, xpForNextLevel, xpForCurrentLevel };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_user');
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('mm_token');
      if (storedToken) {
        try {
          const res = await api.get('/api/users/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          const enriched = enrichUser(res.data);
          setToken(storedToken);
          setUser(enriched);
          localStorage.setItem('mm_user', JSON.stringify(enriched));
        } catch (e) {
          console.error("Token verification failed, logging out...", e);
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [enrichUser, logout]);

  const login = useCallback(async (email, password) => {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800));
      if (email && password) {
        const enriched = enrichUser(mockUser);
        const fakeToken = 'mock-jwt-token-' + Date.now();
        setUser(enriched);
        setToken(fakeToken);
        localStorage.setItem('mm_token', fakeToken);
        localStorage.setItem('mm_user', JSON.stringify(enriched));
        return { success: true };
      }
      return { success: false, error: 'Invalid credentials' };
    }

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token: jwtToken, user: userData } = res.data;
      const enriched = enrichUser(userData);
      setUser(enriched);
      setToken(jwtToken);
      localStorage.setItem('mm_token', jwtToken);
      localStorage.setItem('mm_user', JSON.stringify(enriched));
      return { success: true };
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Login failed';
      return { success: false, error: errMsg };
    }
  }, [enrichUser]);

  const signup = useCallback(async (username, email, password) => {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 1000));
      if (username && email && password) {
        const newUser = { ...mockUser, username, email, xp: 0, level: 1, coins: 0, currentStreak: 0 };
        const enriched = enrichUser(newUser);
        const fakeToken = 'mock-jwt-token-' + Date.now();
        setUser(enriched);
        setToken(fakeToken);
        localStorage.setItem('mm_token', fakeToken);
        localStorage.setItem('mm_user', JSON.stringify(enriched));
        return { success: true };
      }
      return { success: false, error: 'Please fill all fields' };
    }

    try {
      const res = await api.post('/api/auth/signup', { username, email, password });
      const { token: jwtToken, user: userData } = res.data;
      const enriched = enrichUser(userData);
      setUser(enriched);
      setToken(jwtToken);
      localStorage.setItem('mm_token', jwtToken);
      localStorage.setItem('mm_user', JSON.stringify(enriched));
      return { success: true };
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Signup failed';
      return { success: false, error: errMsg };
    }
  }, [enrichUser]);

  const loginWithGoogle = useCallback(async (googleData) => {
    try {
      const res = await api.post('/api/auth/google', googleData);
      const { token: jwtToken, user: userData } = res.data;
      const enriched = enrichUser(userData);
      setUser(enriched);
      setToken(jwtToken);
      localStorage.setItem('mm_token', jwtToken);
      localStorage.setItem('mm_user', JSON.stringify(enriched));
      return { success: true, user: enriched };
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Google authentication failed';
      return { success: false, error: errMsg };
    }
  }, [enrichUser]);

  const refreshUser = useCallback(async (updatedUser) => {
    if (updatedUser) {
      const enriched = enrichUser(updatedUser);
      setUser(enriched);
      localStorage.setItem('mm_user', JSON.stringify(enriched));
    } else {
      try {
        const res = await api.get('/api/users/me');
        if (res.data) {
          const enriched = enrichUser(res.data);
          setUser(enriched);
          localStorage.setItem('mm_user', JSON.stringify(enriched));
        }
      } catch (e) {
        console.warn("Failed to refresh user profile from backend:", e);
      }
    }
  }, [enrichUser]);

  const addXP = useCallback((amount) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = enrichUser({ ...prev, xp: prev.xp + amount });
      localStorage.setItem('mm_user', JSON.stringify(updated));
      return updated;
    });
  }, [enrichUser]);

  const addCoins = useCallback((amount) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, coins: prev.coins + amount };
      localStorage.setItem('mm_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const incrementGamesCompleted = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, gamesCompleted: (prev.gamesCompleted || 0) + 1 };
      localStorage.setItem('mm_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      signup,
      loginWithGoogle,
      logout,
      refreshUser,
      addXP,
      addCoins,
      incrementGamesCompleted,
      enrichUser,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
