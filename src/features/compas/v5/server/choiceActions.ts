'use server';

import { z } from 'zod';
import { reportServerError } from '@/lib/observability/appErrors';
import { compasMeta, requireEditor, tripPartySize, updateTripMetadata } from '../../server/compasServer';
import { actionError, serverText } from '../../server/serverText';
import { approachLineKind, type ApproachLineKind } from '../engine/transportOptions';

/**
 * Écriture des choix de l'écran v5 : la nuit d'un jour et la façon de venir.
 *
 * Mêmes droits que les autres actions du Compas (`requireEditor` : propriétaire ou éditeur, la RLS tranche
 * ensuite). Aucune colonne ni migration nouvelle : `trip_steps.accommodation_name` et `metadata`,
 * `trips.metadata`, `trip_expenses`. Le JSON existant est fusionné, jamais écrasé, et rejouer le même
 * choix laisse la base dans le même état.
 */

export type CompasV5ChoiceResult = { success: true } | { success: false; error: string };

const uuid = z.string().uuid('compas.server.common.invalidId');
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'compas.server.common.invalidSlug')
  .max(120);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** JSON à clés triées : la base (jsonb) range les clés dans son ordre, l'égalité ne doit pas en dépendre. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isObject(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

/* ---------- Nuit d'un jour ---------- */

/** Un lien ouvert par la personne : https, ou le relais d'affiliation du site (`/go/<slug>`). Jamais `javascript:`. */
const safeLink = z
  .string()
  .max(500)
  .refine((v) => /^\/go\/[\w-]+$/.test(v) || (/^https:\/\//i.test(v) && URL.canParse(v)), 'compas.server.lodging.invalid');

const stayOptionSchema = z.object({
  id: z
    .string()
    .max(200)
    .refine((v) => /^osm:\d{1,18}$/.test(v) || (v.startsWith('noted:') && v.length > 6), 'compas.server.lodging.invalid'),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['hebergement', 'refuge', 'camping', 'bivouac']),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  price: z
    .object({
      perPerson: z.number().min(0).max(100_000),
      currency: z.string().regex(/^[A-Z]{3}$/),
      basis: z.enum(['bareme', 'partenaire']),
      asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .nullable(),
  source: z.string().max(300),
  url: safeLink.nullable(),
  partner: z.string().max(120).nullable(),
});

const staySchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  day: z.number().int().min(1).max(60),
  /** La nuit retenue ; null : effacer le choix. */
  option: stayOptionSchema.nullable(),
});

/** Écritures concurrentes sur la même étape : on relit et on rejoue, comme `updateTripMetadata`. */
const STEP_ATTEMPTS = 3;

/**
 * Retient (ou efface) la nuit d'un jour : le nom va dans `accommodation_name` de la dernière étape du jour,
 * le détail du choix dans `metadata.compas.stay`, fusionné avec le reste du JSON de l'étape.
 */
export async function compasV5SetStayAction(input: z.input<typeof staySchema>): Promise<CompasV5ChoiceResult> {
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: await serverText('compas.server.lodging.invalid') };
  const { tripId, day, option } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? (await serverText('compas.server.common.accessDenied')) };
    const { supabase } = auth;

    for (let attempt = 0; attempt < STEP_ATTEMPTS; attempt += 1) {
      const { data: steps, error: readError } = await supabase
        .from('trip_steps')
        .select('id, accommodation_name, metadata, updated_at')
        .eq('trip_id', tripId)
        .eq('day_number', day)
        .order('order_index', { ascending: false })
        .limit(1);
      const step = (steps as Array<{ id: string; accommodation_name: string | null; metadata: unknown; updated_at: string | null }> | null)?.[0];
      if (readError || !step) return actionError('compas.server.lodging.noStep');

      const meta = isObject(step.metadata) ? { ...step.metadata } : {};
      const compas = isObject(meta.compas) ? { ...meta.compas } : {};
      if (option) {
        compas.stay = {
          id: option.id,
          name: option.name,
          kind: option.kind,
          lat: option.lat,
          lon: option.lon,
          price: option.price,
          source: option.source,
          url: option.url,
          partner: option.partner,
        };
        meta.compas = compas;
      } else {
        delete compas.stay;
        if (Object.keys(compas).length) meta.compas = compas;
        else delete meta.compas;
      }
      const name = option ? option.name : null;

      // Même choix déjà en place : rien à écrire (rejouer ne change rien, pas même `updated_at`).
      if (step.accommodation_name === name && stable(step.metadata ?? {}) === stable(meta)) return { success: true };

      let query = supabase
        .from('trip_steps')
        .update({ accommodation_name: name, metadata: meta, updated_at: new Date().toISOString() })
        .eq('id', step.id);
      if (step.updated_at) query = query.eq('updated_at', step.updated_at);
      const { data: won, error } = await query.select('id');
      if (error) return actionError('compas.server.lodging.saveFailed');
      if (won?.length) return { success: true };
      // 0 ligne : une autre écriture est passée entre la lecture et la nôtre (ou les droits manquent) : on relit.
    }
    return actionError('compas.server.lodging.saveFailed');
  } catch (err) {
    await reportServerError('compas.compasV5SetStayAction', err);
    return actionError('compas.server.common.serverError');
  }
}

/* ---------- Façon de venir ---------- */

const transportSchema = z.object({
  tripId: uuid,
  tripSlug: slug,
  transport: z
    .object({
      // « bus » n'est jamais proposé par la lecture des extras : refusé plutôt que budgété à l'aveugle.
      id: z.enum(['car', 'train', 'carpool', 'flight', 'foot']),
      /** Coût total (voiture) ou par personne (train, avion) ; null sans tarif relevé (covoiturage). */
      amountEur: z.number().min(0).max(100_000).nullable(),
      perPerson: z.boolean(),
      source: z.string().trim().max(400),
    })
    .refine((t) => (t.id === 'carpool' ? t.amountEur === null : t.id === 'foot' ? t.amountEur === 0 || t.amountEur === null : t.amountEur !== null), {
      message: 'compas.server.common.invalidRequest',
    }),
});

const KEEP: Record<string, ReadonlySet<ApproachLineKind>> = {
  car: new Set<ApproachLineKind>(['car-fuel', 'toll']),
  train: new Set<ApproachLineKind>(['train']),
  flight: new Set<ApproachLineKind>(['flight']),
  carpool: new Set<ApproachLineKind>(),
  foot: new Set<ApproachLineKind>(),
};
const PRIMARY: Record<string, ApproachLineKind | undefined> = { car: 'car-fuel', train: 'train', flight: 'flight' };

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Retient la façon de venir : le choix va dans `trips.metadata.compas.transport`, et le budget prévu suit.
 * La ligne de catégorie transport du mode retenu reste (ou est créée au montant du choix, au tarif du
 * groupe), les autres lignes du trajet d'approche (carburant, vignette, train, vol) sont retirées. Le
 * covoiturage et « à pied » n'en laissent aucune : le covoiturage n'a pas de tarif relevé, et l'on ne
 * budgète pas un trajet que la personne ne fait pas comme prévu. Les lignes « sur place » et la
 * location ne sont jamais touchées.
 */
export async function compasV5SetTransportAction(input: z.input<typeof transportSchema>): Promise<CompasV5ChoiceResult> {
  const parsed = transportSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: await serverText('compas.server.common.invalidRequest') };
  const { tripId, transport } = parsed.data;
  try {
    const auth = await requireEditor(tripId);
    if ('error' in auth) return { success: false, error: auth.error ?? (await serverText('compas.server.common.accessDenied')) };
    const { supabase, trip, userId } = auth;

    // 1. Le budget prévu actuel : ce qui reste, ce qui part, ce qui manque.
    const { data: rows, error: readError } = await supabase
      .from('trip_expenses')
      .select('id, title, amount, metadata')
      .eq('trip_id', tripId)
      .eq('category', 'transport')
      .eq('is_planned', true);
    if (readError) return actionError('compas.server.common.serverError');
    const approach = ((rows ?? []) as Array<{ id: string; title: string | null; amount: unknown; metadata: unknown }>)
      .map((r) => ({
        id: r.id,
        kind: approachLineKind({
          title: r.title ?? '',
          choice: isObject(r.metadata) && typeof r.metadata.choice === 'string' ? r.metadata.choice : null,
        }),
      }))
      .filter((r): r is { id: string; kind: ApproachLineKind } => r.kind != null);
    const keep = KEEP[transport.id];
    const primary = PRIMARY[transport.id];
    const obsolete = approach.filter((r) => !keep.has(r.kind)).map((r) => r.id);
    const needsLine = primary != null && !approach.some((r) => r.kind === primary);

    // 2. La ligne du mode retenu, si le budget n'en a pas : d'abord, pour ne rien perdre en cas d'échec.
    let insertedId: string | null = null;
    if (needsLine) {
      const people = await tripPartySize(supabase, trip);
      const total = transport.perPerson ? (transport.amountEur ?? 0) * people : (transport.amountEur ?? 0);
      const title =
        transport.id === 'car' ? 'Carburant aller-retour' : transport.id === 'train' ? `Train aller-retour × ${people}` : `Vol aller-retour × ${people}`;
      const { data: inserted, error } = await supabase
        .from('trip_expenses')
        .insert({
          trip_id: tripId,
          payer_id: userId,
          title,
          amount: cents(total),
          currency: 'EUR',
          category: 'transport',
          expense_date: trip.start_date ?? new Date().toISOString().slice(0, 10),
          split_type: 'equal',
          is_planned: true,
          metadata: { choice: transport.id, basis: transport.source || 'choix de la personne', source: 'estimation' },
        })
        .select('id');
      if (error || !inserted?.length) return actionError('compas.server.common.serverError');
      insertedId = (inserted[0] as { id: string }).id;
    }

    // 3. Le choix, fusionné dans les métadonnées du voyage (le reste du JSON est intact).
    const record = { id: transport.id, amountEur: transport.amountEur, perPerson: transport.perPerson, source: transport.source };
    const { error: metaError } = await updateTripMetadata(supabase, tripId, (meta) => {
      const c = compasMeta(meta);
      if (stable(c.transport) === stable(record)) return meta;
      return { ...meta, compas: { ...c, transport: record } };
    });
    if (metaError) {
      // Le choix n'est pas rangé : la ligne créée à l'instant est retirée, le budget reste comme il était.
      if (insertedId) await supabase.from('trip_expenses').delete().eq('trip_id', tripId).eq('id', insertedId);
      return actionError('compas.server.common.serverError');
    }

    // 4. Les lignes des autres modes partent.
    if (obsolete.length) {
      const { error } = await supabase.from('trip_expenses').delete().eq('trip_id', tripId).in('id', obsolete);
      if (error) return actionError('compas.server.common.serverError');
    }
    return { success: true };
  } catch (err) {
    await reportServerError('compas.compasV5SetTransportAction', err);
    return actionError('compas.server.common.serverError');
  }
}
