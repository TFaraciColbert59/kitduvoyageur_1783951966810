import { NextRequest, NextResponse } from 'next/server';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SEC-09 / E-06 / E-10 : Purificateur serveur strict d'un kit partagé au groupe.
 * - Retire tout champ de coordonnées GPS (`latitude`, `longitude`, `lat`, `lng`, `lon`, `coords`, `gpx`)
 * - Retire tout document d'identité ou billet personnel (`documents`, `passport`, `identity`)
 * - Retire tout article marqué privé (`is_private === true`)
 * - Force `viewerCanReadDocs: false` et `readOnly: true`
 */
export function sanitizeSharedGroupKitPayload(raw: {
  memberId: string;
  memberName: string;
  memberAvatarUrl?: string | null;
  kit: Record<string, any>;
  items: Array<Record<string, any>>;
  placedBadges?: Array<Record<string, any>>;
}) {
  const safeItems = (raw.items || [])
    .filter((item) => item.is_private !== true && item.visibility !== 'private')
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Article'),
      category: item.category ? String(item.category) : null,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      weightG:
        typeof item.weight_g === 'number' && Number.isFinite(item.weight_g)
          ? item.weight_g
          : typeof item.weightG === 'number' && Number.isFinite(item.weightG)
            ? item.weightG
            : null,
      weightSource:
        item.weight_g === null || item.weight_g === undefined ? 'unknown' : 'declared',
      isChecked: Boolean(item.is_checked ?? item.isChecked),
      slotId: item.slot_id ?? item.slotId ?? null,
      slotOrder: typeof item.slot_order === 'number' ? item.slot_order : null,
      productOwnershipId: null, // Ne jamais exposer l'UUID d'inventaire personnel privé
      visual: null,
    }));

  const safeBadges = (raw.placedBadges || []).map((b) => ({
    id: String(b.id),
    badgeId: String(b.badge_id ?? b.badgeId),
    anchorId: String(b.anchor_id ?? b.anchorId),
    scale: typeof b.scale === 'number' ? b.scale : 1.0,
  }));

  return {
    memberId: raw.memberId,
    memberName: raw.memberName,
    memberAvatarUrl: raw.memberAvatarUrl ?? null,
    readOnly: true as const,
    viewerCanReadDocs: false as const,
    kit: {
      kitId: String(raw.kit.id),
      name: String(raw.kit.name || 'Kit partagé'),
      bagModelId: raw.kit.bag_model_id ?? raw.kit.bag_model ?? 'trekker-55',
      bagParts:
        raw.kit.bag_parts && typeof raw.kit.bag_parts === 'object'
          ? raw.kit.bag_parts
          : raw.kit.custom_parts && typeof raw.kit.custom_parts === 'object'
            ? raw.kit.custom_parts
            : {},
      revision: typeof raw.kit.studio_revision === 'number' ? raw.kit.studio_revision : 1,
    },
    items: safeItems,
    placedBadges: safeBadges,
  };
}

/**
 * GET /api/kit-studio/group?tripId=<uuid>&crewId=<uuid>
 * Lecture SEULE des kits explicitement partagés (`is_shared_with_group = true`) par les coéquipiers actifs.
 */
export async function GET(req: NextRequest) {
  try {
    const flags = await currentFeatureFlags();
    if (!flags.hub_camp_v1) {
      return NextResponse.json(
        { error: 'Chantier Hub Camp en cours de déploiement' },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const tripId = req.nextUrl.searchParams.get('tripId');
    const crewId = req.nextUrl.searchParams.get('crewId');

    const peerUserIds = new Set<string>();

    if (tripId) {
      const { data: participants } = await supabase
        .from('trip_participants')
        .select('user_id, status')
        .eq('trip_id', tripId)
        .eq('status', 'confirmed');

      const viewerInTrip = (participants || []).some((p: any) => p.user_id === user.id);
      if (viewerInTrip) {
        for (const p of participants || []) {
          if (p.user_id && p.user_id !== user.id) {
            peerUserIds.add(p.user_id);
          }
        }
      }
    }

    if (crewId) {
      const { data: crewMembers } = await supabase
        .from('crew_members')
        .select('user_id, status')
        .eq('crew_id', crewId)
        .eq('status', 'active');

      const viewerInCrew = (crewMembers || []).some((m: any) => m.user_id === user.id);
      if (viewerInCrew) {
        for (const m of crewMembers || []) {
          if (m.user_id && m.user_id !== user.id) {
            peerUserIds.add(m.user_id);
          }
        }
      }
    }

    if (peerUserIds.size === 0) {
      return NextResponse.json({
        members: [],
        viewerCanReadDocs: false,
      });
    }

    const peerList = Array.from(peerUserIds);

    // RLS (`materiel_kits_select_group`) + filtre explicite `is_shared_with_group = true` (défense en profondeur)
    const { data: sharedKits, error: kitsErr } = await supabase
      .from('materiel_kits')
      .select(
        'id, user_id, name, bag_model, bag_model_id, bag_parts, custom_parts, studio_revision, is_shared_with_group, updated_at'
      )
      .in('user_id', peerList)
      .eq('is_shared_with_group', true)
      .eq('is_trashed', false);

    if (kitsErr) {
      return NextResponse.json({ error: kitsErr.message }, { status: 500 });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', peerList);

    const profileById = new Map<string, any>(
      (profiles || []).map((p: any) => [p.id, p])
    );

    const kitIds = (sharedKits || []).map((k: any) => k.id);
    let itemsByKit = new Map<string, any[]>();
    let badgesByKit = new Map<string, any[]>();

    if (kitIds.length > 0) {
      const [{ data: items }, { data: placedBadges }] = await Promise.all([
        supabase
          .from('materiel_kit_items')
          .select('id, kit_id, name, category, quantity, weight_g, is_checked, slot_id, slot_order')
          .in('kit_id', kitIds),
        supabase
          .from('kit_placed_badges')
          .select('id, kit_id, badge_id, anchor_id, scale')
          .in('kit_id', kitIds),
      ]);

      for (const item of items || []) {
        const list = itemsByKit.get(item.kit_id) ?? [];
        list.push(item);
        itemsByKit.set(item.kit_id, list);
      }

      for (const b of placedBadges || []) {
        const list = badgesByKit.get(b.kit_id) ?? [];
        list.push(b);
        badgesByKit.set(b.kit_id, list);
      }
    }

    const members = (sharedKits || []).map((kit: any) => {
      const prof = profileById.get(kit.user_id);
      return sanitizeSharedGroupKitPayload({
        memberId: kit.user_id,
        memberName: prof?.display_name || prof?.username || 'Coéquipier',
        memberAvatarUrl: prof?.avatar_url ?? null,
        kit,
        items: itemsByKit.get(kit.id) ?? [],
        placedBadges: badgesByKit.get(kit.id) ?? [],
      });
    });

    return NextResponse.json({
      members,
      viewerCanReadDocs: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur lors de la lecture des kits du groupe' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Méthode interdite : les kits des membres du groupe sont en lecture seule (SEC-04)' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Méthode interdite : les kits des membres du groupe sont en lecture seule (SEC-04)' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Méthode interdite : les kits des membres du groupe sont en lecture seule (SEC-04)' },
    { status: 405 }
  );
}
