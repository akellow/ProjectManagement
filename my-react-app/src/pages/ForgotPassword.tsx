import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSending(true);

    try {
      await requestPasswordReset(email);
      setMessage('If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the reset email. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="brand-mark">PROJECTFLOW</div>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <p className="auth-copy">Enter the email address associated with your account and we’ll send you a secure reset link.</p>
        {message && <p className="auth-success" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field-group">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={isSending}>
            {isSending ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
