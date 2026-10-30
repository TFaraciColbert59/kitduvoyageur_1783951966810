"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setMyTripsAuthUser, invalidateMyTripsSession } from '@/features/trips/client/fetchMyTrips';
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
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; avatarUrl?: string },
    captchaToken?: string
  ) => Promise<unknown>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<unknown>;
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
  // A cached profile is never painted until auth confirms its owner.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const demoAutoLoginTried = useRef(false);
  const identity = useRef<{ userId: string | null; generation: number }>({ userId: null, generation: 0 });
  const lastCacheOwner = useRef<string | null>(null);
  const authRevision = useRef(0);
  const mounted = useRef(true);
  const profileRequest = useRef<{ userId: string; generation: number; promise: Promise<void> } | null>(null);
  const profileKey = (userId: string) => `lkdv:profile:${userId}`;
  const isCurrent = useCallback((userId: string, generation: number) =>
    mounted.current && identity.current.userId === userId && identity.current.generation === generation, []);

  const publishProfile = useCallback((data: UserProfile, userId: string, generation: number) => {
    if (data.id !== userId || !isCurrent(userId, generation)) return;
    setProfile(data);
    try { window.sessionStorage.setItem(profileKey(userId), JSON.stringify(data)); } catch { /* optional cache */ }
  }, [isCurrent]);

  const ensureProfile = useCallback(async (authUser: User) => {
    const generation = identity.current.generation;
    if (!isCurrent(authUser.id, generation)) return;
    const previous = profileRequest.current;
    if (previous?.userId === authUser.id && previous.generation === generation) return previous.promise;
    const run = (async () => {
      try {
        const { data: existing, error } = await supabase
          .from('user_profiles')
          .select('id,email,full_name,avatar_url,trust_score,loyalty_points,loyalty_level,bio,location,xp,level')
          .eq('id', authUser.id)
          .maybeSingle();
        if (!isCurrent(authUser.id, generation) || error) return;
        if (existing) {
          publishProfile(existing as UserProfile, authUser.id, generation);
          return;
        }
        const fullName = (authUser.user_metadata?.full_name as string) || authUser.email?.split('@')[0] || '';
        const { data: created } = await supabase
          .from('user_profiles')
          .upsert({ id: authUser.id, email: authUser.email ?? '', full_name: fullName }, { onConflict: 'id' })
          .select().single();
        if (created) publishProfile(created as UserProfile, authUser.id, generation);
      } catch { /* Keep this account's confirmed cache available offline. */ }
    })();
    const request = { userId: authUser.id, generation, promise: run };
    profileRequest.current = request;
    void run.finally(() => {
      if (profileRequest.current === request) profileRequest.current = null;
    });
    return run;
  }, [supabase, isCurrent, publishProfile]);

  const applySession = useCallback((nextSession: Session | null, newSession = false) => {
    const nextId = nextSession?.user.id ?? null;
    const previousId = identity.current.userId;
    // Invalidate before publishing state: already-resolved requests can resume
    // before React renders/unmounts the previous account's providers.
    setMyTripsAuthUser(nextId, newSession);
    if (previousId !== nextId || newSession) {
      identity.current = { userId: nextId, generation: identity.current.generation + 1 };
      profileRequest.current = null;
      setProfile(null);
      try {
        window.sessionStorage.removeItem('lkdv:profile:current');
        const previousOwner = lastCacheOwner.current;
        if (previousOwner && previousOwner !== nextId && (nextId || navigator.onLine)) {
          window.sessionStorage.removeItem(profileKey(previousOwner));
        }
        if (nextId) {
          const raw = window.sessionStorage.getItem(profileKey(nextId));
          const cached = raw ? JSON.parse(raw) as UserProfile : null;
          if (cached?.id === nextId) setProfile(cached);
        }
      } catch { /* optional cache */ }
    }
    if (nextId) lastCacheOwner.current = nextId;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    if (nextSession?.user) void ensureProfile(nextSession.user);
    setLoading(false);
  }, [ensureProfile]);

  useEffect(() => {
    mounted.current = true;
    try { window.sessionStorage.removeItem('lkdv:profile:current'); } catch { /* optional cache */ }
    const initialRevision = authRevision.current;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authRevision.current += 1;
      applySession(nextSession, event === 'SIGNED_IN' || event === 'SIGNED_OUT');
    });
    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted.current && authRevision.current === initialRevision) applySession(initialSession);
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err);
    }).finally(() => {
      if (mounted.current && authRevision.current === initialRevision) setLoading(false);
    });
    return () => {
      mounted.current = false;
      authRevision.current += 1;
      identity.current.generation += 1;
      profileRequest.current = null;
      setMyTripsAuthUser(null);
      subscription.unsubscribe();
    };
  }, [supabase, applySession]);

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
    // Aventures gardées pour le hors ligne : un autre compte les efface ; une
    // session qui expire HORS LIGNE ne doit pas les effacer (on en a besoin
    // justement là) — seulement une déconnexion en ligne.
    if (currentId || navigator.onLine) {
      void import('@/lib/offlineStorage')
        .then((m) => m.purgeCompasSnapshots(currentId))
        .catch(() => undefined);
    }
  }, [user?.id]);

  // `captchaToken` : jeton hCaptcha (`getCaptchaToken`), exigé par Supabase dès
  // que la protection anti-robots est allumée ; absent, rien ne change.
  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata: { fullName?: string; avatarUrl?: string } = {},
    captchaToken?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) throw error;
    return data;
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (error) throw error;
    return data;
  }, [supabase]);

  const signOut = useCallback(async () => {
    // Voluntary logout must also discard the last owner after an offline
    // SIGNED_OUT(null), where user is already null but local data was retained.
    const owner = lastCacheOwner.current;
    authRevision.current += 1;
    identity.current = { userId: null, generation: identity.current.generation + 1 };
    profileRequest.current = null;
    setMyTripsAuthUser(null);
    invalidateMyTripsSession();
    setSession(null);
    setUser(null);
    setProfile(null);
    lastCacheOwner.current = null;
    try {
      window.sessionStorage.removeItem('lkdv:profile:current');
      if (owner) window.sessionStorage.removeItem(profileKey(owner));
    } catch { /* optional cache */ }
    void import('@/lib/offlineStorage')
      .then((m) => m.purgeCompasSnapshots(null))
      .catch(() => undefined);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const getCurrentUser = useCallback(async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }, [supabase]);

  const isEmailVerified = useCallback(() => user?.email_confirmed_at != null, [user]);

  const getUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const generation = identity.current.generation;
    if (!isCurrent(user.id, generation)) return null;
    const { data, error } = await supabase.from('user_profiles').select('id,email,full_name,avatar_url,trust_score,loyalty_points,loyalty_level,bio,location,xp,level').eq('id', user.id).single();
    if (error || !data || data.id !== user.id || !isCurrent(user.id, generation)) return null;
    publishProfile(data as UserProfile, user.id, generation);
    return data as UserProfile;
  }, [supabase, user, isCurrent, publishProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await getUserProfile();
  }, [user, getUserProfile]);

  /* Démo : auto-connexion une seule fois par session de navigateur.
     Le flag client est public ; les identifiants restent côté serveur. */
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_AUTO_LOGIN !== 'true') return;
    if (loading || user || demoAutoLoginTried.current) return;
    demoAutoLoginTried.current = true;
    try {
      if (window.sessionStorage.getItem('lkdv.demoAutoLogin') === '1') return;
      window.sessionStorage.setItem('lkdv.demoAutoLogin', '1');
    } catch {
      /* sessionStorage indisponible */
    }
    let cancelled = false;
    void fetch('/api/auth/demo', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => {
        if (!cancelled && response.ok) window.location.reload();
      })
      .catch(() => {
        /* le formulaire de connexion reste disponible */
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

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