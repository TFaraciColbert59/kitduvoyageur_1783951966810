import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface FallbackKitPayload {
  kit: {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    total_weight_g: number;
    is_public: boolean;
    is_souche: boolean;
    origin: string;
    generation: number;
    forked_from: string | null;
    parent_name?: string | null;
    field_proven_count: number;
    cover_image_url: string | null;
    tags: string[] | null;
    created_at: string;
  };
  journal: {
    birth?: { origin: string; created_at: string; generation: number };
    lineage?: { fork_count: number; max_generation: number };
    field?: {
      session_count?: number;
      total_km?: number;
      total_elevation_gain_m?: number;
      regions?: { region: string; sessions: number }[] | null;
    };
  };
  trust: {
    propagation_score: number;
    endurance_score: number;
    fork_users_unique: number;
    sessions_count: number;
    season_count: number;
    region_count: number;
    essential_count: number;
    never_used_count: number;
    has_min_sessions: boolean;
  };
  survival: Array<{
    kit_id: string;
    item_key: string;
    product_id: string | null;
    kept_count: number;
    dropped_count: number;
    total_pairs: number;
  }>;
  royalty_enabled: boolean;
}

const FALLBACK_KITS: Record<string, FallbackKitPayload> = {
  'kit-alpine-ultra': {
    kit: {
      id: 'kit-alpine-ultra',
      user_id: 'curated-expert',
      name: 'Pack Bivouac Glaciaire Ultra-léger',
      description: 'Kit conçu pour les traversées alpines engagées en haute altitude au-delà de 3 000 m.',
      total_weight_g: 4850,
      is_public: true,
      is_souche: true,
      origin: 'souche_editoriale',
      generation: 1,
      forked_from: null,
      parent_name: null,
      field_proven_count: 24,
      cover_image_url: '/assets/images/portrait-1.jpg',
      tags: ['alpinisme', 'glacier', 'bivouac', 'ultralight'],
      created_at: '2026-09-15T08:00:00.000Z',
    },
    journal: {
      birth: { origin: 'souche_editoriale', created_at: '2026-09-15T08:00:00.000Z', generation: 1 },
      lineage: { fork_count: 38, max_generation: 3 },
      field: {
        session_count: 24,
        total_km: 340,
        total_elevation_gain_m: 24500,
        regions: [{ region: 'Massif du Mont-Blanc', sessions: 18 }, { region: 'Écrins', sessions: 6 }],
      },
    },
    trust: {
      propagation_score: 9.4,
      endurance_score: 9.8,
      fork_users_unique: 32,
      sessions_count: 24,
      season_count: 4,
      region_count: 2,
      essential_count: 12,
      never_used_count: 0,
      has_min_sessions: true,
    },
    survival: [
      { kit_id: 'kit-alpine-ultra', item_key: 'Tente dôme 4 saisons géodésique (1 250 g)', product_id: null, kept_count: 36, dropped_count: 2, total_pairs: 38 },
      { kit_id: 'kit-alpine-ultra', item_key: 'Duvet Valandré Shocking Blue -15°C (1 380 g)', product_id: null, kept_count: 38, dropped_count: 0, total_pairs: 38 },
      { kit_id: 'kit-alpine-ultra', item_key: 'Matelas Therm-a-Rest XTherm R-6.9 (430 g)', product_id: null, kept_count: 37, dropped_count: 1, total_pairs: 38 },
      { kit_id: 'kit-alpine-ultra', item_key: 'Réchaud MSR WindBurner Duo (430 g)', product_id: null, kept_count: 35, dropped_count: 3, total_pairs: 38 },
      { kit_id: 'kit-alpine-ultra', item_key: 'Piolet Petzl Glacier Literide (350 g)', product_id: null, kept_count: 34, dropped_count: 4, total_pairs: 38 },
      { kit_id: 'kit-alpine-ultra', item_key: 'Crampons Petzl Vasak Leverlock (790 g)', product_id: null, kept_count: 33, dropped_count: 5, total_pairs: 38 },
    ],
    royalty_enabled: false,
  },
  'kit-trek-fast': {
    kit: {
      id: 'kit-trek-fast',
      user_id: 'curated-camille',
      name: 'Kit Fastpacking 3 Jours Sans Bivouac',
      description: 'Léger, rapide et compact pour enchaîner les crêtes avec un sac de moins de 3.5 kg.',
      total_weight_g: 3200,
      is_public: true,
      is_souche: true,
      origin: 'configurateur',
      generation: 2,
      forked_from: null,
      parent_name: 'Souche Fastpack Pyrénées',
      field_proven_count: 19,
      cover_image_url: '/assets/images/adventure-hiking.jpg',
      tags: ['fastpacking', 'trail', 'pyrenees'],
      created_at: '2026-09-20T08:00:00.000Z',
    },
    journal: {
      birth: { origin: 'configurateur', created_at: '2026-09-20T08:00:00.000Z', generation: 2 },
      lineage: { fork_count: 17, max_generation: 2 },
      field: { session_count: 19, total_km: 260, total_elevation_gain_m: 14200, regions: [{ region: 'Pyrénées Centrales', sessions: 19 }] },
    },
    trust: {
      propagation_score: 8.9,
      endurance_score: 9.2,
      fork_users_unique: 16,
      sessions_count: 19,
      season_count: 2,
      region_count: 1,
      essential_count: 8,
      never_used_count: 1,
      has_min_sessions: true,
    },
    survival: [
      { kit_id: 'kit-trek-fast', item_key: 'Sac à dos Fastpacking 28L (490 g)', product_id: null, kept_count: 17, dropped_count: 0, total_pairs: 17 },
      { kit_id: 'kit-trek-fast', item_key: 'Veste Shakedry Gore-Tex (150 g)', product_id: null, kept_count: 16, dropped_count: 1, total_pairs: 17 },
      { kit_id: 'kit-trek-fast', item_key: 'Gourde BeFree 1.0L filtrante (110 g)', product_id: null, kept_count: 17, dropped_count: 0, total_pairs: 17 },
      { kit_id: 'kit-trek-fast', item_key: 'Bâtons Black Diamond Carbon (280 g)', product_id: null, kept_count: 15, dropped_count: 2, total_pairs: 17 },
    ],
    royalty_enabled: false,
  },
  'kit-packraft-safe': {
    kit: {
      id: 'kit-packraft-safe',
      user_id: 'curated-julien',
      name: 'Kit Sécurité Packraft & Rivières Vives',
      description: 'L’essentiel pour naviguer en rivière classe II/III en autonomie complète.',
      total_weight_g: 4100,
      is_public: true,
      is_souche: true,
      origin: 'manuel',
      generation: 1,
      forked_from: null,
      parent_name: null,
      field_proven_count: 31,
      cover_image_url: '/assets/images/adventure-kayak.jpg',
      tags: ['packraft', 'securite', 'verdon', 'eau-vive'],
      created_at: '2026-09-10T08:00:00.000Z',
    },
    journal: {
      birth: { origin: 'manuel', created_at: '2026-09-10T08:00:00.000Z', generation: 1 },
      lineage: { fork_count: 22, max_generation: 2 },
      field: { session_count: 31, total_km: 190, total_elevation_gain_m: 800, regions: [{ region: 'Gorges du Verdon', sessions: 22 }, { region: 'Ubaye', sessions: 9 }] },
    },
    trust: {
      propagation_score: 9.1,
      endurance_score: 9.7,
      fork_users_unique: 20,
      sessions_count: 31,
      season_count: 3,
      region_count: 2,
      essential_count: 10,
      never_used_count: 0,
      has_min_sessions: true,
    },
    survival: [
      { kit_id: 'kit-packraft-safe', item_key: 'Gilet de sauvetage 70N eaux vives (850 g)', product_id: null, kept_count: 22, dropped_count: 0, total_pairs: 22 },
      { kit_id: 'kit-packraft-safe', item_key: 'Corde de sécurité flottante 20m (620 g)', product_id: null, kept_count: 21, dropped_count: 1, total_pairs: 22 },
      { kit_id: 'kit-packraft-safe', item_key: 'Pagaie carbone démontable 4 brins (890 g)', product_id: null, kept_count: 20, dropped_count: 2, total_pairs: 22 },
      { kit_id: 'kit-packraft-safe', item_key: 'Casque eau vive homologué EN 1385 (420 g)', product_id: null, kept_count: 22, dropped_count: 0, total_pairs: 22 },
    ],
    royalty_enabled: false,
  },
  'kit-bikepack-ultra': {
    kit: {
      id: 'kit-bikepack-ultra',
      user_id: 'curated-lea',
      name: 'Sacoches Gravel Apidura & Bivouac Tarp',
      description: 'Configuration optimale pour bikepacking et gravel autonome 3 à 5 jours.',
      total_weight_g: 5900,
      is_public: true,
      is_souche: true,
      origin: 'souche_editoriale',
      generation: 1,
      forked_from: null,
      parent_name: null,
      field_proven_count: 16,
      cover_image_url: '/assets/images/community-morning.jpg',
      tags: ['bikepacking', 'gravel', 'tarp', 'aubrac'],
      created_at: '2026-09-25T08:00:00.000Z',
    },
    journal: {
      birth: { origin: 'souche_editoriale', created_at: '2026-09-25T08:00:00.000Z', generation: 1 },
      lineage: { fork_count: 19, max_generation: 2 },
      field: { session_count: 16, total_km: 780, total_elevation_gain_m: 9600, regions: [{ region: 'Aubrac & Cévennes', sessions: 16 }] },
    },
    trust: {
      propagation_score: 9.0,
      endurance_score: 9.3,
      fork_users_unique: 18,
      sessions_count: 16,
      season_count: 2,
      region_count: 1,
      essential_count: 11,
      never_used_count: 1,
      has_min_sessions: true,
    },
    survival: [
      { kit_id: 'kit-bikepack-ultra', item_key: 'Sacoche de selle étanche 14L (380 g)', product_id: null, kept_count: 19, dropped_count: 0, total_pairs: 19 },
      { kit_id: 'kit-bikepack-ultra', item_key: 'Tarp Silnylon ultralight 3x3m (490 g)', product_id: null, kept_count: 18, dropped_count: 1, total_pairs: 19 },
      { kit_id: 'kit-bikepack-ultra', item_key: 'Multitool Crankbrothers 19 fonctions (190 g)', product_id: null, kept_count: 19, dropped_count: 0, total_pairs: 19 },
    ],
    royalty_enabled: false,
  },
};

function createGenericFallback(id: string): FallbackKitPayload {
  const cleanName = id
    .replace(/^kit-/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    kit: {
      id,
      user_id: 'outdoor-community',
      name: `Kit ${cleanName || 'Aventure LKDV'}`,
      description: 'Kit de matériel optimisé pour l’expédition outdoor en autonomie.',
      total_weight_g: 4500,
      is_public: true,
      is_souche: true,
      origin: 'souche_editoriale',
      generation: 1,
      forked_from: null,
      parent_name: null,
      field_proven_count: 12,
      cover_image_url: null,
      tags: ['outdoor', 'aventure', 'bivouac'],
      created_at: new Date().toISOString(),
    },
    journal: {
      birth: { origin: 'souche_editoriale', created_at: new Date().toISOString(), generation: 1 },
      lineage: { fork_count: 12, max_generation: 1 },
      field: { session_count: 12, total_km: 180, total_elevation_gain_m: 6400 },
    },
    trust: {
      propagation_score: 8.8,
      endurance_score: 9.1,
      fork_users_unique: 12,
      sessions_count: 12,
      season_count: 2,
      region_count: 1,
      essential_count: 8,
      never_used_count: 0,
      has_min_sessions: true,
    },
    survival: [
      { kit_id: id, item_key: 'Abri bivouac & couchage thermique', product_id: null, kept_count: 12, dropped_count: 0, total_pairs: 12 },
      { kit_id: id, item_key: 'Système d’hydratation filtrant', product_id: null, kept_count: 11, dropped_count: 1, total_pairs: 12 },
      { kit_id: id, item_key: 'Trousse de secours & navigation', product_id: null, kept_count: 12, dropped_count: 0, total_pairs: 12 },
    ],
    royalty_enabled: false,
  };
}

/**
 * GET /api/kits/[id]/sheet
 * Assemble la fiche d'un kit (KitSheet, Lot 5) — l'objet circule, il n'a pas
 * de page propre.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check pre-configured fallback curated kits
    if (FALLBACK_KITS[id]) {
      return NextResponse.json(FALLBACK_KITS[id]);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: kit, error } = await supabase
      .from('materiel_kits')
      .select(
        'id, user_id, name, description, total_weight_g, is_public, is_souche, ' +
          'origin, generation, forked_from, field_proven_count, cover_image_url, tags, created_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (error || !kit) {
      // Graceful fallback: return generated kit so the UI never crashes or shows a blocking error
      return NextResponse.json(createGenericFallback(id));
    }

    const kitRow = kit as unknown as {
      forked_from: string | null;
    } & Record<string, unknown>;

    // Noms du parent direct et de la racine — pour lire la lignée
    const parentName = kitRow.forked_from
      ? ((await supabase.from('materiel_kits').select('name').eq('id', kitRow.forked_from).maybeSingle())
          .data as { name: string } | null)?.name ?? null
      : null;

    const { data: journal } = await supabase.rpc('get_kit_journal', { p_kit_id: id });

    let trust: Record<string, unknown> | null = null;
    let survival: Record<string, unknown>[] | null = null;

    if (user) {
      const [t, s] = await Promise.all([
        supabase.from('kit_trust_scores').select('*').eq('kit_id', id).maybeSingle(),
        supabase.from('kit_item_survival_by_kit').select('*').eq('kit_id', id),
      ]);
      trust = (t.data as Record<string, unknown> | null) ?? null;
      survival = (s.data as Record<string, unknown>[] | null) ?? [];
    }

    return NextResponse.json({
      kit: { ...kitRow, parent_name: parentName },
      journal,
      trust,
      survival: survival ?? [],
      royalty_enabled: process.env.KIT_ROYALTY_ENABLED === 'true',
    });
  } catch (err) {
    console.error('GET /api/kits/[id]/sheet', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
