import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { kitMutationPayloadSchema } from '@/features/kit-studio/state/useKitStudio';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const requestSchema = z.object({
  kitId: z.string().uuid(),
  clientRevision: z.number().int().min(1),
  mutation: z.union([
    kitMutationPayloadSchema,
    z.object({
      type: z.literal('options/shareGroup'),
      payload: z.object({ isSharedWithGroup: z.boolean() }),
    }),
    z.object({
      type: z.literal('options/rename'),
      payload: z.object({ name: z.string().trim().min(1).max(120) }),
    }),
  ]),
});

const createKitSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Mon sac d’expédition'),
  bagModelId: z.string().trim().min(1).max(64).default('trekker-55'),
});

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
      return NextResponse.json({
        authenticated: false,
        state: 'ok',
        kits: [{ id: 'demo-alpin-40', name: 'Sac Alpin 40 L' }],
        activeKit: {
          kitId: 'demo-alpin-40',
          name: 'Sac Alpin 40 L',
          revision: 1,
          bagModelId: 'trekker-55',
          bagParts: {
            body: { color: '#2D7A58', material: 'toile' },
            straps: { color: '#172D24', material: 'ripstop' },
            buckles: { color: '#C2B280', material: 'metal' },
          },
          isSharedWithGroup: true,
          items: [
            {
              id: 'item-1',
              productOwnershipId: null,
              name: 'Gourde inox 1L',
              category: 'Hydratation',
              quantity: 1,
              weightG: 180,
              weightSource: 'declared',
              isChecked: true,
              slotId: 'interior-main',
              slotOrder: 0,
              visual: null,
            },
            {
              id: 'item-2',
              productOwnershipId: null,
              name: 'Tente 2 places',
              category: 'Bivouac',
              quantity: 1,
              weightG: 1650,
              weightSource: 'declared',
              isChecked: true,
              slotId: 'interior-main',
              slotOrder: 1,
              visual: null,
            },
            {
              id: 'item-3',
              productOwnershipId: null,
              name: 'Duvet compact 5°C',
              category: 'Couchage',
              quantity: 1,
              weightG: 710,
              weightSource: 'declared',
              isChecked: true,
              slotId: 'interior-bottom',
              slotOrder: 0,
              visual: null,
            },
            {
              id: 'item-4',
              productOwnershipId: null,
              name: 'Lampe frontale 300lm',
              category: 'Sécurité',
              quantity: 1,
              weightG: 90,
              weightSource: 'declared',
              isChecked: true,
              slotId: 'lid-top',
              slotOrder: 0,
              visual: null,
            },
            {
              id: 'item-5',
              productOwnershipId: null,
              name: 'Trousse de premiers secours',
              category: 'Sécurité',
              quantity: 1,
              weightG: 210,
              weightSource: 'declared',
              isChecked: false,
              slotId: 'pocket-front',
              slotOrder: 0,
              visual: null,
            },
            {
              id: 'item-6',
              productOwnershipId: null,
              name: 'Réchaud à gaz compact',
              category: 'Cuisine',
              quantity: 1,
              weightG: 140,
              weightSource: 'declared',
              isChecked: true,
              slotId: 'interior-main',
              slotOrder: 2,
              visual: null,
            },
          ],
          placedBadges: [
            {
              id: 'badge-placed-1',
              badgeId: 'badge-alpin',
              anchorId: 'badge-body-front',
              scale: 1,
            },
          ],
        },
        ownedCandidates: [
          {
            ownershipId: 'cand-1',
            name: 'Filtre à eau compact',
            category: 'Hydratation',
            weightG: 85,
            condition: 'neuf',
          },
          {
            ownershipId: 'cand-2',
            name: 'Veste imperméable Hardshell',
            category: 'Vêtements',
            weightG: 360,
            condition: 'tres_bon',
          },
          {
            ownershipId: 'cand-3',
            name: 'Matelas gonflable 3 saisons',
            category: 'Couchage',
            weightG: 390,
            condition: 'bon',
          },
        ],
        badges: [
          {
            id: 'badge-alpin',
            label: 'Alpin',
            kind: 'ecusson',
            colorToken: '#2D7A58',
            earnedAt: new Date().toISOString(),
          },
          {
            id: 'badge-camp',
            label: 'Camp partagé',
            kind: 'ecusson',
            colorToken: '#4A5E53',
            earnedAt: new Date().toISOString(),
          },
          {
            id: 'badge-sommet',
            label: 'Premier 3000m',
            kind: 'trophee',
            colorToken: '#C2B280',
            earnedAt: new Date().toISOString(),
          },
        ],
        loans: [
          {
            loanId: 'loan-1',
            itemName: 'Réchaud à gaz compact',
            borrowerName: 'Camille',
            status: 'en_cours',
            returnDueAt: '2026-11-05',
          },
        ],
        catalogItems: [
          {
            id: 'cat-1',
            name: 'Bâtons de marche carbone',
            category: 'Randonnée',
            weightG: 280,
            acquisitionKind: 'boutique',
            priceEur: 49.99,
          },
          {
            id: 'cat-2',
            name: 'Popote aluminium 2 pers',
            category: 'Cuisine',
            weightG: 220,
            acquisitionKind: 'occasion',
            priceEur: 18.5,
          },
          {
            id: 'cat-3',
            name: 'Crampons légers 10 pointes',
            category: 'Alpinisme',
            weightG: 480,
            acquisitionKind: 'location',
            priceEur: 12.0,
          },
        ],
        groupMembers: [
          {
            memberId: 'mem-1',
            memberName: 'Camille',
            initials: 'CM',
            role: 'Équipier',
            isOwner: false,
            weightG: 3860,
            itemCount: 4,
            sharedCount: 2,
            config: {
              kitId: 'kit-camille',
              name: 'Sac de Camille',
              revision: 1,
              bag: {
                modelId: 'daypack-20',
                capabilities: {
                  openable: false,
                  modularPockets: false,
                  externalLashing: false,
                  rolltop: false,
                  badgeAnchors: true,
                },
                parts: {},
                declaredCapacityL: 20,
              },
              slots: {},
              items: [
                {
                  id: 'c-1',
                  name: 'Réchaud partagé',
                  category: 'Cuisine',
                  quantity: 1,
                  weightG: 140,
                  isChecked: true,
                  slotId: null,
                  slotOrder: 0,
                  visual: null,
                },
                {
                  id: 'c-2',
                  name: 'Popote duo',
                  category: 'Cuisine',
                  quantity: 1,
                  weightG: 220,
                  isChecked: true,
                  slotId: null,
                  slotOrder: 1,
                  visual: null,
                },
              ],
              placedBadges: [],
            },
          },
          {
            memberId: 'mem-2',
            memberName: 'Alex',
            initials: 'AL',
            role: 'Équipier',
            isOwner: false,
            weightG: 4050,
            itemCount: 4,
            sharedCount: 1,
            config: {
              kitId: 'kit-alex',
              name: 'Sac d’Alex',
              revision: 1,
              bag: {
                modelId: 'trekker-55',
                capabilities: {
                  openable: true,
                  modularPockets: true,
                  externalLashing: true,
                  rolltop: true,
                  badgeAnchors: true,
                },
                parts: {},
                declaredCapacityL: 55,
              },
              slots: {},
              items: [
                {
                  id: 'a-1',
                  name: 'Filtre à eau partagé',
                  category: 'Hydratation',
                  quantity: 1,
                  weightG: 85,
                  isChecked: true,
                  slotId: null,
                  slotOrder: 0,
                  visual: null,
                },
                {
                  id: 'a-2',
                  name: 'Lampe frontale 400lm',
                  category: 'Sécurité',
                  quantity: 1,
                  weightG: 95,
                  isChecked: true,
                  slotId: null,
                  slotOrder: 1,
                  visual: null,
                },
              ],
              placedBadges: [],
            },
          },
        ],
      });
    }

    const requestedKitId = req.nextUrl.searchParams.get('kitId');

    const { data: kitsData, error: kitsErr } = await supabase
      .from('materiel_kits')
      .select(
        'id, name, bag_model, bag_model_id, bag_parts, custom_parts, studio_revision, is_shared_with_group, updated_at, materiel_kit_items(id, name, category, quantity, weight_g, is_checked, slot_id, slot_order, product_ownership_id)'
      )
      .eq('user_id', user.id)
      .eq('is_trashed', false)
      .order('updated_at', { ascending: false });

    if (kitsErr) {
      return NextResponse.json(
        { state: 'error', error: kitsErr.message },
        { status: 500 }
      );
    }

    if (!kitsData || kitsData.length === 0) {
      return NextResponse.json({
        authenticated: true,
        state: 'empty',
        kits: [],
        activeKit: null,
        ownedCandidates: [],
        badges: [],
        loans: [],
        catalogItems: [],
      });
    }

    const selectedRow =
      (requestedKitId ? kitsData.find((k: any) => k.id === requestedKitId) : null) ??
      kitsData[0];

    // Lecture optionnelle des insignes épinglés et débloqués (tolérante si migration non encore jouée)
    const [{ data: placedRows }, { data: userBadgesRows }, { data: allBadgesRows }] =
      await Promise.all([
        supabase
          .from('kit_placed_badges')
          .select('id, badge_id, anchor_id, scale')
          .eq('kit_id', selectedRow.id)
          .then((r: any) => r, () => ({ data: [] })),
        supabase
          .from('user_badges')
          .select('badge_id, awarded_at')
          .eq('user_id', user.id)
          .then((r: any) => r, () => ({ data: [] })),
        supabase
          .from('badges')
          .select('id, slug, name, description, category')
          .limit(30)
          .then((r: any) => r, () => ({ data: [] })),
      ]);

    const earnedIds = new Set((userBadgesRows || []).map((ub: any) => String(ub.badge_id)));
    const badges = (allBadgesRows || []).map((b: any) => ({
      id: String(b.id),
      label: String(b.name || b.slug || 'Insigne'),
      description: String(b.description || ''),
      kind: b.category === 'patch' ? 'patch' : 'trophy',
      earned: earnedIds.has(String(b.id)),
    }));

    const items = ((selectedRow.materiel_kit_items as any[]) || []).map((i: any) => ({
      id: String(i.id),
      productOwnershipId: i.product_ownership_id ?? null,
      name: String(i.name || 'Article'),
      category: i.category ? String(i.category) : null,
      quantity: typeof i.quantity === 'number' && i.quantity > 0 ? i.quantity : 1,
      // Poids inconnu strictement préservé à null (JAMAIS forcé à 0, C-03)
      weightG:
        typeof i.weight_g === 'number' && Number.isFinite(i.weight_g)
          ? i.weight_g
          : null,
      weightSource:
        typeof i.weight_g === 'number' && Number.isFinite(i.weight_g)
          ? 'declared'
          : 'unknown',
      isChecked: Boolean(i.is_checked),
      slotId: i.slot_id ?? null,
      slotOrder: typeof i.slot_order === 'number' ? i.slot_order : null,
      visual: {
        scale: [0.06, 0.045, 0.06],
        color: 'var(--hub-bag-pine)',
      },
    }));

    const placedBadges = (placedRows || []).map((p: any) => ({
      id: String(p.id),
      badgeId: String(p.badge_id),
      anchorId: String(p.anchor_id),
      scale: typeof p.scale === 'number' ? p.scale : 1.0,
    }));

    return NextResponse.json({
      authenticated: true,
      state: 'ok',
      kits: kitsData.map((k: any) => ({ id: k.id, name: k.name })),
      activeKit: {
        kitId: selectedRow.id,
        name: selectedRow.name || 'Mon sac',
        revision:
          typeof selectedRow.studio_revision === 'number'
            ? selectedRow.studio_revision
            : 1,
        bagModelId: selectedRow.bag_model_id ?? selectedRow.bag_model ?? 'trekker-55',
        bagParts:
          selectedRow.bag_parts && typeof selectedRow.bag_parts === 'object'
            ? selectedRow.bag_parts
            : selectedRow.custom_parts && typeof selectedRow.custom_parts === 'object'
              ? selectedRow.custom_parts
              : {},
        isSharedWithGroup: Boolean(selectedRow.is_shared_with_group),
        items,
        placedBadges,
      },
      ownedCandidates: [],
      badges,
      loans: [],
      catalogItems: [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { state: 'error', error: err?.message || 'Erreur lors du chargement du Studio' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const raw = await req.json().catch(() => ({}));
    const parsed = createKitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const { data: created, error: createErr } = await supabase
      .from('materiel_kits')
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        bag_model: parsed.data.bagModelId,
        bag_model_id: parsed.data.bagModelId,
        studio_revision: 1,
        custom_parts: {},
        bag_parts: {},
        is_shared_with_group: false,
      })
      .select('id, name, bag_model_id, studio_revision')
      .single();

    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message || 'Impossible de créer le kit' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        kit: {
          kitId: created.id,
          name: created.name,
          bagModelId: created.bag_model_id ?? parsed.data.bagModelId,
          revision: created.studio_revision ?? 1,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur interne lors de la création du kit' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // 1. Vérification du feature flag hub_camp_v1
    const flags = await currentFeatureFlags();
    if (!flags.hub_camp_v1) {
      return NextResponse.json(
        { error: 'Chantier Hub Camp en cours de déploiement' },
        { status: 403 }
      );
    }

    // 2. Authentification utilisateur
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // 3. Validation de la charge utile
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    const { kitId, clientRevision, mutation } = parsed.data;

    // 4. Récupération et vérification stricte de propriété du kit (SEC-04 : écriture propriétaire uniquement)
    const { data: kit, error: kitError } = await supabase
      .from('materiel_kits')
      .select('id, user_id, studio_revision, custom_parts, bag_parts, bag_model, bag_model_id')
      .eq('id', kitId)
      .eq('user_id', user.id)
      .single();

    if (kitError || !kit) {
      return NextResponse.json(
        { error: 'Kit introuvable ou accès en écriture refusé' },
        { status: 404 }
      );
    }

    // 5. Arbitrage de révision strictement monotone (C-21)
    const currentRevision = kit.studio_revision ?? 1;
    if (clientRevision <= currentRevision) {
      return NextResponse.json(
        {
          error: 'Conflit de révision concurrente : la révision soumise est obsolète',
          serverRevision: currentRevision,
        },
        { status: 409 }
      );
    }

    // 6. Application de la mutation en base de données
    if (mutation.type === 'part/customize') {
      const existingParts = (kit.custom_parts as Record<string, unknown>) || {};
      const updatedParts = {
        ...existingParts,
        [mutation.payload.partId]: {
          ...((existingParts[mutation.payload.partId] as Record<string, unknown>) || {}),
          ...mutation.payload.config,
        },
      };

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({
          custom_parts: updatedParts,
          bag_parts: updatedParts,
          studio_revision: clientRevision,
        })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'bag/select') {
      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({
          bag_model: mutation.payload.modelId,
          bag_model_id: mutation.payload.modelId,
          custom_parts: {},
          bag_parts: {},
          studio_revision: clientRevision,
        })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/add') {
      const item = mutation.payload.item;
      const targetSlot = mutation.payload.slotId ?? item.slotId ?? null;
      // Poids inconnu conservé NULL en base (jamais forcé à 0, A-04 / C-03)
      const weightG =
        typeof item.weightG === 'number' && Number.isFinite(item.weightG)
          ? Math.max(0, Math.round(item.weightG))
          : null;

      const { error: insertError } = await supabase
        .from('materiel_kit_items')
        .insert({
          id: item.id,
          kit_id: kitId,
          user_id: user.id,
          product_ownership_id: item.productOwnershipId ?? null,
          name: item.name,
          category: item.category ?? null,
          quantity: item.quantity ?? 1,
          weight_g: weightG,
          is_checked: Boolean(item.isChecked),
          slot_id: targetSlot,
        });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/remove') {
      const { error: delError } = await supabase
        .from('materiel_kit_items')
        .delete()
        .eq('kit_id', kitId)
        .eq('user_id', user.id)
        .eq('id', mutation.payload.itemId);

      if (delError) throw delError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/check') {
      const { error: checkError } = await supabase
        .from('materiel_kit_items')
        .update({ is_checked: mutation.payload.isChecked })
        .eq('kit_id', kitId)
        .eq('user_id', user.id)
        .eq('id', mutation.payload.itemId);

      if (checkError) throw checkError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/move') {
      const { error: itemError } = await supabase
        .from('materiel_kit_items')
        .update({
          slot_id: mutation.payload.targetSlotId,
          slot_order: mutation.payload.slotOrder ?? null,
        })
        .eq('kit_id', kitId)
        .eq('user_id', user.id)
        .eq('id', mutation.payload.itemId);

      if (itemError) throw itemError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/updateQuantity') {
      const { error: itemError } = await supabase
        .from('materiel_kit_items')
        .update({ quantity: mutation.payload.quantity })
        .eq('kit_id', kitId)
        .eq('user_id', user.id)
        .eq('id', mutation.payload.itemId);

      if (itemError) throw itemError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'badge/place') {
      // SEC-08 : Vérification serveur explicite de possession de l'insigne dans user_badges
      const { data: ownedBadge, error: badgeErr } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id)
        .eq('badge_id', mutation.payload.badgeId)
        .maybeSingle();

      if (badgeErr || !ownedBadge) {
        return NextResponse.json(
          { error: 'Pose refusée : vous ne possédez pas encore cet insigne' },
          { status: 403 }
        );
      }

      const { error: upsertError } = await supabase
        .from('kit_placed_badges')
        .upsert(
          {
            kit_id: kitId,
            user_id: user.id,
            badge_id: mutation.payload.badgeId,
            anchor_id: mutation.payload.anchorId,
            scale: mutation.payload.scale ?? 1.0,
          },
          { onConflict: 'kit_id,anchor_id' }
        );

      if (upsertError) throw upsertError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'badge/remove') {
      const { error: removeErr } = await supabase
        .from('kit_placed_badges')
        .delete()
        .eq('kit_id', kitId)
        .eq('user_id', user.id)
        .eq('id', mutation.payload.placedBadgeId);

      if (removeErr) throw removeErr;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    } else if (mutation.type === 'options/shareGroup') {
      const { error: shareErr } = await supabase
        .from('materiel_kits')
        .update({
          is_shared_with_group: mutation.payload.isSharedWithGroup,
          studio_revision: clientRevision,
        })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (shareErr) throw shareErr;
    } else if (mutation.type === 'options/rename') {
      const { error: renameErr } = await supabase
        .from('materiel_kits')
        .update({
          name: mutation.payload.name,
          studio_revision: clientRevision,
        })
        .eq('id', kitId)
        .eq('user_id', user.id);

      if (renameErr) throw renameErr;
    }

    return NextResponse.json({
      success: true,
      revision: clientRevision,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
