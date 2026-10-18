import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

const STRENGTH_TOKENS = [
  { color: 'var(--err)', label: 'Weak' },
  { color: 'var(--warn)', label: 'Fair' },
  { color: 'var(--ok)', label: 'Good' },
  { color: 'var(--ok)', label: 'Strong' },
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

  return (
    <AuthShell
      title="Create account"
      lede="Free forever. Track progress, duel players, climb the ladder."
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
          <label className="zine-label" htmlFor="su-user">Username</label>
          <div style={{ position: 'relative' }}>
            <User size={15} className="field-icon" />
            <input
              id="su-user"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. mastermind_01"
              value={form.username}
              onChange={update('username')}
              className="zine-field field-with-icon"
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="su-email">Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={15} className="field-icon" />
            <input
              id="su-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update('email')}
              className="zine-field field-with-icon"
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="su-pass">Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} className="field-icon" />
            <input
              id="su-pass"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={update('password')}
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

          {form.password && (
            <div style={{ marginTop: 10 }}>
              <div className="strength-track">
                {[1, 2, 3, 4].map(idx => (
                  <span
                    key={idx}
                    className="strength-seg"
                    style={{
                      background: idx <= strength ? STRENGTH_TOKENS[strength - 1].color : 'var(--surface-3)',
                    }}
                  />
                ))}
              </div>
              <div className="strength-label">
                Password strength: <strong>{STRENGTH_TOKENS[strength - 1]?.label || 'Too short'}</strong>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="zine-label" htmlFor="su-conf">Confirm password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} className="field-icon" />
            <input
              id="su-conf"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={update('confirm')}
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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already registered? <Link to="/login">Log in</Link>
      </p>

      <style>{`
        .strength-track { display: flex; gap: 4px; }
        .strength-seg {
          height: 4px;
          flex: 1;
          border-radius: 999px;
          background: var(--surface-3);
          transition: background 0.2s ease;
        }
        .strength-label {
          margin-top: 7px;
          font-size: 0.75rem;
          color: var(--ink-muted);
        }
        .strength-label strong { font-weight: 500; color: var(--ink-soft); }
      `}</style>
    </AuthShell>
  );
}
