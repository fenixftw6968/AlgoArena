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

  const fieldStyle = { position: 'relative' };

  return (
    <AuthShell
      title="Log in"
      lede="Welcome back. Pick up where you left off."
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
          <label className="zine-label" htmlFor="login-email">Email</label>
          <div style={fieldStyle}>
            <Mail size={15} className="field-icon" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="zine-field field-with-icon"
            />
          </div>
        </div>

        <div>
          <div className="row row--between" style={{ marginBottom: 6 }}>
            <label className="zine-label" htmlFor="login-pass" style={{ marginBottom: 0 }}>Password</label>
            <Link to="/forgot-password" className="auth-link-sm">Forgot password?</Link>
          </div>
          <div style={fieldStyle}>
            <Lock size={15} className="field-icon" />
            <input
              id="login-pass"
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Your password"
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn--primary"
          style={{ width: '100%', marginTop: 6 }}
        >
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        No account yet? <Link to="/signup">Create one</Link>
      </p>
    </AuthShell>
  );
}
