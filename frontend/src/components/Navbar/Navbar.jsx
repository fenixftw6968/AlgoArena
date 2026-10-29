import { Link, useNavigate, useLocation } from 'react-router-dom';
import { COMPETITION_ENABLED } from '../../utils/competitionConfig';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Flame, LogOut, Menu, Swords, User, Users, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getRankFromRating } from '../../utils/rankUtils';
import SocialDrawer from '../SocialDrawer/SocialDrawer';
import IncomingInviteModal from '../IncomingInviteModal/IncomingInviteModal';
import { useUserInvitationsSocket } from '../../hooks/useUserInvitationsSocket';
import api from '../../utils/api';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [processingInviteId, setProcessingInviteId] = useState(null);
  const acceptedInviteIdsRef = useRef(new Set());

  // Real-time WebSocket listener for invitations to this user
  useUserInvitationsSocket(user?.id, (event) => {
    if (event.type === 'NEW_INVITATION') {
      const inviteId = event.data?.id;
      if (inviteId && !acceptedInviteIdsRef.current.has(inviteId) && processingInviteId !== inviteId) {
        setPendingInvite(event.data);
      }
    } else if (event.type === 'INVITATION_CANCELLED' || event.type === 'INVITATION_DECLINED' || event.type === 'INVITATION_ACCEPTED') {
      setPendingInvite(prev => (prev?.id === event.data?.id ? null : prev));
    }
  });

  // Initial check on mount + fallback check every 10s
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    const checkInvites = async () => {
      if (processingInviteId) return;
      try {
        const res = await api.get('/api/matches/invitations/pending');
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const invite = res.data[0];
          if (invite.id && !acceptedInviteIdsRef.current.has(invite.id) && invite.id !== processingInviteId) {
            setPendingInvite(invite);
          }
        } else if (isMounted) {
          setPendingInvite(null);
        }
      } catch (e) {
        // Silently catch error
      }
    };

    checkInvites();
    const interval = setInterval(checkInvites, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, processingInviteId]);

  // Close menus on navigation
  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleAcceptInvite = async (invite) => {
    if (!invite?.id) return;
    acceptedInviteIdsRef.current.add(invite.id);
    setProcessingInviteId(invite.id);
    setPendingInvite(null);
    try {
      const res = await api.post(`/api/matches/${invite.id}/accept`);
      navigate(`/games/${invite.gameSlug}`, { state: { acceptedMatch: res.data } });
    } catch (e) {
      console.error("Failed to accept invite", e);
    } finally {
      setTimeout(() => {
        setProcessingInviteId(null);
      }, 2000);
    }
  };

  const handleDeclineInvite = async (invite) => {
    if (!invite?.id) return;
    acceptedInviteIdsRef.current.add(invite.id);
    setProcessingInviteId(invite.id);
    setPendingInvite(null);
    try {
      await api.post(`/api/matches/${invite.id}/decline`);
    } catch (e) {
      console.error("Failed to decline invite", e);
    } finally {
      setTimeout(() => {
        setProcessingInviteId(null);
      }, 2000);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { to: '/dashboard',       label: 'Dashboard' },
    { to: '/games',           label: 'Arena' },
    { to: '/daily-challenge', label: 'Daily' },
    ...(COMPETITION_ENABLED ? [{ to: '/competitions', label: 'Showdown' }] : []),
    { to: '/leaderboard',     label: 'Leaderboard' },
    { to: '/profile',         label: 'Profile' },
  ];

  const isActive = (to) => location.pathname === to;
  const currentRank = getRankFromRating(user?.competitiveRating || 500);

  return (
    <>
      <header className="nav-root">
        <div className="nav-inner">
          {/* Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="nav-brand">
            <span className="nav-brand-mark" style={{ background: 'linear-gradient(135deg, #4f7cff, #8b5cf6)', border: '1px solid rgba(255,255,255,0.16)' }}>
              <img src="/logo-icon.png" alt="AlgoArena" style={{ width: 16, height: 16, objectFit: 'contain' }} />
            </span>
            <span className="nav-brand-name">AlgoArena</span>
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && (
            <nav className="nav-links" aria-label="Primary">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link${isActive(link.to) ? ' nav-link--active' : ''}`}
                  aria-current={isActive(link.to) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className="nav-actions">
            {isAuthenticated && user ? (
              <>
                <div className="nav-stats" aria-label="Player stats">
                  <span className="nav-stat" title="Rating">
                    <Swords size={13} />
                    <span className="mono">{user.competitiveRating || 500}</span>
                  </span>
                  <span className="nav-stat" title="Coins">
                    <Coins size={13} />
                    <span className="mono">{user.coins ?? 0}</span>
                  </span>
                  <span className="nav-stat" title="Streak">
                    <Flame size={13} />
                    <span className="mono">{user.currentStreak ?? 0}</span>
                  </span>
                </div>

                <button
                  onClick={() => setSocialOpen(true)}
                  title="Friends & social"
                  aria-label="Friends and social"
                  className="nav-icon-btn"
                >
                  <Users size={15} />
                </button>

                <div className="nav-menu-wrap">
                  <button
                    onClick={() => setUserMenuOpen(v => !v)}
                    className="nav-user-btn"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                  >
                    <span className="nav-user-avatar">{user.username?.[0]?.toUpperCase()}</span>
                    <span className="nav-user-name truncate">{user.username}</span>
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="nav-dropdown"
                        role="menu"
                      >
                        <div className="nav-dropdown-head">
                          <div className="nav-dropdown-name truncate">{user.username}</div>
                          <div className="nav-dropdown-meta mono">
                            {currentRank.name} · {user.competitiveRating || 500} · Lv {user.level || 1}
                          </div>
                        </div>
                        <div className="nav-dropdown-sep" />
                        <Link to="/profile" className="nav-dropdown-item" role="menuitem">
                          <User size={14} /> Profile
                        </Link>
                        <Link to="/leaderboard" className="nav-dropdown-item" role="menuitem">
                          <Swords size={14} /> Leaderboard
                        </Link>
                        <div className="nav-dropdown-sep" />
                        <button
                          onClick={handleLogout}
                          className="nav-dropdown-item nav-dropdown-item--danger"
                          role="menuitem"
                        >
                          <LogOut size={14} /> Log out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  className="nav-icon-btn nav-icon-btn--mobile"
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                </button>
              </>
            ) : (
              <div className="nav-auth">
                <Link to="/login" className="nav-link">Log in</Link>
                <Link to="/signup" className="btn btn--primary btn--sm">Create account</Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isAuthenticated && mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="nav-mobile"
              aria-label="Mobile navigation"
            >
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-mobile-link${isActive(link.to) ? ' nav-mobile-link--active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="nav-mobile-sep" />
              <button onClick={handleLogout} className="nav-mobile-link nav-mobile-link--danger">
                <LogOut size={14} /> Log out
              </button>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Incoming friend match invitation popup */}
      <IncomingInviteModal
        invite={pendingInvite}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
      />

      {/* Friends & social drawer */}
      <SocialDrawer
        isOpen={socialOpen}
        onClose={() => setSocialOpen(false)}
        onInviteFriendToGame={() => {
          setSocialOpen(false);
          navigate('/games');
        }}
      />

      <style>{`
        .nav-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(7, 9, 14, 0.78);
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          box-shadow: 0 12px 40px -24px rgba(0, 0, 0, 0.9);
        }
        .nav-inner {
          max-width: min(96vw, 1840px);
          margin: 0 auto;
          height: 68px;
          padding: 0 clamp(32px, 5vw, 88px);
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .nav-brand {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          text-decoration: none;
          color: var(--ink);
          flex-shrink: 0;
        }
        .nav-brand-mark {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent-gradient);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 22px -6px var(--accent-glow);
        }
        .nav-brand-name {
          font-size: 1.05rem;
          font-weight: 650;
          letter-spacing: -0.02em;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 8px 15px;
          border-radius: 8px;
          font-size: 0.92rem;
          font-weight: 450;
          color: var(--ink-muted);
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .nav-link:hover { color: var(--ink); background: rgba(255, 255, 255, 0.05); }
        .nav-link--active {
          color: #dbe6ff;
          font-weight: 600;
          background: rgba(91, 140, 255, 0.14);
          box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.28);
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .nav-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-right: 16px;
          border-right: 1px solid var(--border);
        }
        .nav-stat {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.88rem;
          color: var(--ink-muted);
        }
        .nav-stat .mono { color: var(--ink-soft); font-size: 0.84rem; }
        .nav-icon-btn {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--ink-soft);
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }
        .nav-icon-btn:hover { border-color: rgba(91, 140, 255, 0.5); color: var(--accent); background: var(--surface-3); }
        .nav-icon-btn--mobile { display: none; }
        .nav-menu-wrap { position: relative; }
        .nav-user-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px 0 4px;
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--ink);
          font-size: 0.83rem;
          font-weight: 500;
          cursor: pointer;
          max-width: 190px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .nav-user-btn:hover { border-color: rgba(91, 140, 255, 0.5); background: var(--surface-3); }
        .nav-user-avatar {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(91, 140, 255, 0.16);
          border: 1px solid rgba(91, 140, 255, 0.35);
          color: #a9c1ff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 600;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }
        .nav-user-name { max-width: 110px; }
        .nav-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01)),
            var(--surface);
          border: 1px solid rgba(91, 140, 255, 0.22);
          border-radius: 12px;
          padding: 6px;
          z-index: 200;
          box-shadow: var(--shadow-lg), 0 0 50px -24px var(--accent-glow);
        }
        .nav-dropdown-head { padding: 10px 10px 8px; }
        .nav-dropdown-name { font-size: 0.85rem; font-weight: 600; color: var(--ink); }
        .nav-dropdown-meta { font-size: 0.7rem; color: var(--ink-muted); margin-top: 2px; }
        .nav-dropdown-sep { height: 1px; background: var(--border); margin: 5px 4px; }
        .nav-dropdown-item {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--ink-soft);
          font-size: 0.84rem;
          font-weight: 450;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .nav-dropdown-item:hover { background: var(--surface-2); color: var(--ink); }
        .nav-dropdown-item--danger { color: var(--err); }
        .nav-dropdown-item--danger:hover { background: var(--err-soft); color: var(--err); }
        .nav-auth { display: flex; align-items: center; gap: 12px; }
        .nav-mobile {
          display: none;
          border-top: 1px solid var(--border);
          background: rgba(13, 17, 25, 0.98);
          backdrop-filter: blur(18px);
          padding: 10px 16px 14px;
        }
        .nav-mobile-link {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 11px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--ink-soft);
          font-size: 0.88rem;
          text-decoration: none;
          cursor: pointer;
        }
        .nav-mobile-link:hover { background: var(--surface-2); color: var(--ink); }
        .nav-mobile-link--active { color: var(--ink); font-weight: 550; }
        .nav-mobile-link--danger { color: var(--err); }
        .nav-mobile-sep { height: 1px; background: var(--border); margin: 6px 0; }

        @media (max-width: 1024px) {
          .nav-links { display: none; }
          .nav-icon-btn--mobile { display: inline-flex; }
          .nav-mobile { display: block; }
        }
        @media (max-width: 560px) {
          .nav-inner { padding: 0 16px; gap: 12px; }
          .nav-stats { display: none; }
          .nav-user-name { display: none; }
          .nav-user-btn { padding: 0 4px; }
        }
      `}</style>
    </>
  );
}
