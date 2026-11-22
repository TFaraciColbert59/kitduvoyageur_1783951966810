import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  csrfFailure,
  dbFailure,
  errorJson,
  hasValidOrigin,
  isUuid,
  json,
  optionalUser,
  readJson,
} from '../../_lib/http';
import { canReadClub, loadClubBundle } from '../../_lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const gearActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('add_item'),
      name: z.string().trim().min(2).max(120),
      brand: z.string().trim().max(80).nullish(),
      category: z.string().trim().min(2).max(60).default('Bivouac & Sécurité'),
      weightG: z.number().int().min(0).max(100000).default(0),
    })
    .strict(),
  z
    .object({
      action: z.literal('request_loan'),
      gearItemId: z.string().uuid(),
      neededFrom: z.string().trim().max(32).nullish(),
      neededUntil: z.string().trim().max(32).nullish(),
      note: z.string().trim().max(300).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('update_loan'),
      loanId: z.string().uuid(),
      status: z.enum(['approved', 'returned', 'declined']),
    })
    .strict(),
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    const bundle = await loadClubBundle(supabase, id, user?.id ?? null);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const [{ data: items, error: itemsErr }, { data: kits, error: kitsErr }] = await Promise.all([
      supabase
        .from('club_gear_items')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('club_standard_kits')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (itemsErr) return dbFailure('GET club_gear_items', itemsErr);
    if (kitsErr) return dbFailure('GET club_standard_kits', kitsErr);

    let loans: unknown[] = [];
    if (user) {
      const { data: loanRows } = await supabase
        .from('club_gear_loans')
        .select('*')
        .eq('club_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      loans = loanRows ?? [];
    }

    return json({
      items: items ?? [],
      standardKits: kits ?? [],
      loans,
    });
  } catch (err) {
    return dbFailure('GET gear', err);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasValidOrigin(request)) return csrfFailure();
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const body = await readJson(request);
    const parsed = gearActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('validation_error', 400, parsed.error.flatten());
    }

    if (parsed.data.action === 'add_item') {
      const { name, brand, category, weightG } = parsed.data;
      const { data: item, error } = await supabase
        .from('club_gear_items')
        .insert({
          club_id: id,
          owner_id: user.id,
          name,
          brand: brand ?? null,
          category,
          weight_g: weightG,
          available: true,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST club_gear_items', error);
      return json({ item }, 201);
    }

    if (parsed.data.action === 'request_loan') {
      const { gearItemId, neededFrom, neededUntil, note } = parsed.data;
      const { data: loan, error } = await supabase
        .from('club_gear_loans')
        .insert({
          gear_item_id: gearItemId,
          club_id: id,
          borrower_id: user.id,
          status: 'requested',
          needed_from: neededFrom || null,
          needed_until: neededUntil || null,
          note: note ?? null,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST club_gear_loans', error);
      return json({ loan }, 201);
    }

    const { loanId, status } = parsed.data;
    const { data: loan, error } = await supabase
      .from('club_gear_loans')
      .update({ status })
      .eq('id', loanId)
      .eq('club_id', id)
      .select('*')
      .single();
    if (error) return dbFailure('UPDATE club_gear_loans', error);
    return json({ loan });
  } catch (err) {
    return dbFailure('POST gear', err);
  }
}
