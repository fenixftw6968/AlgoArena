import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import api from '../../utils/api';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

const STRENGTH_INKS = ['var(--riso-coral)', 'var(--riso-yellow)', 'var(--riso-teal)', 'var(--riso-violet)'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const tokenFromUrl            = searchParams.get('token') || '';

  const [token, setToken]               = useState(tokenFromUrl);
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Password reset token is missing. Please use the link sent to your email.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        token: token.trim(),
        newPassword: password
      });
      setSuccess(true);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to reset password. The link may have expired or is invalid.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      kicker="Security Override"
      title={success ? 'Password Updated' : 'New Password'}
      lede={success ? undefined : 'Enter and confirm your new credentials to restore access.'}
      accent="var(--riso-violet)"
    >
      {success ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'var(--riso-teal)',
            border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            transform: 'rotate(4deg)'
          }}>
            <CheckCircle2 size={30} color="#fffdf6" />
          </div>
          <p className="zine-lede" style={{ fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            Your credentials have been refreshed. You can now log into your account.
          </p>
          <Link to="/login" className="btn-primary" style={{ width: '100%' }}>
            Proceed to Login
          </Link>
        </div>
      ) : (
        <>
          <AuthError>
            {error && (
              <>
                <AlertCircle size={16} />
                <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{error}</span>
              </>
            )}
          </AuthError>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.05rem' }}>
            <div>
              <label className="zine-label" htmlFor="rp-token">Reset Security Token</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="rp-token"
                  type="text"
                  required
                  placeholder="Paste your reset token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="zine-field"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
            </div>

            <div>
              <label className="zine-label" htmlFor="rp-pass">New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="rp-pass"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="zine-field"
                  style={{ paddingLeft: '2.4rem', paddingRight: '2.4rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {password && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '0.3rem' }}>
                    {[1, 2, 3, 4].map(idx => (
                      <div
                        key={idx}
                        style={{
                          height: '8px',
                          flex: 1,
                          border: '2px solid var(--ink)',
                          background: idx <= strength ? STRENGTH_INKS[strength - 1] : 'var(--paper-sunk)',
                          transition: 'background 0.15s linear'
                        }}
                      />
                    ))}
                  </div>
                  <span className="font-mono" style={{ fontSize: '0.64rem', color: 'var(--ink-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                    Ink pressure: {STRENGTH_LABELS[strength - 1] || 'Too short'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="zine-label" htmlFor="rp-conf">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="rp-conf"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="zine-field"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.35rem', padding: '0.85rem', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Overriding...' : 'Save New Password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
