import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';

export default function Register() {
  const { signUp, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await signUp(email, password, fullName);
      setConfirmationSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignUp = async () => {
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
        <p className="eyebrow">Create account</p>
        <h1>Get started</h1>
        <p className="auth-copy">Set up your workspace and begin managing projects with your team.</p>

        {error && <p className="auth-error">{error}</p>}

        {confirmationSent ? (
          <p className="auth-note" role="status">
            We sent a confirmation link to {email}. Open it to confirm your email, then log in with your password.
          </p>
        ) : (
          <form className="form-stack" onSubmit={handleRegister}>
            <label className="field-group">
              <span>Full name</span>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>

            <label className="field-group">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            <PasswordField id="new-password" label="Password" value={password} onChange={setPassword} required />

            <PasswordField id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} required />

            <button type="submit">Sign up</button>
          </form>
        )}

        {!confirmationSent && (
          <div className="form-stack">
            <p className="auth-copy">Or sign up with</p>
            <button type="button" onClick={handleGoogleSignUp}>Sign up with Google</button>
          </div>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
