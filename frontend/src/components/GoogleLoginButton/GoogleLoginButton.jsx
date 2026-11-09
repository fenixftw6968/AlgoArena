import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function GoogleLoginButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const tokenClientRef = useRef(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Initialize Google Identity Services
  useEffect(() => {
    if (!clientId) return;

    const setupGoogle = () => {
      if (window.google?.accounts?.id) {
        // 1. Setup real Google One Tap prompt
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              setLoading(true);
              const res = await loginWithGoogle({ idToken: response.credential });
              setLoading(false);
              if (res.success) {
                navigate('/dashboard');
              } else if (onError) {
                onError(res.error || 'Google authentication failed');
              }
            },
            auto_select: false,
            cancel_on_tap_outside: false,
          });

          // Show Google One Tap automatically
          window.google.accounts.id.prompt();
        } catch (err) {
          console.warn('Google One Tap init notice:', err);
        }
      }

      // 2. Setup real Google OAuth2 Token Client for button clicks
      if (window.google?.accounts?.oauth2) {
        try {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            prompt: 'select_account',
            callback: async (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                setLoading(true);
                try {
                  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                  });
                  const profile = await userRes.json();
                  const res = await loginWithGoogle({
                    email: profile.email,
                    name: profile.name,
                    googleId: profile.sub,
                  });
                  setLoading(false);
                  if (res.success) {
                    navigate('/dashboard');
                  } else if (onError) {
                    onError(res.error || 'Google login failed');
                  }
                } catch (e) {
                  setLoading(false);
                  if (onError) onError('Failed to retrieve Google profile');
                }
              }
            },
          });
        } catch (err) {
          console.warn('Google OAuth2 client init notice:', err);
        }
      }
    };

    if (window.google) {
      setupGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          setupGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [clientId, loginWithGoogle, navigate, onError]);

  const handleGoogleClick = () => {
    // 1. If Google OAuth token client is initialized, request access token with account picker
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
      return;
    }

    // 2. If window.google.accounts.oauth2 is available, initialize immediately and trigger
    if (clientId && window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setLoading(true);
            try {
              const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const profile = await userRes.json();
              const res = await loginWithGoogle({
                email: profile.email,
                name: profile.name,
                googleId: profile.sub,
              });
              setLoading(false);
              if (res.success) {
                navigate('/dashboard');
              } else if (onError) {
                onError(res.error || 'Google login failed');
              }
            } catch (e) {
              setLoading(false);
              if (onError) onError('Failed to retrieve Google profile');
            }
          }
        },
      });
      tokenClientRef.current = client;
      client.requestAccessToken({ prompt: 'select_account' });
      return;
    }

    // 3. Trigger Google One Tap if ready
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={loading}
      className="btn-google"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      <span>{loading ? 'CONNECTING…' : 'CONTINUE WITH GOOGLE'}</span>
    </button>
  );
}
