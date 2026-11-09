import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';
import GoogleLoginButton from '../../components/GoogleLoginButton/GoogleLoginButton';

const STRENGTH_TOKENS = [
  { color: 'var(--err)', label: 'Weak' },
  { color: '#8F9E6B', label: 'Fair' },
  { color: '#5E8F45', label: 'Good' },
  { color: 'var(--accent)', label: 'Strong' },
];

export default function Signup() {
  const [form, setForm]         = useState({ username: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { signup }              = useAuth();
  const navigate                = useNavigate();

  const strength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const result = await signup(form.username, form.email, form.password);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setError(result.error || 'Signup failed');
  };

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const fieldStyle = { position: 'relative' };

  return (
    <AuthShell
      title="Create account"
      lede="Join the verified algorithmic arena and track your rating."
    >
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
          <label className="zine-label" htmlFor="signup-username">Username</label>
          <div style={fieldStyle}>
            <User size={16} className="field-icon" />
            <input
              id="signup-username"
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={update('username')}
              className="zine-field field-with-icon"
              placeholder="username"
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="signup-email">Email</label>
          <div style={fieldStyle}>
            <Mail size={16} className="field-icon" />
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              className="zine-field field-with-icon"
              placeholder="Enter Email"
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="signup-pass">Password</label>
          <div style={fieldStyle}>
            <Lock size={16} className="field-icon" />
            <input
              id="signup-pass"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              className="zine-field field-with-icon field-with-icon-r"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="field-action"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {form.password && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, height: 3 }}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      borderRadius: 2,
                      background: idx < strength ? STRENGTH_TOKENS[strength - 1]?.color || 'var(--accent)' : 'var(--surface-3)',
                      transition: 'background 0.2s ease',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="mono faint" style={{ fontSize: '0.6875rem' }}>Strength</span>
                <span className="mono" style={{ fontSize: '0.6875rem', color: STRENGTH_TOKENS[strength - 1]?.color || 'var(--ink-muted)' }}>
                  {STRENGTH_TOKENS[strength - 1]?.label || 'Too short'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="zine-label" htmlFor="signup-confirm">Confirm password</label>
          <div style={fieldStyle}>
            <Lock size={16} className="field-icon" />
            <input
              id="signup-confirm"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={update('confirm')}
              className="zine-field field-with-icon"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn--primary"
          style={{ width: '100%', height: 38, marginTop: 4 }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="auth-divider">
        <span className="auth-divider-line" />
        <span className="auth-divider-text">OR</span>
        <span className="auth-divider-line" />
      </div>

      <GoogleLoginButton onError={(msg) => setError(msg)} />

      <p className="auth-switch">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
