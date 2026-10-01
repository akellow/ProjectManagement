import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login({ message }: { message?: string }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="brand-mark">PROJECTFLOW</div>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="auth-copy">Use your account details to continue to your workspace.</p>

        {message && <p className="auth-success">{message}</p>}
        {error && <p className="auth-error">{error}</p>}

        <form className="form-stack" onSubmit={handleLogin}>
          <label className="field-group">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className="field-group">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
          </label>

          <button type="submit">Sign in</button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
