import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Flame,
  Coins,
  Sparkles,
  KeyRound,
  Zap,
  Users,
  Swords,
  UserPlus,
  Check,
  Code2,
  Puzzle,
  Hash,
  Eye,
  ArrowRight,
  ArrowUpRight,
  Trophy,
  Ticket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import SocialDrawer from '../../components/SocialDrawer/SocialDrawer';
import { getRankForLevel, getXPForNextLevel, getXPForCurrentLevel } from '../../data/mockUser';
import { getRankFromRating, getNextRank, getRankProgress } from '../../utils/rankUtils';
import { getDailyCountdown, subscribeToMidnightIST } from '../../services/dailyQuestionService';
import api from '../../utils/api';
import './Dashboard.css';

const SLUG_ICONS = {
  'dsa-master-quiz': Code2,
  'logic-puzzle': Puzzle,
  'brain-teaser-battle': Sparkles,
  'number-detective': Hash,
  'memory-challenge': Eye,
  'code-breaker': KeyRound,
};

const CARD_INKS = ['violet', 'coral', 'teal', 'yellow'];
const CARD_INK_VAR = {
  violet: 'var(--riso-violet)',
  coral: 'var(--riso-coral)',
  teal: 'var(--riso-teal)',
  yellow: 'var(--riso-yellow)',
};
const CARD_PATS = ['dots', 'lines', 'grid', 'cross'];

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) { setVal(0); return; }
    let raf; const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(end * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: d, ease: [0.16, 1, 0.3, 1] } }),
};

function LedgerCell({ Icon, value, label, ink, delay }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  const display = typeof value === 'number' ? animated.toLocaleString() : value;
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={delay} className="dash-ledger-cell">
      <div className="dash-ledger-ic" style={{ background: ink, transform: `rotate(${delay % 2 ? 2 : -2}deg)` }}>
        <Icon size={17} color={ink === 'var(--riso-yellow)' ? 'var(--ink)' : '#fffdf6'} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="dash-ledger-num">{display}{typeof value === 'string' && value.endsWith('d') ? '' : ''}</div>
        <div className="dash-ledger-lbl">{label}</div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [games, setGames] = useState([]);
  const [daily, setDaily] = useState(null);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [socialOpen, setSocialOpen] = useState(false);
  const [requestedUserIds, setRequestedUserIds] = useState(new Set());
  const [sendingRequestId, setSendingRequestId] = useState(null);
  const [activeTab, setActiveTab] = useState('rank');

  const stripRef = useRef(null);
  const ticketRef = useRef(null);
  const passRef = useRef(null);

  const DEFAULT_RECOMMENDED_PLAYERS = [
    { userId: 101, username: 'Alex_Algorithms', level: 6, competitiveRating: 540, competitiveRank: 'Knight', isOnline: true },
    { userId: 102, username: 'Priya_Logic', level: 7, competitiveRating: 620, competitiveRank: 'Guardian', isOnline: true },
    { userId: 103, username: 'Vikram_Byte', level: 5, competitiveRating: 480, competitiveRank: 'Knight', isOnline: false },
    { userId: 104, username: 'CodeNinja_99', level: 8, competitiveRating: 710, competitiveRank: 'Master', isOnline: true },
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [gamesRes, dailyRes] = await Promise.all([api.get('/api/games'), api.get('/api/games/daily')]);
        setGames(gamesRes.data);
        setDaily(dailyRes.data);
      } catch (e) {
        console.warn('Failed to load games/daily from API, falling back to mock data', e);
        const { mockGames, mockDailyChallenge } = await import('../../data/mockGames');
        setGames(mockGames);
        setDaily(mockDailyChallenge);
      }
      try {
        const recsRes = await api.get('/api/friends/recommendations?limit=4');
        if (Array.isArray(recsRes.data) && recsRes.data.length > 0) setRecommendedUsers(recsRes.data);
        else setRecommendedUsers(DEFAULT_RECOMMENDED_PLAYERS);
      } catch (err) {
        console.warn('Could not fetch recommendations, using defaults', err);
        setRecommendedUsers(DEFAULT_RECOMMENDED_PLAYERS);
      }
    };
    fetchDashboardData();
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => getDailyCountdown().formatted);
  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getDailyCountdown().formatted), 1000);
    const unsubscribe = subscribeToMidnightIST(() => {
      api.get('/api/games/daily').then((res) => setDaily(res.data)).catch(() => {});
    });
    return () => { clearInterval(interval); unsubscribe(); };
  }, []);

  const handleSendFriendRequest = async (targetUser) => {
    if (!targetUser?.userId || requestedUserIds.has(targetUser.userId)) return;
    setSendingRequestId(targetUser.userId);
    try {
      await api.post('/api/friends/requests', { receiverId: targetUser.userId });
      setRequestedUserIds((prev) => new Set([...prev, targetUser.userId]));
    } catch (e) {
      console.warn('Could not send friend request', e);
      setRequestedUserIds((prev) => new Set([...prev, targetUser.userId]));
    } finally {
      setSendingRequestId(null);
    }
  };

  const handleTilt = (ref) => (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-2px)`;
  };
  const resetTilt = (ref, base) => () => {
    if (ref.current) ref.current.style.transform = base;
  };

  if (!user) return null;

  const userLevel = user.level || 1;
  const userXP = user.xp || 0;
  const rank = getRankForLevel(userLevel);
  const xpCurrent = getXPForCurrentLevel(userLevel);
  const xpNext = getXPForNextLevel(userLevel);
  const progressPercent = Math.min(100, Math.max(0, ((userXP - xpCurrent) / (xpNext - xpCurrent)) * 100));

  const rating = user.competitiveRating || 500;
  const compRank = getRankFromRating(rating);
  const nextRank = getNextRank(rating);
  const rankProgress = getRankProgress(rating);

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const skills = [
    { label: 'Programming & DSA', acc: 85, ink: 'var(--riso-violet)' },
    { label: 'Reasoning & Sequences', acc: 78, ink: 'var(--riso-coral)' },
    { label: 'Brain Training & Aptitude', acc: 72, ink: 'var(--riso-yellow)' },
    { label: 'Visual Memory & Recall', acc: 80, ink: 'var(--riso-teal)' },
  ];

  const ringR = 34;
  const ringC = 2 * Math.PI * ringR;

  const tabs = [
    { id: 'rank', label: 'Rank File', Icon: Trophy, ink: 'var(--riso-violet)' },
    { id: 'mind', label: 'Mind Map', Icon: Zap, ink: 'var(--riso-coral)' },
    { id: 'crew', label: 'Crew', Icon: Users, ink: 'var(--riso-teal)' },
  ];

  return (
    <div className="cosmic-void dash-root">
      <div className="paper-grain" />
      <div className="dash-bg-dots" />
      <div className="dash-bg-ribbon" />
      <div className="dash-blob dash-blob--a" />
      <div className="dash-blob dash-blob--b" />
      <div className="dash-blob dash-blob--c" />

      <main className="dash-wrap">
        {/* ── ticker ─────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0} className="dash-marquee" aria-hidden>
          <div className="dash-marquee-track">
            {[0, 1].map((dup) => (
              <span key={dup}>
                ISSUE NO.07 — TODAY&apos;S RUN <i>✦</i> STREAK {user.currentStreak || 0} DAYS <i>✦</i> {rating} RATING <i>✦</i> DAILY MISSION LIVE <i>✦</i> PLAY — EARN — REPEAT <i>✦</i>&nbsp;
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── masthead ───────────────────────────── */}
        <div className="dash-mast">
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.05}>
            <div className="dash-edition">
              <span className="dash-edition-no">Daily Edition</span>
              <span className="dash-edition-date">{currentDateFormatted} — Vol.07</span>
            </div>
            <h1 className="dash-title">
              Today&apos;s <span className="coral">run,</span>
              <br />
              <span className="outline">{user.username}</span>
            </h1>
            <p className="dash-sub">
              One mission. One arena streak. One rank climb. We cleared the clutter — <b>pick a lane below</b> and
              go earn ink.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={0.12}
            className="dash-spin-wrap" aria-hidden
          >
            <svg className="dash-spin-svg" viewBox="0 0 150 150">
              <defs>
                <path id="dash-circle" d="M 75,75 m -58,0 a 58,58 0 1,1 116,0 a 58,58 0 1,1 -116,0" />
              </defs>
              <text>
                <textPath href="#dash-circle">PLAY • EARN • REPEAT • PLAY • EARN •</textPath>
              </text>
            </svg>
            <div className="dash-spin-core">
              <Flame size={30} color="#fffdf6" />
            </div>
            <span
              className="dash-float-sticker"
              style={{ bottom: -8, left: 6, background: 'var(--riso-yellow)', color: 'var(--ink)' }}
            >
              {user.currentStreak || 0}d streak
            </span>
          </motion.div>
        </div>

        {/* ── ledger strip: single row replaces 4 messy cards ── */}
        <div className="dash-ledger">
          <LedgerCell Icon={Flame} value={`${user.currentStreak || 0}d`} label="Daily streak" ink="var(--riso-coral)" delay={0} />
          <LedgerCell Icon={Coins} value={user.coins || 0} label="Coins balance" ink="var(--riso-yellow)" delay={1} />
          <LedgerCell Icon={Swords} value={rating} label="Rating" ink="var(--riso-violet)" delay={2} />
          <LedgerCell Icon={Gamepad2} value={user.gamesCompleted || 0} label="Games solved" ink="var(--riso-teal)" delay={3} />
        </div>

        {/* ── ACT 2 : ticket + passport ──────────── */}
        <div className="dash-act2">
          {/* daily ticket */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={0}
            ref={ticketRef}
            onMouseMove={handleTilt(ticketRef)}
            onMouseLeave={resetTilt(ticketRef, 'rotate(-0.4deg)')}
            className="dash-ticket"
          >
            <div className="dash-ticket-main">
              <div className="dash-ticket-stripes" />
              <div className="dash-ticket-shine" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', marginBottom: '0.7rem' }}>
                <span className="zine-kicker" style={{ color: 'var(--riso-coral)' }}>✦ Daily mission</span>
                <span className="zine-badge" style={{ background: 'var(--ink)', color: 'var(--paper)', marginLeft: 'auto' }}>
                  +{daily?.xpReward || 100} XP
                </span>
              </div>
              <h3 className="zine-display" style={{ fontSize: 'clamp(1.25rem, 3vw, 1.7rem)', marginBottom: '0.45rem', position: 'relative' }}>
                {daily?.title || 'The Arithmetic Equipment Puzzle'}
              </h3>
              <p className="zine-lede" style={{ fontSize: '0.86rem', marginBottom: '1.2rem', position: 'relative' }}>
                {daily?.description || 'A classic cognitive reflection test testing your immediate mathematical deduction.'}
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', position: 'relative' }}>
                <Link to="/daily-challenge" className="btn-primary" style={{ flex: 1, minWidth: 180 }}>
                  Accept mission <ArrowRight size={16} />
                </Link>
                <Link to="/games" className="btn-secondary" style={{ padding: '0.7rem 1rem' }}>
                  <Gamepad2 size={15} /> Arenas
                </Link>
              </div>
            </div>
            <div className="dash-stub">
              <Ticket size={20} color="var(--ink)" />
              <div>
                <div className="dash-stub-time">{timeLeft}</div>
                <div className="dash-stub-lbl">left today</div>
              </div>
              <div className="zine-badge" style={{ background: 'var(--paper-card)' }}>ADMIT 1</div>
            </div>
          </motion.div>

          {/* player passport */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={0.1}
            ref={passRef}
            onMouseMove={handleTilt(passRef)}
            onMouseLeave={resetTilt(passRef, 'rotate(0.7deg)')}
            className="dash-pass"
          >
            <div className="font-mono" style={{ fontSize: '0.6rem', letterSpacing: '0.22em', opacity: 0.7, marginBottom: '0.8rem', position: 'relative' }}>
              ◍ PLAYER PASSPORT — LVL {userLevel}
            </div>
            <div className="dash-pass-row">
              <div className="dash-ring">
                <svg width="84" height="84" viewBox="0 0 84 84">
                  <circle cx="42" cy="42" r={ringR} fill="none" stroke="rgba(251,246,233,0.2)" strokeWidth="9" />
                  <motion.circle
                    cx="42" cy="42" r={ringR} fill="none"
                    stroke="var(--riso-yellow)" strokeWidth="9" strokeLinecap="butt"
                    strokeDasharray={ringC}
                    initial={{ strokeDashoffset: ringC }}
                    animate={{ strokeDashoffset: ringC - (ringC * progressPercent) / 100 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                  />
                </svg>
                <div className="dash-ring-center">
                  <span className="zine-display" style={{ fontSize: '1.3rem', color: 'var(--paper)' }}>{userLevel}</span>
                  <span className="font-mono" style={{ fontSize: '0.55rem', letterSpacing: '0.18em', opacity: 0.75 }}>LVL</span>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="zine-display" style={{ fontSize: '1rem', color: 'var(--paper)', textTransform: 'uppercase' }}>LEVEL {userLevel}</div>
                <div className="font-mono" style={{ fontSize: '0.68rem', opacity: 0.75, marginTop: '0.25rem' }}>
                  {userXP.toLocaleString()} XP → {(xpNext || 0).toLocaleString()}
                </div>
                <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--riso-yellow)', fontWeight: 800, marginTop: '0.3rem' }}>
                  {compRank.badge} {compRank.name} · {rating}
                </div>
              </div>
            </div>
            <div className="dash-xp-track">
              <motion.div
                className="dash-xp-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
              />
            </div>
            <div className="dash-pass-meta">
              <div className="dash-pass-chip"><Flame size={13} color="var(--riso-yellow)" /> {user.currentStreak || 0}d</div>
              <div className="dash-pass-chip"><Coins size={13} color="var(--riso-yellow)" /> {user.coins || 0}</div>
              <div className="dash-pass-chip"><Swords size={13} color="var(--riso-yellow)" /> {user.gamesCompleted || 0}</div>
            </div>
          </motion.div>
        </div>

        {/* ── ACT 3 : arena filmstrip ────────────── */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={0}>
          <div className="dash-sec">
            <h2><Gamepad2 size={18} /> Quick arenas</h2>
            <div className="rule" />
            <div className="dash-sec-arrows">
              <button className="zine-btn-sm" onClick={() => stripRef.current?.scrollBy({ left: -280, behavior: 'smooth' })} aria-label="Scroll left">
                <ChevronLeft size={13} />
              </button>
              <button className="zine-btn-sm" onClick={() => stripRef.current?.scrollBy({ left: 280, behavior: 'smooth' })} aria-label="Scroll right">
                <ChevronRight size={13} />
              </button>
              <Link to="/games" className="zine-btn-sm zine-btn-sm--violet">View all →</Link>
            </div>
          </div>
        </motion.div>

        <div ref={stripRef} className="dash-strip">
          {games.slice(0, 6).map((game, i) => {
            const IconComp = SLUG_ICONS[game.slug] || Gamepad2;
            const ink = CARD_INKS[i % 4];
            const pat = CARD_PATS[i % 4];
            return (
              <motion.div
                key={game.slug}
                initial={{ opacity: 0, y: 26, rotate: i % 2 ? 2 : -2 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.07, 0.35), ease: [0.16, 1, 0.3, 1] }}
              >
                <Link to={`/games/${game.slug}`} className="dash-card" data-ink={ink}>
                  <div className={`dash-card-pat dash-card-pat--${pat}`} />
                  <div className="dash-card-ghost">0{i + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', position: 'relative' }}>
                    <div className="dash-card-ic" style={{ background: CARD_INK_VAR[ink] }}>
                      <IconComp size={17} color={ink === 'yellow' ? 'var(--ink)' : '#fffdf6'} />
                    </div>
                    <span className="zine-badge" style={{ fontSize: '0.56rem' }}>{game.category}</span>
                  </div>
                  <div className="zine-display" style={{ fontSize: '1rem', marginTop: '0.8rem', position: 'relative', lineHeight: 1 }}>
                    {game.title}
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--ink-muted)', marginTop: '0.35rem', position: 'relative' }}>
                    ⏱ {game.estimatedTime || '3-5 min'} · {game.difficulty || 'MEDIUM'}
                  </div>
                  <div className="dash-card-go">
                    <span className="font-mono" style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.16em' }}>ENTER ARENA</span>
                    <span className="arr"><ArrowUpRight size={15} /></span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* ── ACT 4 : field notes — one tabbed panel instead of 3 stacked ── */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} custom={0.05}
          className="dash-notes"
        >
          <div className="dash-tabs" role="tablist">
            {tabs.map(({ id, label, Icon, ink }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`dash-tab ${activeTab === id ? 'active' : ''}`}
              >
                <Icon size={14} color={activeTab === id ? ink : 'currentColor'} />
                {label}
                {activeTab === id && (
                  <motion.span layoutId="dash-tab-ink" className="dash-tab-ind" style={{ background: ink }} />
                )}
              </button>
            ))}
          </div>

          <div className="dash-notes-body">
            <AnimatePresence mode="wait">
              {activeTab === 'rank' && (
                <motion.div key="rank" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <div style={{ width: 52, height: 52, background: 'var(--riso-yellow)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', transform: 'rotate(-3deg)' }}>
                      {compRank.badge}
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="zine-display" style={{ fontSize: '1.05rem' }}>{compRank.name} <span className="zine-badge" style={{ background: 'var(--riso-violet)', color: '#fffdf6', marginLeft: '0.4rem' }}>1v1 ranked</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="zine-num" style={{ fontSize: '2rem' }}>{rating}</div>
                      <div className="font-mono" style={{ fontSize: '0.58rem', letterSpacing: '0.16em', color: 'var(--ink-faint)', fontWeight: 700 }}>RATING</div>
                    </div>
                  </div>
                  {nextRank && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem', color: 'var(--ink-muted)', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <span>Next rank: <b style={{ color: 'var(--ink)' }}>{nextRank.name}</b></span>
                        <span className="font-mono" style={{ fontWeight: 800, color: 'var(--ink)' }}>{rating} / {nextRank.minRating} · {rankProgress}%</span>
                      </div>
                      <div className="zine-meter">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${rankProgress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', background: 'repeating-linear-gradient(45deg, var(--riso-violet) 0 8px, var(--riso-violet-2) 8px 16px)' }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'mind' && (
                <motion.div key="mind" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.28 }}>
                  <div className="zine-section-head" style={{ marginBottom: '1rem' }}>
                    <Zap size={16} /><span className="zine-display" style={{ fontSize: '0.9rem' }}>Cognitive breakdown</span>
                  </div>
                  {skills.map((s, i) => (
                    <div key={s.label} className="dash-mind-row">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span className="font-mono" style={{ fontSize: '0.64rem', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
                        <span className="font-mono" style={{ fontSize: '0.64rem', fontWeight: 800 }}>{s.acc}%</span>
                      </div>
                      <div className="dash-mind-bar">
                        <motion.div
                          initial={{ width: 0 }} whileInView={{ width: `${s.acc}%` }} viewport={{ once: true }}
                          transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                          style={{ height: '100%', background: s.ink }}
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'crew' && (
                <motion.div key="crew" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <UserPlus size={17} />
                      <div>
                        <div className="zine-display" style={{ fontSize: '0.95rem' }}>Active challengers</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>In your rating bracket — send a duel invite</div>
                      </div>
                    </div>
                    <button onClick={() => setSocialOpen(true)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.72rem' }}>
                      <Users size={13} /> Friends hub
                    </button>
                  </div>
                  <div className="dash-crew">
                    {recommendedUsers.map((recUser) => {
                      const isRequested = requestedUserIds.has(recUser.userId);
                      const isSending = sendingRequestId === recUser.userId;
                      return (
                        <div key={recUser.userId} className="dash-crew-item">
                          <span className={`dash-dot ${recUser.isOnline ? 'on' : 'off'}`} title={recUser.isOnline ? 'Online' : 'Offline'} />
                          <div style={{ width: 30, height: 30, background: 'var(--riso-yellow)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                            {recUser.username?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="zine-display" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recUser.username}</div>
                            <div className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--riso-violet)', fontWeight: 700 }}>{recUser.competitiveRating || 500} ELO</div>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(recUser)}
                            disabled={isRequested || isSending}
                            className={`zine-btn-sm${isRequested ? ' zine-btn-sm--teal' : ' zine-btn-sm--violet'}`}
                            style={{ padding: '0.32rem 0.55rem', flexShrink: 0 }}
                            aria-label={isRequested ? 'Requested' : `Challenge ${recUser.username}`}
                          >
                            {isRequested ? <Check size={12} /> : isSending ? '…' : <UserPlus size={12} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* footer strip */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={0}
          style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '1.4rem', flexWrap: 'wrap' }}
        >
          <span className="sticker"><Sparkles size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> TIP — FINISH DAILY, BANK +{daily?.coinReward || 50} COINS</span>
          <Link to="/leaderboard" className="zine-btn-sm" style={{ marginLeft: 'auto' }}>
            <Trophy size={12} /> Leaderboard
          </Link>
        </motion.div>
      </main>

      <SocialDrawer
        isOpen={socialOpen}
        onClose={() => setSocialOpen(false)}
        onInviteFriendToGame={() => { setSocialOpen(false); navigate('/games'); }}
      />
    </div>
  );
}
