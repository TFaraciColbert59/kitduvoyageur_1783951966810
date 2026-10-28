'use client';

import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { Flower2, Infinity as InfinityIcon, Leaf, Snowflake, Sun } from 'lucide-react';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { Chips, CountedTextArea, ImagePicker, TextField, type ChipOption } from './wizard/fields';
import { firstIssue } from './wizard/validate';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';
import { KitBlocks } from './kit/KitBlocks';
import { KitProductPicker } from './kit/KitProductPicker';
import { summarizeSlots, toSlot, type KitSlot } from './kit/types';

export interface KitCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'kit', id: string) => void;
}

const STEPS = ['name', 'items', 'note', 'share'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = {
  name: 'Nom',
  items: 'Éléments',
  note: 'Usage',
  share: 'Partage',
};

const SEASONS: ReadonlyArray<ChipOption<string>> = [
  {
    id: 'toute_saison',
    label: 'Toute saison',
    icon: <InfinityIcon size={16} aria-hidden="true" />,
  },
  { id: 'printemps', label: 'Printemps', icon: <Flower2 size={16} aria-hidden="true" /> },
  { id: 'ete', label: 'Été', icon: <Sun size={16} aria-hidden="true" /> },
  { id: 'automne', label: 'Automne', icon: <Leaf size={16} aria-hidden="true" /> },
  { id: 'hiver', label: 'Hiver', icon: <Snowflake size={16} aria-hidden="true" /> },
];

type Visibility = 'public' | 'private';
const VISIBILITIES: ReadonlyArray<ChipOption<Visibility>> = [
  { id: 'public', label: 'Public', icon: <Icon name="globe" size={16} aria-hidden="true" /> },
  { id: 'private', label: 'Privé', icon: <Icon name="lock" size={16} aria-hidden="true" /> },
];

const INITIAL = {
  name: '',
  season: 'toute_saison',
  slots: [] as KitSlot[],
  description: '',
  visibility: 'public' as Visibility,
};

const nameSchema = z.object({ name: z.string().trim().min(1, 'Donne un nom à ton kit.') });

export function KitCreateForm({ onClose, user, onCreated }: KitCreateFormProps) {
  const { values, patch, clear } = useDraftedForm('kit', user?.id, INITIAL);
  const [cover, setCover] = useState<File | null>(null);
  const [picking, setPicking] = useState(false);
  const slots = Array.isArray(values.slots) ? values.slots : [];

  const flow = useCreateFlow<Step>({
    steps: STEPS,
    validate: (step) => {
      if (step === 'name') return firstIssue(nameSchema, values);
      if (step === 'items')
        return slots.length === 0 ? 'Ajoute au moins un élément à ton kit.' : null;
      return null;
    },
    submit: async () => {
      if (!user?.id) throw new Error('Connecte-toi pour créer un kit.');
      const supabase = createClient();
      const coverUrl = await uploadCoverImage(cover, user.id);
      const name = values.name.trim();
      const description = values.description.trim();
      const { data, error: insertError } = await supabase
        .from('materiel_kits')
        .insert({
          user_id: user.id,
          name,
          description: description || null,
          season: values.season,
          total_weight_g: summarizeSlots(slots).weightG,
          is_public: values.visibility === 'public',
          cover_image_url: coverUrl,
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du kit refusée.');
      if (slots.length > 0) {
        const { error: itemsError } = await supabase.from('materiel_kit_items').insert(
          slots.map((slot) => ({
            kit_id: data.id,
            user_id: user.id,
            product_ownership_id: slot.ownershipId,
            product_id: slot.productId,
            name: slot.name,
            category: slot.category,
            weight_g: slot.weightG ?? 0,
            quantity: 1,
            is_checked: false,
          }))
        );
        if (itemsError) {
          // Un kit sans ses éléments serait trompeur : on le retire plutôt que de le laisser vide.
          await supabase.from('materiel_kits').delete().eq('id', data.id);
          throw new Error(itemsError.message || 'Enregistrement des éléments refusé.');
        }
      }
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**${name}**\n\n${description || 'Mon kit de matériel.'}\n\n/materiel`,
          postType: 'share',
          imageUrl: coverUrl,
          linkedKitId: data.id,
          title: name,
        });
      } catch {
        /* le kit existe ; la publication d'annonce est facultative */
      }
      clear();
      setCover(null);
      onCreated('kit', data.id);
      onClose();
    },
  });

  // Un message « ajoute un élément » n'a plus lieu d'être dès qu'un bloc est rempli.
  const { setError } = flow;
  useEffect(() => {
    if (slots.length > 0) setError(null);
  }, [setError, slots.length]);

  return (
    <WizardFrame
      step={flow.wizard.step}
      total={flow.wizard.total}
      kicker={KICKERS[flow.current]}
      error={flow.error}
      busy={flow.busy}
      nextLabel={flow.wizard.isLast ? 'Créer le kit' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
    >
      {flow.current === 'name' ? (
        <>
          <TextField
            label="Nom du kit"
            value={values.name}
            onChange={(name) => patch({ name })}
            maxLength={100}
            placeholder="Kit bivouac 3 saisons"
          />
          <Chips
            label="Saison"
            options={SEASONS}
            value={values.season}
            onChange={(season) => patch({ season })}
          />
        </>
      ) : null}

      {flow.current === 'items' ? (
        <>
          <KitBlocks
            slots={slots}
            onAdd={() => setPicking(true)}
            onRemove={(key) => patch({ slots: slots.filter((slot) => slot.key !== key) })}
          />
          {slots.length > 0 ? (
            <p className="lkdv-kb-total" role="status">
              {slots.length} élément{slots.length > 1 ? 's' : ''}
              {summarizeSlots(slots).weightG > 0
                ? ` · ${(summarizeSlots(slots).weightG / 1000).toFixed(1).replace('.', ',')} kg`
                : ''}
              {summarizeSlots(slots).unknown > 0
                ? ` · poids de ${summarizeSlots(slots).unknown} à vérifier`
                : ''}
            </p>
          ) : null}
          {picking ? (
            <KitProductPicker
              userId={user?.id}
              onClose={() => setPicking(false)}
              onPick={(product) => {
                patch({ slots: [...slots, toSlot(product)] });
                setPicking(false);
              }}
            />
          ) : null}
        </>
      ) : null}

      {flow.current === 'note' ? (
        <CountedTextArea
          label="Usage et particularités"
          value={values.description}
          onChange={(description) => patch({ description })}
          max={1000}
          placeholder="Terrain, durée, ce qui le rend spécial…"
        />
      ) : null}

      {flow.current === 'share' ? (
        <>
          <ImagePicker
            label="Photo du kit (facultatif)"
            file={cover}
            onChange={setCover}
            aspect="16 / 9"
          />
          <Chips
            label="Qui peut le voir ?"
            options={VISIBILITIES}
            value={values.visibility}
            onChange={(visibility) => patch({ visibility })}
          />
        </>
      ) : null}
    </WizardFrame>
  );
}

export default KitCreateForm;
