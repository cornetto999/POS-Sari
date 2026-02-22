import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthError, Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: 'admin' | 'cashier' | null;
  displayName: string;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName: string, productPin: string) => Promise<{ error: AuthError | null; needsEmailVerification: boolean }>;
  verifySignUpOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  resendSignUpOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'cashier' | null>(null);
  const [displayName, setDisplayName] = useState('');
  const ensureRoleRpcUnavailableRef = useRef(false);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    const nextRole = (data?.role as 'admin' | 'cashier') || null;
    setRole(nextRole);
    return nextRole;
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .maybeSingle();
    setDisplayName(data?.display_name || '');
  };

  useEffect(() => {
    const ensureRole = async (userId: string) => {
      const existingRole = await fetchRole(userId);
      if (existingRole) {
        fetchProfile(userId);
        return;
      }

      if (ensureRoleRpcUnavailableRef.current) {
        await fetchProfile(userId);
        return;
      }

      const { error } = await supabase.rpc('ensure_my_role');
      if (error?.status === 404 || error?.code === 'PGRST202' || error?.code === '42883') {
        ensureRoleRpcUnavailableRef.current = true;
        await fetchProfile(userId);
        return;
      }
      if (!error) {
        await fetchRole(userId);
        await fetchProfile(userId);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(() => {
          ensureRole(session.user.id);
        }, 0);
      } else {
        setRole(null);
        setDisplayName('');
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  const signUp = async (email: string, password: string, name: string, productPin: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { display_name: name, product_pin: productPin },
      },
    });
    const needsEmailVerification = !data.session;
    return { error, needsEmailVerification };
  };

  const verifySignUpOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    return { error };
  };

  const resendSignUpOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, displayName, signIn, signUp, verifySignUpOtp, resendSignUpOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
