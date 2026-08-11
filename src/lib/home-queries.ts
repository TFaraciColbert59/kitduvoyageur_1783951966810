export interface FeaturedCarnet {
  id: string;
  title: string;
  destination: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  author_name: string | null;
  likes_count: number | null;
  created_at: string | null;
}

import { createClient } from '@/lib/supabase/server';

export interface TrailOfDay {
  id: string;
  name: string;
  ref: string | null;
  network: string | null;
  distance_km: number | null;
}

export interface TrustStats {
  userCount: number;
  routeCount: number;
  kitCount: number;
}

// Sentier du jour — pseudo-random stable per day, revalidated every 24h
export async function getTrailOfDay(): Promise<TrailOfDay | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('hiking_routes')
      .select('id, name, ref, network, distance_km')
      .not('geom', 'is', null)
      .limit(1)
      // stable daily rotation via ordering by md5 of id+date
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) return null;

    // Client-side daily rotation: pick index based on day of year
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const idx = dayOfYear % data.length;
    return data[idx] ?? data[0] ?? null;
  } catch {
    return null;
  }
}

// Trust counters — revalidated every hour
export async function getTrustStats(): Promise<TrustStats> {
  try {
    const supabase = await createClient();

    const [usersRes, routesRes, kitsRes] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('hiking_routes').select('id', { count: 'exact', head: true }),
      supabase.from('kits').select('id', { count: 'exact', head: true }),
    ]);

    return {
      userCount: usersRes.count ?? 0,
      routeCount: routesRes.count ?? 0,
      kitCount: kitsRes.count ?? 0,
    };
  } catch {
    return { userCount: 0, routeCount: 0, kitCount: 0 };
  }
}

// Featured carnets — revalidated every hour
export async function getFeaturedCarnets(): Promise<FeaturedCarnet[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('carnets')
      .select('id, title, destination, cover_image_url, excerpt, author_name, likes_count, created_at')
      .eq('is_published', true)
      .order('likes_count', { ascending: false })
      .limit(4);

    if (error || !data) return [];
    return data as FeaturedCarnet[];
  } catch {
    return [];
  }
}

