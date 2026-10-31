import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentFeatureFlags } from '@/features/hub/server/featureFlags';
import { kitMutationPayloadSchema } from '@/features/kit-studio/state/useKitStudio';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const requestSchema = z.object({
  kitId: z.string().uuid(),
  clientRevision: z.number().int().min(1),
  mutation: kitMutationPayloadSchema,
});

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

    // 4. Récupération et vérification de propriété du kit
    const { data: kit, error: kitError } = await supabase
      .from('materiel_kits')
      .select('id, user_id, studio_revision, custom_parts, bag_parts, bag_model, bag_model_id')
      .eq('id', kitId)
      .eq('user_id', user.id)
      .single();

    if (kitError || !kit) {
      return NextResponse.json(
        { error: 'Kit introuvable ou accès refusé' },
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
        .eq('id', kitId);

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
        .eq('id', kitId);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/move') {
      // Met à jour le slot_id et slot_order de l'article
      const { error: itemError } = await supabase
        .from('materiel_kit_items')
        .update({
          slot_id: mutation.payload.targetSlotId,
          slot_order: mutation.payload.slotOrder ?? null,
        })
        .eq('kit_id', kitId)
        .eq('id', mutation.payload.itemId);

      if (itemError) throw itemError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId);

      if (updateError) throw updateError;
    } else if (mutation.type === 'item/updateQuantity') {
      const { error: itemError } = await supabase
        .from('materiel_kit_items')
        .update({ quantity: mutation.payload.quantity })
        .eq('kit_id', kitId)
        .eq('id', mutation.payload.itemId);

      if (itemError) throw itemError;

      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId);

      if (updateError) throw updateError;
    } else {
      // Autre mutation (check, badge, etc.) : bump de révision
      const { error: updateError } = await supabase
        .from('materiel_kits')
        .update({ studio_revision: clientRevision })
        .eq('id', kitId);

      if (updateError) throw updateError;
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
