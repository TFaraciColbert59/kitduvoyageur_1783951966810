import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prêts du drawer Profil.
 *
 * - `request` : le prêteur enregistre une offre sur un objet qu'il possède.
 * - `accept`  : l'emprunteur confirme le prêt (`en_cours`), idempotent.
 * - `decline` : le prêteur retire une demande non exécutée.
 * - `return`  : marque le prêt rendu (`rendu` + date de retour).
 * - `rate`    : note le prêt rendu (le prêteur note l'emprunteur, et inversement).
 * - `dispute` : passe le prêt en litige.
 *
 * Toutes les lectures/écritures sont bornées à `lender_id` OU `borrower_id` de
 * l'utilisateur, en plus de la RLS `materiel_loans` : aucune clé service.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LOAN_COLUMNS =
  'id,product_ownership_id,lender_id,borrower_id,borrower_contact,status,loaned_at,due_date,returned_at,lender_rating,borrower_rating';

const bodySchema = z
  .object({
    action: z.enum(['request', 'accept', 'decline', 'return', 'rate', 'dispute']),
    loanId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    borrowerId: z.string().uuid().optional(),
    counterpart: z.string().trim().min(1).max(160).optional(),
    dueDate: z.string().regex(DATE_RE).optional(),
    rating: z.number().min(1).max(5).multipleOf(0.5).optional(),
  })
  .strict();

type LoanRow = {
  id: string;
  product_ownership_id: string;
  lender_id: string;
  borrower_id: string | null;
  borrower_contact: string | null;
  status: string;
  loaned_at: string | null;
  due_date: string | null;
  returned_at: string | null;
  lender_rating: number | string | null;
  borrower_rating: number | string | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Filtre « prêt dont je suis partie prenante » : jamais celui d'un tiers. */
function involvedFilter(userId: string): string {
  return `lender_id.eq.${userId},borrower_id.eq.${userId}`;
}

async function loadLoan(
  supabase: Supabase,
  userId: string,
  loanId: string
): Promise<{ loan: LoanRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('materiel_loans')
    .select(LOAN_COLUMNS)
    .or(involvedFilter(userId))
    .eq('id', loanId)
    .maybeSingle();

  return { loan: (data ?? null) as LoanRow | null, error };
}

async function writeLoan(
  supabase: Supabase,
  userId: string,
  loanId: string,
  patch: Record<string, unknown>
): Promise<{ loan: LoanRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from('materiel_loans')
    .update(patch)
    .eq('id', loanId)
    .or(involvedFilter(userId))
    .select(LOAN_COLUMNS)
    .single();

  return { loan: (data ?? null) as LoanRow | null, error };
}

function isActive(loan: LoanRow): boolean {
  return loan.status === 'en_cours' || loan.status === 'en_retard';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: 'unauthenticated' }, 401);
  // Un identifiant non UUID ne doit jamais entrer dans le filtre PostgREST.
  if (!UUID_RE.test(user.id)) return json({ error: 'server_error' }, 500);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const actionInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'action');
    return json({ error: actionInvalid ? 'invalid_action' : 'invalid_body' }, 400);
  }
  const body = parsed.data;

  try {
    switch (body.action) {
      case 'request': {
        if (!body.itemId || (!body.borrowerId && !body.counterpart)) {
          return json({ error: 'invalid_body' }, 400);
        }
        if (body.borrowerId === user.id) {
          return json({ error: 'invalid_counterpart' }, 400);
        }

        const { data: owned, error: ownedError } = await supabase
          .from('product_ownership')
          .select('id')
          .eq('id', body.itemId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (ownedError) return json({ error: 'server_error' }, 500);
        if (!owned) return json({ error: 'forbidden' }, 403);

        const { data: loan, error } = await supabase
          .from('materiel_loans')
          .insert({
            product_ownership_id: body.itemId,
            lender_id: user.id,
            borrower_id: body.borrowerId ?? null,
            borrower_contact: body.counterpart ?? null,
            status: 'en_cours',
            loaned_at: today(),
            due_date: body.dueDate ?? null,
          })
          .select(LOAN_COLUMNS)
          .single();
        if (error || !loan) return json({ error: 'loan_rejected' }, 400);

        return json({ loan }, 201);
      }

      case 'accept': {
        if (!body.loanId) return json({ error: 'invalid_body' }, 400);
        const { loan, error } = await loadLoan(supabase, user.id, body.loanId);
        if (error) return json({ error: 'server_error' }, 500);
        if (!loan) return json({ error: 'not_found' }, 404);
        if (!isActive(loan)) return json({ error: 'invalid_state' }, 409);
        // Confirmation par l'emprunteur seulement : le prêteur ne valide pas
        // à sa place. Aucune écriture : accepter deux fois reste sans effet.
        if (loan.borrower_id !== user.id) return json({ error: 'forbidden' }, 403);
        return json({ loan });
      }

      case 'decline': {
        if (!body.loanId) return json({ error: 'invalid_body' }, 400);
        const { loan, error } = await loadLoan(supabase, user.id, body.loanId);
        if (error) return json({ error: 'server_error' }, 500);
        if (!loan) return json({ error: 'not_found' }, 404);
        // La RLS `materiel_loans_delete_lender` réserve la suppression au
        // prêteur ; on refuse explicitement le reste au lieu de laisser la RLS
        // renvoyer un 500 opaque.
        if (loan.lender_id !== user.id) return json({ error: 'forbidden' }, 403);
        if (!isActive(loan) || loan.returned_at) {
          return json({ error: 'invalid_state' }, 409);
        }
        if (loan.lender_rating !== null || loan.borrower_rating !== null) {
          return json({ error: 'invalid_state' }, 409);
        }

        const { error: deleteError } = await supabase
          .from('materiel_loans')
          .delete()
          .eq('id', body.loanId)
          .or(involvedFilter(user.id));
        if (deleteError) return json({ error: 'delete_failed' }, 400);

        return json({ declined: true, loanId: body.loanId });
      }

      case 'return': {
        if (!body.loanId) return json({ error: 'invalid_body' }, 400);
        const { loan, error } = await loadLoan(supabase, user.id, body.loanId);
        if (error) return json({ error: 'server_error' }, 500);
        if (!loan) return json({ error: 'not_found' }, 404);
        if (loan.status === 'litige') return json({ error: 'invalid_state' }, 409);
        // Déjà rendu : renvoyer l'état courant, sans réécrire la date.
        if (loan.status === 'rendu' && loan.returned_at) return json({ loan });

        const { loan: updated, error: updateError } = await writeLoan(
          supabase,
          user.id,
          body.loanId,
          { status: 'rendu', returned_at: today() }
        );
        if (updateError || !updated) return json({ error: 'update_failed' }, 400);
        return json({ loan: updated });
      }

      case 'rate': {
        if (!body.loanId || body.rating === undefined) {
          return json({ error: 'invalid_body' }, 400);
        }
        const { loan, error } = await loadLoan(supabase, user.id, body.loanId);
        if (error) return json({ error: 'server_error' }, 500);
        if (!loan) return json({ error: 'not_found' }, 404);
        if (loan.status !== 'rendu' || !loan.returned_at) {
          return json({ error: 'not_returned' }, 409);
        }

        const isLender = loan.lender_id === user.id;
        const isBorrower = loan.borrower_id === user.id;
        if (!isLender && !isBorrower) return json({ error: 'not_found' }, 404);

        // Convention de `mapLoans` : le prêteur note `borrower_rating`,
        // l'emprunteur note `lender_rating`. Une note ne se réécrit pas.
        const column = isLender ? 'borrower_rating' : 'lender_rating';
        if (loan[column] !== null && loan[column] !== undefined) {
          return json({ error: 'already_rated' }, 409);
        }

        const { loan: updated, error: updateError } = await writeLoan(
          supabase,
          user.id,
          body.loanId,
          { [column]: body.rating }
        );
        if (updateError || !updated) return json({ error: 'update_failed' }, 400);
        return json({ loan: updated });
      }

      case 'dispute': {
        if (!body.loanId) return json({ error: 'invalid_body' }, 400);
        const { loan, error } = await loadLoan(supabase, user.id, body.loanId);
        if (error) return json({ error: 'server_error' }, 500);
        if (!loan) return json({ error: 'not_found' }, 404);
        // Ouvrir un litige deux fois n'ajoute rien.
        if (loan.status === 'litige') return json({ loan });

        const { loan: updated, error: updateError } = await writeLoan(
          supabase,
          user.id,
          body.loanId,
          { status: 'litige' }
        );
        if (updateError || !updated) return json({ error: 'update_failed' }, 400);
        return json({ loan: updated });
      }

      default:
        return json({ error: 'invalid_action' }, 400);
    }
  } catch (error) {
    console.error('[API /api/compte/loans]', error);
    return json({ error: 'server_error' }, 500);
  }
}
