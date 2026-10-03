import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) navigate('/dashboard');
    else setError(result.error || 'Login failed');
  };

  return (
    <AuthShell
      title="Log In"
      lede="Sign in to resume your run of the daily puzzle gauntlet."
      accent="var(--riso-violet)"
    >
      <AuthError>
        {error && (
          <>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{error}</span>
          </>
        )}
      </AuthError>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        <div>
          <label className="zine-label" htmlFor="login-email">Email Address</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="login-email"
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="zine-field"
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem', gap: '0.5rem' }}>
            <label className="zine-label" htmlFor="login-pass" style={{ marginBottom: 0 }}>Password</label>
            <Link to="/forgot-password" className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--riso-violet)', textDecoration: 'none', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Forgot?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              id="login-pass"
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.35rem', padding: '0.85rem', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Verifying...' : 'Log In'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px dashed var(--ink-faint)', textAlign: 'center' }}>
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>
          No account yet?{' '}
          <Link to="/signup" style={{ color: 'var(--riso-coral)', fontWeight: 700, textDecoration: 'underline', textDecorationThickness: '2px' }}>
            Register
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
