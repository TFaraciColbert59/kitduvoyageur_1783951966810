import { createClient } from '@/lib/supabase/server';
import type { Participant } from '@/features/materiel/components/depart/ParticipantsEmergency';
import type { CommunityKit } from '@/features/materiel/components/depart/SimilarCommunityKits';

export interface DepartDetail {
  id: string;
  destination: string;
  startsAt: string;
  readinessScore: { grade: string; factors: string[] };
  assignedKit: { id: string; name: string; totalWeightG: number; items: { name: string; category: string | null; weight_g: number; is_checked: boolean }[] };
  weightBreakdown: { category: string; value: number }[];
  checklistPct: number;
  consumables: Record<string, number>;
  route: { coordinates: [number, number][] } | null;
  participants: Participant[];
  emergencyContact: string | null;
  similarKits: CommunityKit[];
}

const SYNTHETIC_ROUTE: [number, number][] = [
  [2.2, 46.6], [2.55, 46.75], [2.9, 46.9], [3.2, 47.1],
];

/** getDepartDetail — synthèse du prochain départ à partir du kit assigné + données réelles. */
export async function getDepartDetail(id: string): Promise<DepartDetail | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: kit, error } = await supabase
      .from('materiel_kits')
      .select('id, name, total_weight_g, consumables, trail_id, materiel_kit_items(name, category, weight_g, quantity, is_checked)')
      .eq('user_id', user.id)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !kit) return null;

    const items = (kit.materiel_kit_items ?? []) as { name: string | null; category: string | null; weight_g: number; quantity: number; is_checked: boolean }[];
    const checked = items.filter((i) => i.is_checked).length;
    const checklistPct = items.length ? Math.round((checked / items.length) * 100) : 0;

    const byCat = new Map<string, number>();
    for (const i of items) {
      const c = i.category ?? 'Autre';
      byCat.set(c, (byCat.get(c) ?? 0) + (i.weight_g ?? 0));
    }
    const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));
    const total = kit.total_weight_g ?? items.reduce((s, i) => s + (i.weight_g ?? 0), 0);
    const grade = total === 0 ? 'E' : total <= 12000 ? 'A+' : total <= 15000 ? 'B' : total <= 20000 ? 'C' : total <= 25000 ? 'D' : 'E';

    // Route réelle via trail_id (hiking_routes.geometry) sinon synthétique
    let route: { coordinates: [number, number][] } | null = null;
    if (kit.trail_id) {
      const { data: trail } = await supabase
        .from('hiking_routes')
        .select('geometry')
        .eq('id', kit.trail_id)
        .maybeSingle();
      const geom = trail?.geometry;
      if (geom) {
        try {
          const parsed = typeof geom === 'string' ? JSON.parse(geom) : geom;
          const coords = parsed?.geometry?.coordinates ?? parsed?.coordinates;
          if (Array.isArray(coords) && coords.length > 1) {
            route = { coordinates: coords.map((c: number[]) => [Number(c[0]), Number(c[1])]) as [number, number][] };
          }
        } catch {
          route = null;
        }
      }
    }
    if (!route) route = { coordinates: SYNTHETIC_ROUTE };

    // Participants réels (depart_participants)
    const { data: parts } = await supabase
      .from('depart_participants')
      .select('name, is_emergency_contact, contact')
      .eq('kit_id', kit.id);
    const participants: Participant[] = (parts ?? []).map((p, i) => ({
      name: p.name,
      initial: p.name.charAt(0).toUpperCase(),
      color: ['#5B7F55', '#4B6B7C', '#C89A3B', '#7A7365', '#A8443A'][i % 5],
    }));
    const emergency = (parts ?? []).find((p) => p.is_emergency_contact)?.contact ?? null;

    return {
      id: kit.id,
      destination: kit.name,
      startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      readinessScore: {
        grade,
        factors: [
          `Poids total ${(total / 1000).toFixed(1)} kg`,
          `${items.length} article(s) préparé(s)`,
        ],
      },
      assignedKit: {
        id: kit.id,
        name: kit.name,
        totalWeightG: total,
        items: items.map((i) => ({ name: i.name ?? 'Article', category: i.category, weight_g: i.weight_g ?? 0, is_checked: i.is_checked })),
      },
      weightBreakdown,
      checklistPct,
      consumables: (kit.consumables ?? {}) as Record<string, number>,
      route,
      participants: participants.length ? participants : [{ name: 'Vous', initial: 'V', color: '#5B7F55' }],
      emergencyContact: emergency,
      similarKits: [],
    };
  } catch (err) {
    console.error('getDepartDetail', err);
    return null;
  }
}
