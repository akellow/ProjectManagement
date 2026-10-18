import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import GoogleAuthButton from '../components/GoogleAuthButton';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown; error?: unknown; details?: unknown; response?: { data?: { message?: unknown } } };

    if (typeof maybe.message === 'string' && maybe.message.trim()) {
      return maybe.message;
    }

    if (typeof maybe.error === 'string' && maybe.error.trim()) {
      return maybe.error;
    }

    if (typeof maybe.details === 'string' && maybe.details.trim()) {
      return maybe.details;
    }

    if (typeof maybe.response?.data?.message === 'string' && maybe.response.data.message.trim()) {
      return maybe.response.data.message;
    }
  }

  return 'Something went wrong while creating your account. Please try again.';
}

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

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await signUp(email, password, fullName);
      setConfirmationSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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
            <p className="auth-copy">Or</p>
            <GoogleAuthButton label="Sign up with Google" onClick={handleGoogleSignUp} />
          </div>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
