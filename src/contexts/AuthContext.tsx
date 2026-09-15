"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  trust_score: number;
  loyalty_points: number;
  loyalty_level: string;
  bio: string;
  location: string;
  xp: number;
  level: number;
  username?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { fullName?: string; avatarUrl?: string }) => Promise<unknown>;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fallback invité : un composant rendu hors provider (error boundary, shell
 * transitoire, rendu RSC partiel) ne doit JAMAIS crasher tout l'arbre —
 * cause du « écran blanc » constaté. Toutes les actions échouent proprement.
 */
const GUEST_AUTH_FALLBACK: AuthContextValue = {
  user: null,
  session: null,
  profile: null,
  loading: false,
  signUp: async () => {
    throw new Error('Authentification indisponible');
  },
  signIn: async () => {
    throw new Error('Authentification indisponible');
  },
  signOut: async () => {},
  getCurrentUser: async () => null,
  isEmailVerified: () => false,
  getUserProfile: async () => null,
  refreshProfile: async () => {},
};

let warnedMissingProvider = false;

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    if (!warnedMissingProvider) {
      warnedMissingProvider = true;
      console.warn('[AuthContext] useAuth hors AuthProvider — fallback invité appliqué.');
    }
    return GUEST_AUTH_FALLBACK;
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const ensureProfile = useCallback(async (authUser: User) => {
    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id,email,full_name,avatar_url,trust_score,loyalty_points,loyalty_level,bio,location,xp,level')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existing) {
        setProfile(existing as UserProfile);
        return;
      }

      // Profile missing — create it (fallback if trigger didn't fire)
      const fullName =
        (authUser.user_metadata?.full_name as string) ||
        authUser.email?.split('@')[0] ||
        '';

      const { data: created } = await supabase
        .from('user_profiles')
        .upsert(
          {
            id: authUser.id,
            email: authUser.email ?? '',
            full_name: fullName,
            trust_score: 50,
            loyalty_points: 0,
            loyalty_level: 'Explorateur',
            xp: 0,
            level: 1,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (created) setProfile(created as UserProfile);
    } catch {
      // Silently fail
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user);
      }
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err);
    }).finally(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, ensureProfile]);

  // SEC-1 — Isolation inter-comptes : tout changement d'utilisateur connecté
  // (connexion d'un autre compte ou déconnexion) purge les caches privés du
  // service worker (HTML runtime + images) pour qu'aucun HTML authentifié
  // d'un compte ne soit resservi à un autre sur le même appareil.
  const lastUserIdRef = useRef<string | null>(undefined as unknown as string | null);
  useEffect(() => {
    const currentId = user?.id ?? null;
    const prevId = lastUserIdRef.current;
    lastUserIdRef.current = currentId;
    if (prevId === undefined || prevId === currentId) return;
    navigator.serviceWorker?.controller?.postMessage({ type: 'LKDV_PURGE_PRIVATE' });
  }, [user?.id]);

  const signUp = useCallback(async (email: string, password: string, metadata: { fullName?: string; avatarUrl?: string } = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, [supabase]);

  const getCurrentUser = useCallback(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }, [supabase]);

  const isEmailVerified = useCallback(() => user?.email_confirmed_at != null, [user]);

  const getUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('user_profiles').select('id,email,full_name,avatar_url,trust_score,loyalty_points,loyalty_level,bio,location,xp,level').eq('id', user.id).single();
    if (error) return null;
    setProfile(data as UserProfile);
    return data as UserProfile;
  }, [supabase, user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await getUserProfile();
  }, [user, getUserProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      getCurrentUser,
      isEmailVerified,
      getUserProfile,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      getCurrentUser,
      isEmailVerified,
      getUserProfile,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};