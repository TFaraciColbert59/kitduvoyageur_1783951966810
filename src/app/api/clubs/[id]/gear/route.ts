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

const conditionEnum = z.enum(['new', 'good', 'worn', 'repair']);
const loanStatusEnum = z.enum([
  'approved',
  'checked_out',
  'returned',
  'overdue',
  'issue',
  'declined',
  'cancelled',
]);

const gearActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('add_item'),
      ownershipScope: z.enum(['club', 'member']).default('member'),
      name: z.string().trim().min(2).max(120),
      brand: z.string().trim().max(80).nullish(),
      category: z.string().trim().min(2).max(60).default('Bivouac & Sécurité'),
      weightG: z.number().int().min(0).max(100000).default(0),
      quantityTotal: z.number().int().min(1).max(200).default(1),
      conditionStatus: conditionEnum.default('good'),
      depositCents: z.number().int().min(0).max(500000).default(0),
      isEpi: z.boolean().default(false),
      lastInspectedAt: z.string().trim().max(32).nullish(),
      epiExpiresAt: z.string().trim().max(32).nullish(),
      description: z.string().trim().max(500).nullish(),
      imageUrl: z.string().trim().max(500).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('request_loan'),
      gearItemId: z.string().uuid(),
      quantity: z.number().int().min(1).max(50).default(1),
      eventId: z.string().uuid().nullish(),
      neededFrom: z.string().trim().max(32).nullish(),
      neededUntil: z.string().trim().max(32).nullish(),
      note: z.string().trim().max(300).nullish(),
    })
    .strict(),
  z
    .object({
      action: z.literal('update_loan'),
      loanId: z.string().uuid(),
      status: loanStatusEnum,
      checkoutCondition: conditionEnum.nullish(),
      returnCondition: conditionEnum.nullish(),
      conditionNote: z.string().trim().max(300).nullish(),
    })
    .strict(),
]);

async function canManageClubGear(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  userId: string,
): Promise<boolean> {
  const bundle = await loadClubBundle(supabase, clubId, userId);
  if (!bundle) return false;
  if (bundle.club.createdBy === userId) return true;
  const member = bundle.viewerMembership;
  if (!member || member.status !== 'active') return false;
  if (member.role === 'founder' || member.role === 'admin') return true;
  return Boolean(member.canManageGear);
}

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
        .limit(400),
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
        .limit(150);
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

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);
    const isActiveMember =
      bundle.club.createdBy === user.id || bundle.viewerMembership?.status === 'active';
    if (!isActiveMember) return errorJson('forbidden', 403);

    const body = await readJson(request);
    const parsed = gearActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('validation_error', 400, parsed.error.flatten());
    }

    if (parsed.data.action === 'add_item') {
      const {
        ownershipScope,
        name,
        brand,
        category,
        weightG,
        quantityTotal,
        conditionStatus,
        depositCents,
        isEpi,
        lastInspectedAt,
        epiExpiresAt,
        description,
        imageUrl,
      } = parsed.data;

      if (ownershipScope === 'club') {
        const allowed = await canManageClubGear(supabase, id, user.id);
        if (!allowed) return errorJson('forbidden', 403);
      }

      const { data: item, error } = await supabase
        .from('club_gear_items')
        .insert({
          club_id: id,
          owner_id: ownershipScope === 'club' ? null : user.id,
          ownership_scope: ownershipScope,
          name,
          brand: brand ?? null,
          category,
          weight_g: weightG,
          available: true,
          quantity_total: quantityTotal,
          quantity_available: quantityTotal,
          condition_status: conditionStatus,
          deposit_cents: depositCents,
          is_epi: isEpi,
          last_inspected_at: lastInspectedAt || null,
          epi_expires_at: epiExpiresAt || null,
          description: description ?? null,
          image_url: imageUrl ?? null,
        })
        .select('*')
        .single();
      if (error) return dbFailure('POST club_gear_items', error);
      return json({ item }, 201);
    }

    if (parsed.data.action === 'request_loan') {
      const { gearItemId, quantity, eventId, neededFrom, neededUntil, note } = parsed.data;
      const { data: loan, error } = await supabase.rpc('club_gear_request_loan', {
        p_club_id: id,
        p_gear_item_id: gearItemId,
        p_quantity: quantity,
        p_event_id: eventId ?? null,
        p_needed_from: neededFrom || null,
        p_needed_until: neededUntil || null,
        p_note: note ?? null,
      });
      if (error) {
        if (error.message?.includes('insufficient_stock')) return errorJson('insufficient_stock', 409);
        if (error.message?.includes('not_found')) return errorJson('not_found', 404);
        if (error.message?.includes('forbidden')) return errorJson('forbidden', 403);
        return dbFailure('RPC club_gear_request_loan', error);
      }
      return json({ loan }, 201);
    }

    const { loanId, status, checkoutCondition, returnCondition, conditionNote } = parsed.data;
    const { data: loan, error } = await supabase.rpc('club_gear_transition_loan', {
      p_club_id: id,
      p_loan_id: loanId,
      p_next_status: status,
      p_checkout_condition: checkoutCondition ?? null,
      p_return_condition: returnCondition ?? null,
      p_condition_note: conditionNote ?? null,
    });
    if (error) {
      if (error.message?.includes('insufficient_stock')) return errorJson('insufficient_stock', 409);
      if (error.message?.includes('invalid_transition')) return errorJson('invalid_transition', 400);
      if (error.message?.includes('not_found')) return errorJson('not_found', 404);
      if (error.message?.includes('forbidden')) return errorJson('forbidden', 403);
      return dbFailure('RPC club_gear_transition_loan', error);
    }
    return json({ loan });
  } catch (err) {
    return dbFailure('POST gear', err);
  }
}
