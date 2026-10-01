import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import AuthShell, { AuthError } from '../../components/AuthShell/AuthShell';

export default function ForgotPassword() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState('');
  const [message, setMessage]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
      setMessage(res.data?.message || 'If an account with this email exists, a password reset link has been sent.');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to send reset link. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      kicker="Recovery Notice"
      title={submitted ? 'Check Your Inbox' : 'Reset Password'}
      lede={submitted ? undefined : 'Drop your address below and we will courier a reset link.'}
      accent="var(--riso-teal)"
    >
      {submitted ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'var(--riso-teal)',
            border: '3px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            transform: 'rotate(-4deg)'
          }}>
            <CheckCircle2 size={30} color="#fffdf6" />
          </div>
          <p className="zine-lede" style={{ fontSize: '0.9rem', marginBottom: '1.75rem' }}>{message}</p>
          <Link to="/login" className="btn-primary" style={{ width: '100%' }}>
            Return to Login
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label className="zine-label" htmlFor="fp-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--ink-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="fp-email"
                  type="email"
                  required
                  placeholder="solver@algoarena.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="zine-field"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.35rem', padding: '0.85rem', background: 'var(--riso-teal)', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Dispatching...' : 'Send Recovery Link'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px dashed var(--ink-faint)', textAlign: 'center' }}>
            <Link to="/login" className="zine-btn-sm" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={13} /> Back to Sign In
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
