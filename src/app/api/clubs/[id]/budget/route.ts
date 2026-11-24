import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import type { ClubBudgetEntry } from '@/features/clubs';
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
import { canReadClub, hasClubCapability, loadClubBundle } from '../../_lib/db';
import { asArray, mapBudgetEntryRow, type Row } from '../../_lib/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postBudgetSchema = z
  .object({
    eventId: z.string().uuid().nullish(),
    kind: z.enum(['income', 'expense']),
    category: z.string().trim().min(1).max(80),
    label: z.string().trim().min(2).max(160),
    amountCents: z.number().int().min(1).max(100_000_000),
    status: z.enum(['proposed', 'approved', 'paid', 'rejected']).optional(),
    notes: z.string().trim().max(500).nullish(),
    receiptUrl: z.string().trim().url().max(500).nullish(),
  })
  .strict();

const patchBudgetSchema = z
  .object({
    entryId: z.string().uuid(),
    status: z.enum(['proposed', 'approved', 'paid', 'rejected']).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    label: z.string().trim().min(2).max(160).optional(),
    amountCents: z.number().int().min(1).max(100_000_000).optional(),
    notes: z.string().trim().max(500).nullish(),
  })
  .strict();

const deleteBudgetSchema = z
  .object({
    entryId: z.string().uuid(),
  })
  .strict();

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  // Protection contre CSV formula injection (=, +, -, @)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function buildBudgetSummary(entries: readonly ClubBudgetEntry[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  let pendingExpenseCents = 0;
  let pendingCount = 0;

  for (const e of entries) {
    if (e.status === 'rejected') continue;
    if (e.status === 'proposed') {
      pendingCount += 1;
      if (e.kind === 'expense') pendingExpenseCents += e.amountCents;
      continue;
    }
    if (e.kind === 'income') incomeCents += e.amountCents;
    else expenseCents += e.amountCents;
  }

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    pendingExpenseCents,
    pendingCount,
  };
}

/** GET — budget global ou par événement, avec option d'export CSV (?format=csv). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return errorJson('not_found', 404);

  try {
    const supabase = await createClient();
    const user = await optionalUser(supabase);
    if (!user) return errorJson('unauthenticated', 401);

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle || !canReadClub(bundle)) return errorJson('not_found', 404);

    const canApprove = await hasClubCapability(
      supabase,
      id,
      user.id,
      'budget.approve_and_manage',
      bundle,
    );
    const canView =
      canApprove ||
      (await hasClubCapability(supabase, id, user.id, 'budget.view', bundle));
    if (!canView) return errorJson('forbidden', 403);

    const format = request.nextUrl.searchParams.get('format');
    if (format === 'csv' && !canApprove) {
      return errorJson('forbidden', 403);
    }

    const eventId = request.nextUrl.searchParams.get('eventId');
    let query = supabase
      .from('club_budget_entries')
      .select('*')
      .eq('club_id', id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (eventId === 'global') {
      query = query.is('event_id', null);
    } else if (eventId && isUuid(eventId)) {
      query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;
    if (error) {
      const code = (error as { code?: string }).code ?? '';
      const msg = (error as { message?: string }).message ?? '';
      if (code === '42P01' || code === 'PGRST205' || msg.includes('club_budget_entries')) {
        return json({
          data: {
            entries: [],
            summary: buildBudgetSummary([]),
            canApprove,
            canPropose: true,
            migrationPending: true,
          },
        });
      }
      return dbFailure('GET /api/clubs/[id]/budget', error);
    }

    const entries = asArray<Row>(data).map(mapBudgetEntryRow);

    if (format === 'csv') {
      const header = [
        'Date',
        'Type',
        'Catégorie',
        'Libellé',
        'Montant (€)',
        'Statut',
        'Événement',
        'Notes',
      ].join(',');
      const lines = entries.map((e) =>
        [
          csvEscape(e.createdAt.slice(0, 10)),
          csvEscape(e.kind === 'income' ? 'Recette' : 'Dépense'),
          csvEscape(e.category),
          csvEscape(e.label),
          csvEscape((e.amountCents / 100).toFixed(2)),
          csvEscape(e.status),
          csvEscape(e.eventId ?? 'Global club'),
          csvEscape(e.notes ?? ''),
        ].join(','),
      );
      const csv = [header, ...lines].join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="budget-${bundle.club.slug}.csv"`,
          'Cache-Control': 'no-store, private',
        },
      });
    }

    return json({
      data: {
        entries,
        summary: buildBudgetSummary(entries),
        canApprove,
      },
    });
  } catch (error) {
    return dbFailure('GET /api/clubs/[id]/budget', error);
  }
}

/** POST — saisir une ligne budgétaire (bénévole => status forcé à 'proposed'). */
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

    const parsed = postBudgetSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canApprove = await hasClubCapability(
      supabase,
      id,
      user.id,
      'budget.approve_and_manage',
      bundle,
    );
    const canPropose =
      canApprove ||
      (await hasClubCapability(supabase, id, user.id, 'budget.propose_expense', bundle));
    if (!canPropose) return errorJson('forbidden', 403);

    const nextStatus = canApprove ? (parsed.data.status ?? 'approved') : 'proposed';
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('club_budget_entries')
      .insert({
        club_id: id,
        event_id: parsed.data.eventId ?? null,
        kind: parsed.data.kind,
        category: parsed.data.category,
        label: parsed.data.label,
        amount_cents: parsed.data.amountCents,
        status: nextStatus,
        notes: parsed.data.notes ?? null,
        receipt_url: parsed.data.receiptUrl ?? null,
        created_by: user.id,
        approved_by: canApprove && nextStatus !== 'proposed' ? user.id : null,
        approved_at: canApprove && nextStatus !== 'proposed' ? nowIso : null,
      })
      .select('*')
      .single();
    if (error) return dbFailure('POST /api/clubs/[id]/budget', error);

    return json({ data: mapBudgetEntryRow(data as Row) }, 201);
  } catch (error) {
    return dbFailure('POST /api/clubs/[id]/budget', error);
  }
}

/** PATCH — valider, marquer payé, rejeter ou éditer une ligne budgétaire. */
export async function PATCH(
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

    const parsed = patchBudgetSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canApprove = await hasClubCapability(
      supabase,
      id,
      user.id,
      'budget.approve_and_manage',
      bundle,
    );

    const { data: existing, error: loadErr } = await supabase
      .from('club_budget_entries')
      .select('*')
      .eq('id', parsed.data.entryId)
      .eq('club_id', id)
      .maybeSingle();
    if (loadErr) return dbFailure('PATCH budget load', loadErr);
    if (!existing) return errorJson('not_found', 404);

    const existingRow = existing as Row;
    const isOwnProposed =
      String(existingRow.created_by ?? '') === user.id && existingRow.status === 'proposed';

    if (!canApprove && !isOwnProposed) {
      return errorJson('forbidden', 403);
    }
    if (!canApprove && parsed.data.status && parsed.data.status !== 'proposed') {
      return errorJson('forbidden', 403);
    }

    const nowIso = new Date().toISOString();
    const patch: Row = { updated_at: nowIso };
    if (parsed.data.category !== undefined) patch.category = parsed.data.category;
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.amountCents !== undefined) patch.amount_cents = parsed.data.amountCents;
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes ?? null;
    if (parsed.data.status !== undefined && canApprove) {
      patch.status = parsed.data.status;
      if (parsed.data.status === 'approved' || parsed.data.status === 'paid' || parsed.data.status === 'rejected') {
        patch.approved_by = user.id;
        patch.approved_at = nowIso;
      }
    }

    const { data, error } = await supabase
      .from('club_budget_entries')
      .update(patch)
      .eq('id', parsed.data.entryId)
      .eq('club_id', id)
      .select('*')
      .maybeSingle();
    if (error) return dbFailure('PATCH /api/clubs/[id]/budget', error);
    if (!data) return errorJson('not_found', 404);

    return json({ data: mapBudgetEntryRow(data as Row) });
  } catch (error) {
    return dbFailure('PATCH /api/clubs/[id]/budget', error);
  }
}

/** DELETE — supprimer une ligne budgétaire (admin ou auteur si encore 'proposed'). */
export async function DELETE(
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

    const parsed = deleteBudgetSchema.safeParse(await readJson(request));
    if (!parsed.success) return errorJson('invalid_body', 400, parsed.error.flatten());

    const bundle = await loadClubBundle(supabase, id, user.id);
    if (!bundle) return errorJson('not_found', 404);

    const canApprove = await hasClubCapability(
      supabase,
      id,
      user.id,
      'budget.approve_and_manage',
      bundle,
    );

    const { data: existing, error: loadErr } = await supabase
      .from('club_budget_entries')
      .select('created_by, status')
      .eq('id', parsed.data.entryId)
      .eq('club_id', id)
      .maybeSingle();
    if (loadErr) return dbFailure('DELETE budget load', loadErr);
    if (!existing) return errorJson('not_found', 404);

    const isOwnProposed =
      String((existing as Row).created_by ?? '') === user.id &&
      (existing as Row).status === 'proposed';
    if (!canApprove && !isOwnProposed) {
      return errorJson('forbidden', 403);
    }

    const { error } = await supabase
      .from('club_budget_entries')
      .delete()
      .eq('id', parsed.data.entryId)
      .eq('club_id', id);
    if (error) return dbFailure('DELETE /api/clubs/[id]/budget', error);

    return json({ data: { deletedEntryId: parsed.data.entryId } });
  } catch (error) {
    return dbFailure('DELETE /api/clubs/[id]/budget', error);
  }
}
