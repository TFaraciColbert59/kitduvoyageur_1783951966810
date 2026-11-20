import type {
  CarnetKit,
  CarnetKitItemRow,
  CarnetMemberKit,
  HikeSessionRow,
} from './types';

interface MaterielKitRow {
  id: string;
  user_id: string;
  name: string | null;
  total_weight_g: number | null;
  is_public: boolean | null;
  is_shared_with_group: boolean | null;
}

interface MaterielKitItemRow {
  id: string;
  kit_id: string;
  name: string | null;
  category: string | null;
  weight_g: number | null;
  quantity: number | null;
  carry_mode: string | null;
  reason: string | null;
}

function normalizeCarryMode(value: string | null | undefined): 'porte' | 'sac' | 'conso' | null {
  if (value === 'porte' || value === 'sac' || value === 'conso') return value;
  return null;
}

export async function loadCarnetMemberKits(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  participantIds: string[];
  authorId: string | null;
  authorCarnetKit: CarnetKit;
  sessions: HikeSessionRow[];
  viewerId: string | null;
  isCarnetParticipant: boolean;
}): Promise<Record<string, CarnetMemberKit> | undefined> {
  const {
    client,
    participantIds,
    authorId,
    authorCarnetKit,
    sessions,
    viewerId,
    isCarnetParticipant,
  } = params;

  if (!client || participantIds.length === 0) return undefined;

  const result: Record<string, CarnetMemberKit> = {};
  if (authorId && authorCarnetKit.items.length > 0) {
    result[authorId] = {
      userId: authorId,
      kitId: null,
      kitName: null,
      totalWeightG: authorCarnetKit.totalWeightG,
      items: authorCarnetKit.items,
    };
  }

  const sessionKitByUser = new Map<string, string>();
  for (const s of sessions) {
    const uid = (s as { user_id?: string | null }).user_id;
    const kid = (s as { kit_id?: string | null }).kit_id;
    if (uid && kid && !sessionKitByUser.has(uid)) {
      sessionKitByUser.set(uid, kid);
    }
  }

  const usersNeedingKitLookup = participantIds.filter((uid) => {
    if (uid === authorId && authorCarnetKit.items.length > 0) return false;
    return true;
  });

  if (usersNeedingKitLookup.length === 0) {
    return Object.keys(result).length > 0 ? result : undefined;
  }

  const selectedKitByUser = new Map<string, MaterielKitRow>();
  const sessionKitIds = [...new Set(
    usersNeedingKitLookup
      .map((uid) => sessionKitByUser.get(uid))
      .filter((id): id is string => Boolean(id)),
  )];

  try {
    if (sessionKitIds.length > 0) {
      const { data: sessionKits } = await client
        .from('materiel_kits')
        .select('id, user_id, name, total_weight_g, is_public, is_shared_with_group')
        .in('id', sessionKitIds)
        .eq('is_trashed', false);
      for (const kit of (sessionKits ?? []) as MaterielKitRow[]) {
        if (!selectedKitByUser.has(kit.user_id)) {
          selectedKitByUser.set(kit.user_id, kit);
        }
      }
    }

    const remainingUsers = usersNeedingKitLookup.filter((uid) => !selectedKitByUser.has(uid));
    if (remainingUsers.length > 0) {
      const { data: kitsData } = await client
        .from('materiel_kits')
        .select('id, user_id, name, total_weight_g, is_public, is_shared_with_group')
        .in('user_id', remainingUsers)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false });

      for (const kit of (kitsData ?? []) as MaterielKitRow[]) {
        if (selectedKitByUser.has(kit.user_id)) continue;
        const canRead =
          kit.is_public === true ||
          (isCarnetParticipant && kit.is_shared_with_group === true) ||
          (Boolean(viewerId) && kit.user_id === viewerId);
        if (canRead) {
          selectedKitByUser.set(kit.user_id, kit);
        }
      }
    }

    const kitIdsToLoad = [...new Set([...selectedKitByUser.values()].map((k) => k.id))];
    if (kitIdsToLoad.length > 0) {
      const { data: itemsData } = await client
        .from('materiel_kit_items')
        .select('id, kit_id, name, category, weight_g, quantity, carry_mode, reason')
        .in('kit_id', kitIdsToLoad)
        .order('slot_order', { ascending: true })
        .order('created_at', { ascending: true });

      const itemsByKit = new Map<string, CarnetKitItemRow[]>();
      for (const row of (itemsData ?? []) as MaterielKitItemRow[]) {
        const list = itemsByKit.get(row.kit_id) ?? [];
        const qty = row.quantity && row.quantity > 0 ? row.quantity : 1;
        list.push({
          id: row.id,
          name: row.name?.trim() || 'Élément sans nom',
          detail: row.reason?.trim() || null,
          weightG: typeof row.weight_g === 'number' ? row.weight_g : null,
          color: null,
          category: row.category ?? null,
          quantity: qty,
          carryMode: normalizeCarryMode(row.carry_mode),
        });
        itemsByKit.set(row.kit_id, list);
      }

      for (const [uid, kit] of selectedKitByUser.entries()) {
        const items = itemsByKit.get(kit.id) ?? [];
        const computedWeight = items.reduce(
          (sum, item) => sum + (item.weightG ?? 0) * (item.quantity ?? 1),
          0,
        );
        result[uid] = {
          userId: uid,
          kitId: kit.id,
          kitName: kit.name,
          totalWeightG: computedWeight > 0 ? computedWeight : kit.total_weight_g,
          items,
        };
      }
    }
  } catch {
    // Best-effort: failure to load group member kits must never fail carnet detail page.
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
