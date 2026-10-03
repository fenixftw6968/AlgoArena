import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

const STRENGTH_INKS = ['var(--riso-coral)', 'var(--riso-yellow)', 'var(--riso-teal)', 'var(--riso-violet)'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

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
      title="Join Us"
      lede="Claim your copy of the daily puzzle gauntlet. Free forever, no fine print."
      accent="var(--riso-coral)"
    >
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
          <label className="zine-label" htmlFor="su-user">Username</label>
          <div style={{ position: 'relative' }}>
            <User size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="su-user"
              type="text"
              required
              placeholder="Mastermind_01"
              value={form.username}
              onChange={update('username')}
              className="zine-field"
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="su-email">Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="su-email"
              type="email"
              required
              placeholder="Enter your email"
              value={form.email}
              onChange={update('email')}
              className="zine-field"
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
        </div>

        <div>
          <label className="zine-label" htmlFor="su-pass">Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="su-pass"
              type={showPass ? 'text' : 'password'}
              required
              placeholder="••••••••••••"
              value={form.password}
              onChange={update('password')}
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

          {form.password && (
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
          <label className="zine-label" htmlFor="su-conf">Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="su-conf"
              type={showPass ? 'text' : 'password'}
              required
              placeholder="••••••••••••"
              value={form.confirm}
              onChange={update('confirm')}
              className="zine-field"
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.35rem', padding: '0.85rem', background: 'var(--riso-coral)', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Printing...' : 'Create Account'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px dashed var(--ink-faint)', textAlign: 'center' }}>
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--riso-violet)', fontWeight: 700, textDecoration: 'underline', textDecorationThickness: '2px' }}>
            Log in
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
