import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_CLIENT_ID = '115695859558-c2hjaqu1v539tlen8k01nem9hopufavd.apps.googleusercontent.com';

export default function GoogleLoginButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const tokenClientRef = useRef(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  const handleAccessToken = async (token) => {
    setLoading(true);
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await userRes.json();
      if (!profile || !profile.email) {
        throw new Error('Could not retrieve Google profile');
      }

      const res = await loginWithGoogle({
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
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
      if (onError) onError(e.message || 'Failed to retrieve Google profile');
    }
  };

  // Check if current window or popup was redirected with #access_token=...
  useEffect(() => {
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        // Clear hash from address bar
        window.history.replaceState(null, '', window.location.pathname);

        // If inside popup window, send to parent and close
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'GOOGLE_TOKEN_SUCCESS', token: accessToken }, '*');
          window.close();
          return;
        }

        // If inside main window
        handleAccessToken(accessToken);
      }
    }
  }, []);

  // Listen for message from OAuth popup window
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'GOOGLE_TOKEN_SUCCESS' && event.data?.token) {
        handleAccessToken(event.data.token);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (!clientId) return;

    const setupGoogle = () => {
      // 1. One Tap
      if (window.google?.accounts?.id) {
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
          window.google.accounts.id.prompt();
        } catch (e) {
          console.warn('GIS One-Tap notice:', e);
        }
      }

      // 2. Token Client
      if (window.google?.accounts?.oauth2) {
        try {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            prompt: 'select_account',
            callback: (tokenResponse) => {
              if (tokenResponse?.error) {
                setLoading(false);
                return;
              }
              if (tokenResponse?.access_token) {
                handleAccessToken(tokenResponse.access_token);
              }
            },
          });
        } catch (e) {
          console.warn('GIS OAuth2 client notice:', e);
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
      }, 150);
      return () => clearInterval(interval);
    }
  }, [clientId]);

  const openOAuthPopup = () => {
    const width = 500;
    const height = 620;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const redirectUri = window.location.origin + window.location.pathname;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token&scope=${encodeURIComponent('email profile openid')}&prompt=select_account`;

    const popup = window.open(
      authUrl,
      'GoogleOAuthWindow',
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,resizable=yes`
    );

    if (popup) {
      popup.focus();
    } else {
      // If popup is blocked by browser, redirect current window
      window.location.href = authUrl;
    }
  };

  const handleGoogleClick = () => {
    // Priority 1: Use GIS token client if initialized
    if (tokenClientRef.current) {
      try {
        tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Token client request error, falling back to popup:', err);
      }
    }

    // Priority 2: Use direct Google OAuth2 popup window
    openOAuthPopup();
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
