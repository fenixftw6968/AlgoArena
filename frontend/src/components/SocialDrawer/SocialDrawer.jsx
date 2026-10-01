import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MessageSquare, Swords, Check, X, Send, Search } from 'lucide-react';
import api from '../../utils/api';
import { getRankFromRating } from '../../utils/rankUtils';

export default function SocialDrawer({ isOpen, onClose, onInviteFriendToGame }) {
  const [activeTab, setActiveTab] = useState('FRIENDS'); // 'FRIENDS', 'REQUESTS', 'CHAT'
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState(null);

  // Chat state
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/friends');
      setFriends(res.data);
    } catch (e) {
      console.warn("Could not load friends list", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  // Load chat messages when selecting friend
  useEffect(() => {
    let interval = null;
    if (activeTab === 'CHAT' && selectedFriend) {
      const fetchChat = async () => {
        try {
          const res = await api.get(`/api/chat/${selectedFriend.userId}`);
          setChatMessages(res.data);
        } catch (e) {
          console.error("Failed to load chat", e);
        }
      };
      fetchChat();
      interval = setInterval(fetchChat, 2000);
    }
    return () => clearInterval(interval);
  }, [activeTab, selectedFriend]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    try {
      setAddStatus({ type: 'loading', msg: 'Sending friend request...' });
      await api.post('/api/friends/request', { username: addUsername.trim() });
      setAddStatus({ type: 'success', msg: `Friend request sent to @${addUsername}` });
      setAddUsername('');
      fetchFriends();
      setTimeout(() => {
        setAddStatus(null);
      }, 4000);
    } catch (e) {
      const msg = e.response?.data?.message || 'User not found or friend request already sent';
      setAddStatus({ type: 'error', msg });
    }
  };

  const handleRespondRequest = async (friendshipId, accept) => {
    try {
      await api.post('/api/friends/respond', { friendshipId, accept });
      fetchFriends();
    } catch (e) {
      console.error("Failed to respond to request", e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedFriend) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      const res = await api.post(`/api/chat/${selectedFriend.userId}`, { content: text });
      setChatMessages(prev => [...prev, res.data]);
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  if (!isOpen) return null;

  const acceptedFriends = friends.filter(f => f.status === 'ACCEPTED');
  const incomingRequests = friends.filter(f => f.status === 'PENDING_INCOMING');
  const outgoingRequests = friends.filter(f => f.status === 'PENDING_OUTGOING');

  const filteredFriends = acceptedFriends.filter(f =>
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        backgroundColor: 'rgba(23, 20, 15, 0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{
            width: '100%',
            maxWidth: '440px',
            height: '100%',
            background: 'var(--paper-card)',
            borderLeft: '3px solid var(--ink)',
            boxShadow: '-8px 0 0 var(--riso-violet)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Drawer Header */}
          <div style={{
            padding: '1.35rem 1.5rem',
            borderBottom: '3px solid var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--riso-yellow)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '34px', height: '34px', background: 'var(--riso-violet)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fffdf6' }}>
                <Users size={16} />
              </div>
              <h2 className="zine-display" style={{ fontSize: '1.15rem', margin: 0 }}>
                FRIENDS
              </h2>
            </div>
            <button onClick={onClose} className="zine-btn-sm" style={{ background: 'var(--paper-card)' }}>
              <X size={14} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--ink)', background: 'var(--paper-deep)' }}>
            <button
              onClick={() => { setActiveTab('FRIENDS'); setSelectedFriend(null); }}
              className="zine-btn-sm"
              style={{ flex: 1, border: 'none', borderRight: '2px solid var(--ink)', background: activeTab === 'FRIENDS' ? 'var(--riso-violet)' : 'transparent', color: activeTab === 'FRIENDS' ? '#fffdf6' : 'var(--ink-muted)', boxShadow: 'none' }}
            >
              FRIENDS ({acceptedFriends.length})
            </button>

            <button
              onClick={() => { setActiveTab('REQUESTS'); setSelectedFriend(null); }}
              className="zine-btn-sm"
              style={{ flex: 1, border: 'none', borderRight: selectedFriend ? '2px solid var(--ink)' : 'none', background: activeTab === 'REQUESTS' ? 'var(--riso-violet)' : 'transparent', color: activeTab === 'REQUESTS' ? '#fffdf6' : 'var(--ink-muted)', boxShadow: 'none' }}
            >
              REQUESTS {incomingRequests.length > 0 && `(${incomingRequests.length})`}
            </button>

            {selectedFriend && (
              <button
                onClick={() => setActiveTab('CHAT')}
                className="zine-btn-sm"
                style={{ flex: 1, border: 'none', background: activeTab === 'CHAT' ? 'var(--riso-violet)' : 'transparent', color: activeTab === 'CHAT' ? '#fffdf6' : 'var(--ink-muted)', boxShadow: 'none', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                CHAT: @{selectedFriend.username}
              </button>
            )}
          </div>

          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'FRIENDS' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {/* Search friend */}
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="zine-field"
                  style={{ paddingLeft: '2.4rem', fontSize: '0.82rem' }}
                />
              </div>

              {/* Friends list */}
              {filteredFriends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>NO FRIENDS FOUND. SEND REQUESTS IN THE REQUESTS TAB.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {filteredFriends.map(friend => {
                    const rank = getRankFromRating(friend.competitiveRating || 500);
                    return (
                      <div
                        key={friend.id}
                        className="zine-card zine-card--flat"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.6rem',
                          padding: '0.8rem 0.95rem',
                          background: 'var(--paper-card)',
                          boxShadow: '3px 3px 0 var(--ink)',
                          transition: 'transform 0.12s steps(3), box-shadow 0.12s steps(3)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              background: 'var(--riso-yellow)',
                              border: '2px solid var(--ink)',
                              boxShadow: '2px 2px 0 var(--ink)',
                              color: 'var(--ink)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.95rem'
                            }}>
                              {friend.username[0]?.toUpperCase()}
                            </div>
                            <div style={{
                              position: 'absolute',
                              bottom: '-3px',
                              right: '-3px',
                              width: '11px',
                              height: '11px',
                              background: friend.isOnline ? 'var(--riso-teal)' : 'var(--ink-faint)',
                              border: '2px solid var(--ink)'
                            }} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div className="zine-display" style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              @{friend.username}
                            </div>
                            <div className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', color: 'var(--ink-muted)' }}>
                              <span>{rank.badge} {rank.name}</span>
                              <span>&bull;</span>
                              <span>{friend.competitiveRating || 500} pts</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button
                            title="Direct Message"
                            onClick={() => {
                              setSelectedFriend(friend);
                              setActiveTab('CHAT');
                            }}
                            className="zine-btn-sm"
                            style={{ padding: '0.4rem' }}
                          >
                            <MessageSquare size={14} />
                          </button>

                          {onInviteFriendToGame && (
                            <button
                              title="Invite to Game"
                              onClick={() => onInviteFriendToGame(friend)}
                              className="zine-btn-sm zine-btn-sm--violet"
                            >
                              <Swords size={12} /> 1V1
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUESTS & ADD FRIEND */}
          {activeTab === 'REQUESTS' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {/* Add friend form */}
              <form onSubmit={handleSendRequest} style={{ marginBottom: '1.75rem' }}>
                <label className="zine-label">
                  Send Friend Request
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Enter username..."
                    value={addUsername}
                    onChange={e => setAddUsername(e.target.value)}
                    className="zine-field"
                    style={{ flex: 1, fontSize: '0.82rem' }}
                  />
                  <button
                    type="submit"
                    disabled={addStatus?.type === 'loading'}
                    className="zine-btn-sm zine-btn-sm--violet"
                    style={{ padding: '0.6rem 1.1rem' }}
                  >
                    {addStatus?.type === 'loading' ? 'SENDING...' : addStatus?.type === 'success' ? 'SENT' : 'SEND'}
                  </button>
                </div>
                {addStatus && (
                  <p style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    marginTop: '0.5rem',
                    fontWeight: 700,
                    color: addStatus.type === 'error' ? 'var(--riso-coral)' : 'var(--riso-teal)'
                  }}>
                    {addStatus.msg}
                  </p>
                )}
              </form>

              {/* Incoming requests */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h3 className="zine-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Incoming Requests ({incomingRequests.length})
                </h3>
                {incomingRequests.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>No pending requests.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {incomingRequests.map(req => (
                      <div key={req.id} className="zine-card zine-card--flat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.7rem 0.9rem', background: 'var(--paper-card)', boxShadow: '3px 3px 0 var(--ink)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="zine-display" style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{req.username}</div>
                          <div className="font-mono" style={{ fontSize: '0.66rem', color: 'var(--ink-muted)' }}>RATING {req.competitiveRating || 500}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleRespondRequest(req.id, true)}
                            className="zine-btn-sm zine-btn-sm--teal"
                            style={{ padding: '0.35rem 0.55rem' }}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => handleRespondRequest(req.id, false)}
                            className="zine-btn-sm zine-btn-sm--coral"
                            style={{ padding: '0.35rem 0.55rem' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing requests */}
              <div>
                <h3 className="zine-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Outgoing Requests ({outgoingRequests.length})
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>No pending transmissions.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {outgoingRequests.map(req => (
                      <div key={req.id} className="zine-card zine-card--flat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 0.9rem', background: 'var(--paper-card)', boxShadow: '3px 3px 0 var(--ink)' }}>
                        <span className="zine-display" style={{ fontSize: '0.82rem' }}>@{req.username}</span>
                        <span className="zine-badge" style={{ background: 'var(--riso-yellow)' }}>Pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PRIVATE CHAT */}
          {activeTab === 'CHAT' && selectedFriend && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                    Link initialized with @{selectedFriend.username}. Transmit your first message.
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMine = msg.senderId !== selectedFriend.userId;
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isMine ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: isMine ? 'var(--riso-violet)' : 'var(--paper-sunk)',
                          color: isMine ? '#fffdf6' : 'var(--ink)',
                          border: '2px solid var(--ink)',
                          boxShadow: isMine ? '3px 3px 0 var(--riso-coral)' : '3px 3px 0 var(--ink)',
                          padding: '0.6rem 0.9rem',
                          fontSize: '0.825rem',
                          lineHeight: 1.4
                        }}
                      >
                        {msg.content}
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat input form */}
              <form onSubmit={handleSendMessage} style={{ padding: '0.85rem 1.25rem', borderTop: '2px solid var(--ink)', display: 'flex', gap: '0.5rem', background: 'var(--paper-deep)' }}>
                <input
                  type="text"
                  placeholder={`Message @${selectedFriend.username}...`}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  className="zine-field"
                  style={{ flex: 1, fontSize: '0.825rem' }}
                />
                <button
                  type="submit"
                  className="zine-btn-sm zine-btn-sm--violet"
                  style={{ padding: '0.6rem 0.9rem' }}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
