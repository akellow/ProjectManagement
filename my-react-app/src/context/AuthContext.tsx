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

  const updateProfilePicture = async (file: File) => {
    if (!user?.id) throw new Error('You must be signed in to update your profile picture.');

    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[file.type];
    if (!extension) throw new Error('Choose a JPG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw new Error('The profile picture must be 5 MB or smaller.');

    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: true });
    if (uploadError) throw new Error(`Unable to upload your profile picture: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        avatar_url: publicUrlData.publicUrl,
      },
    });
    if (error) {
      const { error: cleanupError } = await supabase.storage.from('avatars').remove([path]);
      const cleanupMessage = cleanupError ? ` The uploaded image could not be cleaned up: ${cleanupError.message}` : '';
      throw new Error(`The image uploaded, but your profile could not be updated: ${error.message}.${cleanupMessage}`);
    }

    setUser(data.user);
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message || 'Unable to send a password recovery email.');
    }
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message || 'Unable to update your password.');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthLoading, signUp, signIn, signInWithGoogle, requestPasswordReset, updatePassword, updateProfilePicture, syncEmployee, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
