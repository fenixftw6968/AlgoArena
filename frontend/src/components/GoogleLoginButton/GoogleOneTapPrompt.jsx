import { useState } from 'react';
import { X } from 'lucide-react';

export default function GoogleOneTapPrompt({ isOpen, onClose, onSelect, loading }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    const name = customName.trim() || customEmail.split('@')[0];
    onSelect(customEmail.trim(), name);
  };

  return (
    <div className="google-onetap-root">
      <div className="google-onetap-card">
        {/* Top Header */}
        <div className="google-onetap-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span className="google-onetap-title">Sign in with Google</span>
          </div>
          <button
            type="button"
            className="google-onetap-close"
            onClick={onClose}
            aria-label="Close Google Sign-in"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2-Column Split Body (Pixel-perfect to LeetCode / Google screenshot) */}
        <div className="google-onetap-body">
          {/* Left Column: App Badge & Title */}
          <div className="google-onetap-left">
            <div className="google-onetap-app-badge">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                <path d="M7 10L12 15L17 10" stroke="#B9FF66" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 4V14" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="google-onetap-choose">Choose an account</h2>
            <p className="google-onetap-continue">
              to continue to <span>AlgoArena</span>
            </p>
          </div>

          {/* Right Column: Accounts List or Custom Input */}
          <div className="google-onetap-right">
            {!showCustom ? (
              <>
                <ul className="google-onetap-list">
                  {/* Account 1: Kartik Bhangale */}
                  <li
                    className="google-onetap-item"
                    onClick={() => !loading && onSelect('kartikbhangale20@gmail.com', 'Kartik Bhangale')}
                  >
                    <div className="google-onetap-avatar avatar-warm">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="7" r="4"/>
                        <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>
                      </svg>
                    </div>
                    <div className="google-onetap-info">
                      <span className="google-onetap-name">Kartik Bhangale</span>
                      <span className="google-onetap-email">kartikbhangale20@gmail.com</span>
                    </div>
                  </li>

                  <div className="google-onetap-divider" />

                  {/* Account 2: Kartik */}
                  <li
                    className="google-onetap-item"
                    onClick={() => !loading && onSelect('kartikbhangale128@gmail.com', 'Kartik')}
                  >
                    <div className="google-onetap-avatar avatar-sunset">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="7" r="4"/>
                        <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>
                      </svg>
                    </div>
                    <div className="google-onetap-info">
                      <span className="google-onetap-name">Kartik</span>
                      <span className="google-onetap-email">kartikbhangale128@gmail.com</span>
                    </div>
                  </li>

                  <div className="google-onetap-divider" />

                  {/* Account 3: Use another account */}
                  <li
                    className="google-onetap-item"
                    onClick={() => setShowCustom(true)}
                  >
                    <div className="google-onetap-avatar avatar-outline">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9"/>
                        <circle cx="12" cy="9" r="3"/>
                        <path d="M6.5 18a6 6 0 0 1 11 0"/>
                      </svg>
                    </div>
                    <div className="google-onetap-info">
                      <span className="google-onetap-name">Use another account</span>
                    </div>
                  </li>
                </ul>

                <p className="google-onetap-disclaimer">
                  Before using this app, you can review AlgoArena's{' '}
                  <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a> and{' '}
                  <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>.
                </p>
              </>
            ) : (
              <form onSubmit={handleCustomSubmit} className="google-onetap-custom">
                <p style={{ fontSize: 13, color: '#C4C7C5', marginBottom: 2 }}>
                  Enter your Google email
                </p>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Email or phone"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="google-onetap-input"
                />
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="google-onetap-input"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowCustom(false)}
                    className="google-onetap-btn-back"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="google-onetap-btn-next"
                  >
                    {loading ? 'Signing in…' : 'Next'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

