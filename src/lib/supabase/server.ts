import { createServerClient, createBrowserClient } from '@supabase/ssr';

/**
 * Chantier 0 — Sécurité : plus AUCUNE clé en dur.
 * Les variables NEXT_PUBLIC_* sont référencées statiquement (inlining Next.js
 * pour le bundle client) et validées à l'usage. Une absence est une erreur
 * explicite, jamais un fallback silencieux.
 * Voir .env.example pour les variables requises.
 */
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[LKDV] Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis. Copiez .env.example vers ' +
        '.env.local et renseignez-les (jamais commité).'
    );
  }
  return { url, anonKey };
}

export async function createClient() {
  // cookies() D'ABORD : pendant un prerender de build, l'accès aux cookies
  // bascule la page en dynamique AVANT la validation de config — un build
  // sans env-vars ne casse plus jamais la génération statique.
  if (typeof window === 'undefined') {
    try {
      const { cookies } = await import('next/headers');
      await cookies();
    } catch {
      /* ignoré */
    }
  }

  const { url, anonKey } = getSupabaseConfig();

  if (typeof window !== 'undefined') {
    return createBrowserClient(url, anonKey);
  }

  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          // Pas de forçage SameSite=None : les défauts Supabase SSR (Lax,
          // Secure en production) suffisent aux navigations top-level et
          // évitent d'exposer la session aux requêtes cross-site (CSRF).
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component read-only context — expected
        }
      },
    },
  });
}
