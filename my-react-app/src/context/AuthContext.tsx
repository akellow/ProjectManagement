import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import api from '../services/api';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const syncEmployee = useCallback(async () => {
    try {
      await api.post('/Employees/sync');
    } catch {
      throw new Error('You signed in, but your employee profile could not be created. Please try again.');
    }
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to sign in with Google.');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to create account. Check your Supabase settings.');
    }
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message || 'Login failed. Check your credentials and Supabase settings.');
    }
    setUser(data.user);
    await syncEmployee();
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthLoading, signUp, signIn, signInWithGoogle, syncEmployee, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
