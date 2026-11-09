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
      } catch {
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
    ...(COMPETITION_ENABLED ? [{ to: '/competitions', label: 'Custom' }] : []),
    { to: '/leaderboard',     label: 'Leaderboard' },
    { to: '/profile',         label: 'Profile' },
  ];

  const isActive = (to) => {
    if (to === '/games') return location.pathname.startsWith('/games');
    if (to === '/competitions') return location.pathname.startsWith('/competitions');
    return location.pathname === to;
  };
  const currentRank = getRankFromRating(user?.competitiveRating || 500);

  return (
    <>
      <header className="nav-root">
        <div className="nav-inner">
          {/* Brand */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="nav-brand">
            <span className="nav-brand-mark">
              <span className="nav-brand-dot" />
            </span>
            <span className="nav-brand-name">AlgoArena</span>
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && (
            <nav className="nav-links" aria-label="Primary">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link${isActive(to) ? ' nav-link--active' : ''}`}
                >
                  {label}
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
                    <Swords size={12} className="nav-stat-icon" />
                    <span className="mono nav-stat-val">{user.competitiveRating || 500}</span>
                  </span>
                  <span className="nav-stat" title="Coins">
                    <Coins size={12} className="nav-stat-icon" />
                    <span className="mono nav-stat-val">{user.coins ?? 0}</span>
                  </span>
                  <span className="nav-stat" title="Streak">
                    <Flame size={12} className="nav-stat-icon" />
                    <span className="mono nav-stat-val">{user.currentStreak ?? 0}d</span>
                  </span>
                </div>

                <button
                  onClick={() => setSocialOpen(true)}
                  title="Friends & social"
                  aria-label="Friends and social"
                  className="nav-icon-btn"
                >
                  <Users size={14} />
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
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="nav-dropdown"
                        role="menu"
                      >
                        <div className="nav-dropdown-head">
                          <div className="nav-dropdown-name truncate">{user.username}</div>
                          <div className="nav-dropdown-meta mono">
                            {currentRank.name} · {user.competitiveRating ?? 101} Rating
                          </div>
                        </div>
                        <div className="nav-dropdown-sep" />
                        <Link to="/profile" className="nav-dropdown-item" role="menuitem">
                          <User size={13} /> Profile
                        </Link>
                        <Link to="/leaderboard" className="nav-dropdown-item" role="menuitem">
                          <Swords size={13} /> Leaderboard
                        </Link>
                        <div className="nav-dropdown-sep" />
                        <button
                          onClick={handleLogout}
                          className="nav-dropdown-item nav-dropdown-item--danger"
                          role="menuitem"
                        >
                          <LogOut size={13} /> Log out
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
                  {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
                </button>
              </>
            ) : (
              <div className="nav-auth">
                <Link to="/login" className="nav-link">Log in</Link>
                <Link to="/signup" className="btn btn--primary btn--sm">Sign up</Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isAuthenticated && mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="nav-mobile"
              aria-label="Mobile navigation"
            >
              <div className="nav-mobile-links">
                {navLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`nav-mobile-link${isActive(to) ? ' nav-mobile-link--active' : ''}`}
                  >
                    {label}
                  </Link>
                ))}
                <div className="nav-dropdown-sep" />
                <button
                  onClick={handleLogout}
                  className="nav-mobile-link nav-mobile-link--danger"
                >
                  <LogOut size={14} /> Log out
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Social Drawer */}
      <SocialDrawer
        isOpen={socialOpen}
        onClose={() => setSocialOpen(false)}
        onInviteFriendToGame={(friend) => {
          setSocialOpen(false);
          navigate('/games', { state: { inviteFriend: friend } });
        }}
      />

      {/* Incoming Invite Notification Modal */}
      {pendingInvite && (
        <IncomingInviteModal
          invite={pendingInvite}
          onAccept={() => handleAcceptInvite(pendingInvite)}
          onDecline={() => handleDeclineInvite(pendingInvite)}
        />
      )}

      <style>{`
        .nav-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: #FFFFFF;
          border-bottom: 3px solid #0A0A0A;
          height: 54px;
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          height: 100%;
          padding: 0 clamp(16px, 3vw, 32px);
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ink);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.05rem;
          text-transform: uppercase;
          letter-spacing: -0.01em;
          text-decoration: none;
          flex-shrink: 0;
        }

        .nav-brand-mark {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-xs);
          background: var(--accent);
          border: 2px solid #0A0A0A;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-4deg);
          transition: transform 0.12s ease;
          box-shadow: 2px 2px 0px #0A0A0A;
        }

        .nav-brand:hover .nav-brand-mark {
          transform: rotate(4deg);
        }

        .nav-brand-dot {
          width: 8px;
          height: 8px;
          background: #0A0A0A;
        }

        .nav-brand-name {
          color: #0A0A0A;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 5px 11px;
          border-radius: var(--radius-xs);
          font-family: var(--font-mono);
          font-size: 0.8125rem;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--ink-muted);
          text-decoration: none;
          white-space: nowrap;
          border: 2px solid transparent;
          transition: all 0.1s ease;
        }

        .nav-link:hover {
          color: #0A0A0A;
          background: var(--surface-subtle);
          border-color: #0A0A0A;
        }

        .nav-link--active {
          color: #0A0A0A;
          font-weight: 800;
          background: var(--accent);
          border: 2px solid #0A0A0A;
          box-shadow: 2px 2px 0px #0A0A0A;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }

        .nav-stats {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-right: 12px;
          border-right: 2px solid #0A0A0A;
        }

        .nav-stat {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.8125rem;
          color: var(--ink-muted);
        }

        .nav-stat-icon {
          color: #0A0A0A;
        }

        .nav-stat-val {
          color: var(--ink);
          font-size: 0.78125rem;
          font-weight: 800;
        }

        .nav-icon-btn {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0A0A0A;
          border-radius: var(--radius-sm);
          background: #FFFFFF;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
          box-shadow: 2px 2px 0px #0A0A0A;
        }

        .nav-icon-btn:hover {
          background: #0A0A0A;
          color: var(--accent);
        }

        .nav-icon-btn:active {
          transform: translate(2px, 2px);
          box-shadow: 0px 0px 0px #0A0A0A;
        }

        .nav-icon-btn--mobile {
          display: none;
        }

        .nav-menu-wrap {
          position: relative;
        }

        .nav-user-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 0 8px 0 3px;
          border: 2px solid #0A0A0A;
          border-radius: var(--radius-sm);
          background: #FFFFFF;
          color: var(--ink);
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 2px 2px 0px #0A0A0A;
          transition: background 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
        }

        .nav-user-btn:hover {
          background: var(--accent-subtle);
        }

        .nav-user-btn:active {
          transform: translate(2px, 2px);
          box-shadow: 0px 0px 0px #0A0A0A;
        }

        .nav-user-avatar {
          width: 22px;
          height: 22px;
          border-radius: var(--radius-xs);
          background: var(--accent);
          border: 2px solid #0A0A0A;
          color: #0A0A0A;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.625rem;
          font-weight: 800;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }

        .nav-user-name {
          max-width: 90px;
        }

        .nav-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 200px;
          background: #FFFFFF;
          border: 2px solid #0A0A0A;
          border-radius: var(--radius-sm);
          box-shadow: 5px 5px 0px #0A0A0A;
          padding: 4px;
          z-index: 60;
        }

        .nav-dropdown-head {
          padding: 8px 10px;
        }

        .nav-dropdown-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--ink);
        }

        .nav-dropdown-meta {
          font-size: 0.6875rem;
          color: var(--accent-ink);
          margin-top: 2px;
          font-weight: 700;
        }

        .nav-dropdown-sep {
          height: 2px;
          background: var(--border-subtle);
          margin: 4px 0;
        }

        .nav-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          border: 2px solid transparent;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--ink);
          text-decoration: none;
          background: transparent;
          border-radius: var(--radius-xs);
          cursor: pointer;
          text-align: left;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .nav-dropdown-item:hover {
          background: var(--accent);
          border-color: #0A0A0A;
          color: #0A0A0A;
        }

        .nav-dropdown-item--danger {
          color: var(--ink);
        }

        .nav-dropdown-item--danger:hover {
          background: #0A0A0A;
          color: #FFFFFF;
        }

        .nav-auth {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-mobile {
          background: #FFFFFF;
          border-bottom: 3px solid #0A0A0A;
          overflow: hidden;
        }

        .nav-mobile-links {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .nav-mobile-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 2px solid transparent;
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--ink);
          text-decoration: none;
        }

        .nav-mobile-link:hover {
          background: var(--surface-subtle);
          border-color: #0A0A0A;
        }

        .nav-mobile-link--active {
          background: var(--accent);
          border-color: #0A0A0A;
          color: #0A0A0A;
          font-weight: 800;
        }

        .nav-mobile-link--danger {
          color: var(--ink);
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }

        .nav-mobile-link--danger:hover {
          background: #0A0A0A;
          color: #FFFFFF;
        }

        @media (max-width: 820px) {
          .nav-links,
          .nav-stats {
            display: none;
          }
          .nav-icon-btn--mobile {
            display: inline-flex;
          }
        }
      `}</style>
    </>
  );
}
