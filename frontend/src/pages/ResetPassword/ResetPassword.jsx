import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import api from '../../utils/api';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

const STRENGTH_TOKENS = [
  { color: 'var(--err)', label: 'Weak' },
  { color: 'var(--warn)', label: 'Fair' },
  { color: 'var(--ok)', label: 'Good' },
  { color: 'var(--ok)', label: 'Strong' },
];

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
      title={success ? 'Password updated' : 'New password'}
      lede={success ? undefined : 'Choose a new password for your account.'}
    >
      {success ? (
        <div>
          <div className="auth-success-icon"><CheckCircle2 size={22} /></div>
          <p className="muted" style={{ fontSize: '0.875rem', lineHeight: 1.65, marginBottom: 24 }}>
            Your password has been updated. You can now log in with your new credentials.
          </p>
          <Link to="/login" className="btn btn--primary" style={{ width: '100%' }}>
            Go to login
          </Link>
        </div>
      ) : (
        <>
          <AuthError>
            {error && (
              <>
                <AlertCircle size={15} />
                <span>{error}</span>
              </>
            )}
          </AuthError>

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="zine-label" htmlFor="rp-token">Reset token</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={15} className="field-icon" />
                <input
                  id="rp-token"
                  type="text"
                  required
                  placeholder="Paste the token from your email"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="zine-field field-with-icon"
                />
              </div>
            </div>

            <div>
              <label className="zine-label" htmlFor="rp-pass">New password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} className="field-icon" />
                <input
                  id="rp-pass"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="zine-field field-with-icon field-with-icon-r"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="field-action"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4].map(idx => (
                      <span
                        key={idx}
                        style={{
                          height: 4,
                          flex: 1,
                          borderRadius: 999,
                          background: idx <= strength ? STRENGTH_TOKENS[strength - 1].color : 'var(--surface-3)',
                          transition: 'background 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 7, fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    Password strength: <strong style={{ fontWeight: 500, color: 'var(--ink-soft)' }}>{STRENGTH_TOKENS[strength - 1]?.label || 'Too short'}</strong>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="zine-label" htmlFor="rp-conf">Confirm new password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} className="field-icon" />
                <input
                  id="rp-conf"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="zine-field field-with-icon"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary"
              style={{ width: '100%', marginTop: 6 }}
            >
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
