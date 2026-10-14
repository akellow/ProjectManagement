import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import GoogleAuthButton from '../components/GoogleAuthButton';

export default function Login({ message }: { message?: string }) {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetMessage = (location.state as { message?: string } | null)?.message;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await signIn(email, password);
      setError(null);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="brand-mark">PROJECTFLOW</div>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="auth-copy">Use your account details to continue to your workspace.</p>

        {(message || resetMessage) && <p className="auth-success">{message || resetMessage}</p>}
        {error && <p className="auth-error">{error}</p>}

        <form className="form-stack" onSubmit={handleLogin}>
          <label className="field-group">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <PasswordField id="current-password" label="Password" value={password} onChange={setPassword} required />

          <Link className="forgot-password-link" to="/forgot-password">Forgot your password?</Link>
          <button type="submit">Sign in</button>
        </form>

        <div className="form-stack">
          <p className="auth-copy">Or</p>
          <GoogleAuthButton label="Sign in with Google" onClick={handleGoogleLogin} />
        </div>

        <p className="auth-switch">
          Need an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
