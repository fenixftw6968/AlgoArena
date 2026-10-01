import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Flame, Coins, LogOut, ChevronDown, Users, User } from 'lucide-react';
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
    { to: '/games',           label: 'Games' },
    { to: '/daily-challenge', label: 'Challenges' },
    { to: '/leaderboard',     label: 'Progress' },
    { to: '/profile',         label: 'Profile' },
  ];

  const isActive = (to) => location.pathname === to;
  const currentRank = getRankFromRating(user?.competitiveRating || 500);

  return (
    <>
      {/* ============ PRINT-SHOP MASTHEAD ============ */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        pointerEvents: 'none'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1240px',
          margin: '0.85rem auto 0',
          padding: '0 0.75rem',
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'var(--paper-card)',
            border: '3px solid var(--ink)',
            boxShadow: '6px 6px 0 var(--ink)',
            height: '56px',
            padding: '0 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            position: 'relative'
          }}>
            <div className="halftone-violet halftone-fade-l" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, opacity: 0.35 }} />

            {/* Left: Brand + Desktop Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
              <Link to={isAuthenticated ? '/dashboard' : '/'} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  background: 'var(--riso-violet)',
                  border: '2px solid var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'rotate(-3deg)',
                  flexShrink: 0
                }}>
                  <Brain size={17} color="#fffdf6" />
                </div>
                <span className="zine-display" style={{ fontSize: '0.95rem' }}>
                  Algo<span style={{ color: 'var(--riso-coral)' }}>Arena</span>
                </span>
              </Link>

              {isAuthenticated && (
                <div className="hidden md:flex" style={{ display: 'flex', gap: '0.15rem', alignItems: 'center' }}>
                  {navLinks.map(link => {
                    const active = isActive(link.to);
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="zine-btn-sm"
                        style={{
                          background: active ? 'var(--ink)' : 'transparent',
                          color: active ? 'var(--paper)' : 'var(--ink)',
                          boxShadow: active ? '3px 3px 0 var(--riso-coral)' : 'none',
                          transform: active ? 'translate(-1px, -1px)' : 'none',
                        }}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: User Stats & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', position: 'relative' }}>
              {isAuthenticated && user ? (
                <>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <div className="zine-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--riso-violet)', color: '#fffdf6' }}>
                      <span style={{ fontSize: '0.8rem' }}>{currentRank.badge}</span>
                      <span>{user.competitiveRating || 500}</span>
                    </div>
                    <div className="zine-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--riso-yellow)' }}>
                      <Coins size={11} />
                      <span>{user.coins}</span>
                    </div>
                    <div className="zine-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--riso-teal)', color: '#fffdf6' }}>
                      <Flame size={11} />
                      <span>{user.currentStreak}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSocialOpen(true)}
                    title="Friends & Social"
                    className="zine-btn-sm"
                  >
                    <Users size={13} />
                  </button>

                  {/* User menu dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="zine-btn-sm"
                      style={{ paddingLeft: '0.3rem', background: 'var(--paper-card)' }}
                    >
                      <div style={{
                        width: '22px',
                        height: '22px',
                        background: 'var(--riso-coral)',
                        color: '#fffdf6',
                        border: '2px solid var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 800
                      }}>
                        {user.username?.[0]?.toUpperCase()}
                      </div>
                      <span>{user.username}</span>
                      <ChevronDown size={12} style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.12 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            background: 'var(--paper-card)',
                            border: '3px solid var(--ink)',
                            boxShadow: '5px 5px 0 var(--ink)',
                            padding: '0.35rem',
                            minWidth: '170px',
                            zIndex: 200,
                          }}
                        >
                          <Link
                            to="/profile"
                            onClick={() => setUserMenuOpen(false)}
                            className="zine-btn-sm"
                            style={{ width: '100%', justifyContent: 'flex-start', boxShadow: 'none', border: 'none', background: 'transparent', padding: '0.5rem 0.6rem', textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}
                          >
                            <User size={13} /> Profile
                          </Link>
                          <button
                            onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                            className="zine-btn-sm"
                            style={{ width: '100%', justifyContent: 'flex-start', boxShadow: 'none', border: 'none', background: 'transparent', padding: '0.5rem 0.6rem', color: 'var(--riso-coral)', textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}
                          >
                            <LogOut size={13} /> Log Out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <Link to="/login" className="zine-btn-sm" style={{ padding: '0.45rem 0.9rem' }}>
                    Log In
                  </Link>
                  <Link to="/signup" className="zine-btn-sm zine-btn-sm--coral" style={{ padding: '0.45rem 0.9rem' }}>
                    Join
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Incoming Friend Match Invitation Popup */}
      <IncomingInviteModal
        invite={pendingInvite}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
      />

      {/* Friends & Social Drawer */}
      <SocialDrawer
        isOpen={socialOpen}
        onClose={() => setSocialOpen(false)}
        onInviteFriendToGame={() => {
          setSocialOpen(false);
          navigate('/games');
        }}
      />
    </>
  );
}
