import { createClient } from '@/lib/supabase/server';

export interface DepartDetail {
  id: string;
  destination: string;
  startsAt: string;
  readinessScore: { grade: string; factors: string[] };
  assignedKit: { id: string; name: string; totalWeightG: number; items: { name: string; category: string | null; weight_g: number }[] };
  weightBreakdown: { category: string; value: number }[];
}

/** getDepartDetail — synthèse du prochain départ à partir du kit assigné + inventaire. */
export async function getDepartDetail(id: string): Promise<DepartDetail | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: kit, error } = await supabase
      .from('materiel_kits')
      .select('id, name, total_weight_g, materiel_kit_items(name, category, weight_g)')
      .eq('user_id', user.id)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !kit) return null;

    const items = kit.materiel_kit_items ?? [];
    const byCat = new Map<string, number>();
    for (const i of items) {
      const c = i.category ?? 'Autre';
      byCat.set(c, (byCat.get(c) ?? 0) + (i.weight_g ?? 0));
    }
    const weightBreakdown = Array.from(byCat.entries()).map(([category, value]) => ({ category, value }));
    const total = kit.total_weight_g ?? items.reduce((s, i) => s + (i.weight_g ?? 0), 0);
    const grade = total === 0 ? 'E' : total <= 12000 ? 'A+' : total <= 15000 ? 'B' : total <= 20000 ? 'C' : total <= 25000 ? 'D' : 'E';

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
        items: items.map((i) => ({ name: i.name ?? 'Article', category: i.category, weight_g: i.weight_g ?? 0 })),
      },
      weightBreakdown,
    };
  } catch (err) {
    console.error('getDepartDetail', err);
    return null;
  }
}
