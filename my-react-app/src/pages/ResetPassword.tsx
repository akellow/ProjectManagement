import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import PasswordField from '../components/PasswordField';

export default function ResetPassword() {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        setHasRecoverySession(Boolean(data.session));
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(sessionError instanceof Error ? sessionError.message : 'Unable to validate the recovery link.');
        }
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(password);
      await signOut();
      navigate('/login', { replace: true, state: { message: 'Your password has been reset. Sign in with your new password.' } });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to reset your password. Request a new link and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="brand-mark">PROJECTFLOW</div>
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        {isCheckingSession ? (
          <p className="auth-copy" role="status">Verifying your secure reset link...</p>
        ) : hasRecoverySession ? (
          <>
            <p className="auth-copy">Use a strong password with at least 8 characters.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <form className="form-stack" onSubmit={handleSubmit}>
              <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} required />
              <PasswordField id="confirm-reset-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} required />
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-error" role="alert">
              This reset link is invalid or expired. Request a new link to continue.
            </p>
            <p className="auth-switch"><Link to="/forgot-password">Request another reset link</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
