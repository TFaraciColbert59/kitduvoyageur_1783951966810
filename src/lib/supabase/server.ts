import { createServerClient, createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeHl2d3pmamJmbGNicXVrcGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDc3ODcsImV4cCI6MjA5OTUyMzc4N30.-zry9a_kzwgZU_SpLuguT6P4HMbd7czPdMzBJx7ICMA';

export async function createClient() {
  if (typeof window !== 'undefined') {
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    return createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, {
                  ...options,
                  sameSite: 'none',
                  secure: true,
                })
              );
            } catch {
              // Server Component read-only context — expected
            }
          },
        },
      }
    );
  } catch {
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}
