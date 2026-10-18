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
      title={submitted ? 'Check your inbox' : 'Reset password'}
      lede={submitted ? undefined : 'Enter the email on your account and we’ll send a reset link.'}
    >
      {submitted ? (
        <div>
          <div className="auth-success-icon"><CheckCircle2 size={22} /></div>
          <p className="muted" style={{ fontSize: '0.875rem', lineHeight: 1.65, marginBottom: 24 }}>{message}</p>
          <Link to="/login" className="btn btn--primary" style={{ width: '100%' }}>
            Return to login
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
              <label className="zine-label" htmlFor="fp-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} className="field-icon" />
                <input
                  id="fp-email"
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary"
              style={{ width: '100%', marginTop: 6 }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="auth-switch">
            <Link to="/login" className="row" style={{ justifyContent: 'center', gap: 6 }}>
              <ArrowLeft size={13} /> Back to login
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
