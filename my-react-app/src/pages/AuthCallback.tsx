import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const { user, isAuthLoading, syncEmployee } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const syncRequest = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setError('Google sign-in could not be completed. Please try again.');
      return;
    }

    let request = syncRequest.current;
    if (!request || request.userId !== user.id) {
      const newRequest = { userId: user.id, promise: syncEmployee() };
      syncRequest.current = newRequest;
      request = newRequest;
    }

    let active = true;
    request.promise
      .then(() => {
        if (active) navigate('/dashboard', { replace: true });
      })
      .catch((syncError: unknown) => {
        if (active) {
          setError(syncError instanceof Error ? syncError.message : 'Unable to set up your employee profile.');
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthLoading, navigate, syncEmployee, user]);

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="brand-mark">PROJECTFLOW</div>
        <p className="eyebrow">Google sign-in</p>
        <h1>{error ? 'Sign-in needs attention' : 'Signing you in'}</h1>
        {error
          ? <p className="auth-error" role="alert">{error} <Link to="/login">Return to sign in</Link></p>
          : <p className="auth-copy" role="status">Completing your sign-in and setting up your workspace...</p>}
      </div>
    </div>
  );
}
