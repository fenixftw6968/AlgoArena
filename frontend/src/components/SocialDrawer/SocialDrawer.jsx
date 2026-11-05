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
      interval = setInterval(fetchChat, 2500);
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
  const incomingRequests = friends.filter(f => f.status === 'PENDING' && f.isIncoming);

  const filteredFriends = acceptedFriends.filter(f =>
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="sd-overlay" onClick={onClose}>
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="sd-panel"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sd-head">
            <div className="sd-title-wrap">
              <h2 className="sd-title">Network</h2>
              <span className="mono faint" style={{ fontSize: '0.75rem' }}>{acceptedFriends.length} contacts</span>
            </div>
            <button onClick={onClose} aria-label="Close panel" className="sd-close-btn">
              <X size={14} />
            </button>
          </div>

          {/* Segmented Tabs */}
          <div className="sd-tabs">
            <button
              onClick={() => setActiveTab('FRIENDS')}
              className={`sd-tab${activeTab === 'FRIENDS' ? ' is-active' : ''}`}
            >
              Friends ({acceptedFriends.length})
            </button>
            <button
              onClick={() => setActiveTab('REQUESTS')}
              className={`sd-tab${activeTab === 'REQUESTS' ? ' is-active' : ''}`}
            >
              Invites {incomingRequests.length > 0 && `(${incomingRequests.length})`}
            </button>
            {selectedFriend && (
              <button
                onClick={() => setActiveTab('CHAT')}
                className={`sd-tab sd-tab--chat${activeTab === 'CHAT' ? ' is-active' : ''}`}
              >
                @{selectedFriend.username}
              </button>
            )}
          </div>

          {/* Drawer Body */}
          <div className="sd-body">
            {activeTab === 'FRIENDS' && (
              <>
                {/* Search */}
                <div className="sd-search">
                  <Search size={13} className="sd-search-icon" />
                  <input
                    type="text"
                    placeholder="Filter contacts…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="zine-field sd-search-input"
                  />
                </div>

                {/* List */}
                {loading ? (
                  <div className="sd-empty">
                    <span className="zine-spinner" />
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="sd-empty">
                    <p>No contacts found.</p>
                  </div>
                ) : (
                  <div className="sd-list">
                    {filteredFriends.map(f => {
                      const rank = getRankFromRating(f.rating || 500);
                      return (
                        <div key={f.userId} className="sd-friend">
                          <div className="sd-avatar">
                            {f.username[0]?.toUpperCase()}
                            <span className={`sd-presence ${f.online ? 'is-online' : ''}`} />
                          </div>
                          <div className="sd-friend-main">
                            <div className="sd-friend-name">{f.username}</div>
                            <div className="sd-friend-meta mono">{rank.name} · {f.rating ?? 101} Rating</div>
                          </div>
                          <div className="sd-friend-actions">
                            <button
                              onClick={() => onInviteFriendToGame && onInviteFriendToGame(f)}
                              className="btn btn--primary btn--sm sd-invite-btn"
                              title="Invite to 1v1 match"
                            >
                              <Swords size={12} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedFriend(f);
                                setActiveTab('CHAT');
                              }}
                              className="btn btn--secondary btn--sm sd-invite-btn"
                              title="Direct message"
                            >
                              <MessageSquare size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === 'REQUESTS' && (
              <div className="sd-requests">
                {/* Add Friend Form */}
                <form onSubmit={handleSendRequest} className="sd-add">
                  <label className="zine-label">Add by handle</label>
                  <div className="sd-add-row">
                    <input
                      type="text"
                      placeholder="Username…"
                      value={addUsername}
                      onChange={e => setAddUsername(e.target.value)}
                      className="zine-field sd-add-input"
                    />
                    <button type="submit" className="btn btn--primary btn--sm">
                      Send
                    </button>
                  </div>
                  {addStatus && (
                    <div className={`sd-status sd-status--${addStatus.type}`}>
                      {addStatus.msg}
                    </div>
                  )}
                </form>

                {/* Pending Incoming */}
                <div className="sd-section">
                  <div className="zine-kicker" style={{ marginBottom: 8 }}>Pending Invites</div>
                  {incomingRequests.length === 0 ? (
                    <div className="sd-muted">No pending invitations.</div>
                  ) : (
                    <div className="sd-list">
                      {incomingRequests.map(r => (
                        <div key={r.friendshipId} className="sd-request">
                          <div className="sd-request-main">
                            <span className="sd-friend-name">@{r.username}</span>
                          </div>
                          <div className="sd-friend-actions">
                            <button
                              onClick={() => handleRespondRequest(r.friendshipId, true)}
                              className="sd-icon-btn sd-icon-btn--ok"
                              title="Accept"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => handleRespondRequest(r.friendshipId, false)}
                              className="sd-icon-btn sd-icon-btn--err"
                              title="Decline"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'CHAT' && selectedFriend && (
              <div className="sd-chat">
                <div className="sd-chat-body">
                  {chatMessages.length === 0 ? (
                    <div className="sd-empty" style={{ margin: 'auto' }}>
                      <p>Start a conversation with @{selectedFriend.username}</p>
                    </div>
                  ) : (
                    chatMessages.map((m, i) => {
                      const isMine = m.senderId !== selectedFriend.userId;
                      return (
                        <div key={m.id || i} className={`sd-msg ${isMine ? 'sd-msg--mine' : ''}`}>
                          {m.content}
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <form onSubmit={handleSendMessage} className="sd-chat-form">
                  <input
                    type="text"
                    placeholder={`Message @${selectedFriend.username}…`}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="zine-field sd-chat-input"
                  />
                  <button type="submit" className="btn btn--primary btn--sm sd-send-btn">
                    <Send size={13} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </motion.div>

        <style>{`
          .sd-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 1000;
            display: flex;
            justify-content: flex-end;
          }

          .sd-panel {
            width: 100%;
            max-width: 380px;
            height: 100%;
            background: var(--surface);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-lg);
          }

          .sd-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }

          .sd-title {
            font-size: 0.9375rem;
            font-weight: 600;
            color: var(--ink);
          }

          .sd-close-btn {
            width: 26px;
            height: 26px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--border);
            border-radius: var(--radius-xs);
            background: var(--surface);
            color: var(--ink-muted);
            cursor: pointer;
          }

          .sd-close-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
          }

          .sd-tabs {
            display: flex;
            background: var(--surface-subtle);
            border-bottom: 1px solid var(--border);
          }

          .sd-tab {
            flex: 1;
            padding: 8px 10px;
            border: none;
            background: transparent;
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--ink-muted);
            cursor: pointer;
            transition: color 0.12s ease;
          }

          .sd-tab.is-active {
            color: var(--accent);
            background: var(--surface);
            font-weight: 600;
            box-shadow: inset 0 -1px 0 var(--accent);
          }

          .sd-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
          }

          .sd-search {
            position: relative;
            margin-bottom: 12px;
          }

          .sd-search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--ink-faint);
            pointer-events: none;
          }

          .sd-search-input {
            padding-left: 30px !important;
            height: 32px !important;
            font-size: 0.8125rem !important;
          }

          .sd-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .sd-friend, .sd-request {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: var(--surface);
          }

          .sd-avatar {
            width: 28px;
            height: 28px;
            border-radius: var(--radius-xs);
            background: var(--surface-3);
            border: 1px solid var(--border);
            color: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
            position: relative;
            flex-shrink: 0;
          }

          .sd-presence {
            position: absolute;
            bottom: -1px;
            right: -1px;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--ink-faint);
            border: 1px solid var(--surface);
          }

          .sd-presence.is-online {
            background: var(--accent);
          }

          .sd-friend-main {
            flex: 1;
            min-width: 0;
          }

          .sd-friend-name {
            font-size: 0.8125rem;
            font-weight: 550;
            color: var(--ink);
          }

          .sd-friend-meta {
            font-size: 0.6875rem;
            color: var(--ink-muted);
          }

          .sd-friend-actions {
            display: flex;
            gap: 4px;
          }

          .sd-invite-btn {
            width: 28px;
            height: 28px;
            padding: 0;
          }

          .sd-chat {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }

          .sd-chat-body {
            flex: 1;
            overflow-y: auto;
            padding: 12px 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .sd-msg {
            max-width: 80%;
            padding: 8px 12px;
            border-radius: var(--radius-sm);
            font-size: 0.8125rem;
            background: var(--surface-3);
            border: 1px solid var(--border);
            color: var(--ink);
            line-height: 1.45;
          }

          .sd-msg--mine {
            align-self: flex-end;
            background: var(--accent);
            border-color: var(--accent);
            color: #0B0B0B;
            font-weight: 500;
          }

          .sd-chat-form {
            display: flex;
            gap: 6px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
          }

          .sd-chat-input {
            height: 34px !important;
            font-size: 0.8125rem !important;
          }

          .sd-send-btn {
            height: 34px;
            width: 34px;
            padding: 0;
          }
        `}</style>
      </div>
    </AnimatePresence>
  );
}
