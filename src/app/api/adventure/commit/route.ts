import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildTripCommit, type CommitDraft, type TripRow, type TripStepRow } from '@/features/adventure-prep/tripCommit';
import { emitEvent } from '@/lib/events/eventBus';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { avecHeureDeDepart, HEURE_RE } from '@/features/adventure-prep/types';

export const dynamic = 'force-dynamic';

/** Ecriture : quota strict, et le depot est bloque si l'anti-rafale est sature. */
const RATE_LIMIT = {
  scope: 'prep-commit',
  limit: 20,
  windowMs: 60_000,
  failMode: 'closed' as const,
};

const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  lat: z.number(),
  lon: z.number(),
});

const itineraryStepSchema = z.object({
  id: z.string(),
  day: z.number().int().min(1),
  order: z.number().int().min(0),
  kind: z.enum(['trajet', 'arret', 'repos', 'nuit', 'ravitaillement']),
  title: z.string().min(1),
  placeName: z.string().nullable(),
  startTime: z.string().nullable(),
  durationMin: z.number().nullable(),
  reason: z.string().nullable(),
  state: z.enum(['propose', 'a_reserver', 'confirme', 'confirme_communaute']),
  kept: z.boolean(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

const totalsSchema = z.object({
  distanceKm: z.number().nullable(),
  movingMin: z.number().nullable(),
  activityMin: z.number().nullable(),
  elevGainM: z.number().nullable(),
  elevLossM: z.number().nullable(),
});

const modelSchema = z.object({
  days: z.number().int().min(1),
  steps: z.array(itineraryStepSchema),
  totals: totalsSchema,
  perDay: z.array(totalsSchema),
  metricsContext: z.enum(['terrain', 'sejour', 'voyage']),
  budgetPerPerson: z.object({
    amount: z.number().nullable(),
    currency: z.literal('EUR'),
    state: z.enum(['propose', 'a_reserver', 'confirme', 'confirme_communaute']),
  }),
  activityCount: z.number().int().min(0),
  contingencies: z.array(z.unknown()),
});

const draftSchema = z.object({
  version: z.number().int(),
  brief: z.string().nullable(),
  coverName: z.string().nullable(),
  activities: z.object({
    primary: z.string().nullable(),
    extra: z.array(z.string()),
    nights: z.array(z.string()),
  }),
  route: z.object({
    origin: placeSchema.nullable(),
    destination: placeSchema.nullable(),
    shape: z.enum(['boucle', 'aller_simple']),
  }),
  calendar: z.object({
    startDate: z.string().nullable(),
    startDateIsSuggested: z.boolean(),
    durationDays: z.number().nullable(),
    durationIsSuggested: z.boolean(),
    returnDate: z.string().nullable(),
    // Accepte l absence (jamais choisie) et la seule forme reelle. Une
    // heure hors forme est REFUSEE : elle ne doit pas atteindre la base,
    // ou elle relirait comme un fait alors que personne ne l a saisie.
    startTime: z
      .string()
      .regex(HEURE_RE, 'heure de depart attendue en HH:MM')
      .nullable()
      .optional(),
  }),
  group: z.object({
    mode: z.enum(['solo', 'groupe']),
    adults: z.number().int().min(0),
    children: z.number().int().min(0),
    hasPets: z.boolean(),
    knownMembers: z.array(z.string()),
  }),
  preferences: z.object({
    budgetPerPerson: z.number().nullable(),
    budgetLevel: z.enum(['economique', 'modere', 'confort']),
    pace: z.enum(['tranquille', 'normal', 'rapide']),
    transport: z.enum(['peigne', 'train', 'voiture', 'avion', 'mixte']),
    interests: z.array(z.string()),
    accessibilityNeeds: z.array(z.string()),
  }),
  itinerary: modelSchema.nullable(),
});

const commitSchema = z.object({ draft: draftSchema });

/** Suffixe unique : deux aventures au meme titre ne se chevauchent pas. */
function uniqueSlug(base: string, existing: ReadonlySet<string>): string {
  if (!existing.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Authentification requise pour enregistrer une aventure.' },
      { status: 401 },
    );
  }

  const limited = await enforceRateLimit(user.id, RATE_LIMIT);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requete invalide.' }, { status: 400 });
  }

  const parsed = commitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Donnees d aventure invalides.', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      { status: 400 },
    );
  }

  const { draft } = parsed.data;
  const commit = buildTripCommit(draft as CommitDraft);

  if (!draft.activities.primary || !draft.route.origin || !draft.calendar.startDate) {
    return NextResponse.json(
      { error: 'Il manque une activite, un lieu de depart ou une date.' },
      { status: 422 },
    );
  }

  const { data: slugs, error: slugError } = await supabase
    .from('trips')
    .select('slug')
    .eq('user_id', user.id);
  if (slugError) {
    return NextResponse.json(
      { error: 'Le voyage n a pas pu etre enregistre. Reessaie dans un instant.' },
      { status: 503 },
    );
  }

  const taken = new Set((slugs ?? []).map((row) => row.slug as string));

  const trip: TripRow = {
    ...commit.trip,
    slug: uniqueSlug(commit.trip.slug, taken),
    metadata: avecHeureDeDepart(commit.trip.metadata, draft.calendar.startTime ?? null),
  };

  const { data: created, error: insertError } = await supabase
    .from('trips')
    .insert({ ...trip, user_id: user.id })
    .select('id, slug')
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: 'Le voyage n a pas pu etre enregistre. Reessaie dans un instant.' },
      { status: 503 },
    );
  }

  const steps: TripStepRow[] = commit.steps;
  if (steps.length > 0) {
    const { error: stepsError } = await supabase
      .from('trip_steps')
      .insert(steps.map((step) => ({ ...step, trip_id: created.id })));
    if (stepsError) {
      await supabase.from('trips').delete().eq('id', created.id);
      return NextResponse.json(
        { error: 'Le parcours n a pas pu etre enregistre. Reessaie dans un instant.' },
        { status: 503 },
      );
    }
  }

  const { error: collabError } = await supabase
    .from('trip_collaborators')
    .insert({ trip_id: created.id, user_id: user.id, role: 'owner' });
  if (collabError) {
    await supabase.from('trip_steps').delete().eq('trip_id', created.id);
    await supabase.from('trips').delete().eq('id', created.id);
    return NextResponse.json(
      { error: 'Le voyage n a pas pu etre enregistre. Reessaie dans un instant.' },
      { status: 503 },
    );
  }

  await emitEvent({
    event_type: 'trip.created',
    actor_id: user.id,
    entity_type: 'trip',
    entity_id: created.id,
    metadata: { title: trip.title, slug: trip.slug },
    visibility: 'private',
  });

  return NextResponse.json(
    { tripId: created.id, slug: trip.slug, steps: steps.length },
    { status: 201 },
  );
}
