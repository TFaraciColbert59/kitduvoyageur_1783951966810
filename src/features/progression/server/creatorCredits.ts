import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * T41 — Crédits de lignée (créateurs) : lecture des parts de royalties et du
 * crédit boutique existants, en distinguant PROVISOIRE (vente attribuée mais
 * non finalisée / susceptible de retour) et CONFIRMÉ (après délai de retour).
 * Aucune XP produite par la commission ni par sa consommation.
 */

export interface CreatorCreditLine {
  kitId: string | null;
  orderItemId: string | null;
  status: 'pending' | 'confirmed' | 'reversed';
  cents: number;
}

export interface CreatorCreditsView {
  pendingCents: number;
  confirmedCents: number;
  lines: CreatorCreditLine[];
}

function createCreatorClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour les crédits créateur.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lecture seule : `kit_royalty_shares` (provisoire) + `store_credit_ledger`
 * (confirmé). Un remboursement retire le provisoire une seule fois (source
 * unique côté attribution) ; aucun débit silencieux ici.
 */
/** PostgREST peut renvoyer un embed to-one en objet ou en tableau selon le client. */
function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCreatorCredits(userId: string): Promise<CreatorCreditsView> {
  const supabase = createCreatorClient();

  const [sharesRes, ledgerRes] = await Promise.all([
    supabase
      .from('kit_royalty_shares')
      .select('status, share_cents, kit_attributions(kit_id, order_item_id)')
      .eq('beneficiary_id', userId),
    supabase
      .from('store_credit_ledger')
      .select('amount_cents, entry_type, kit_attributions(order_item_id)')
      .eq('user_id', userId),
  ]);
  if (sharesRes.error) throw new Error(sharesRes.error.message);
  if (ledgerRes.error) throw new Error(ledgerRes.error.message);

  const lines: CreatorCreditLine[] = [];
  let pendingCents = 0;
  let confirmedCents = 0;

  for (const row of (sharesRes.data ?? []) as Array<{
    status: string | null;
    share_cents: number | null;
    kit_attributions: { kit_id: string | null; order_item_id: string | null } | Array<{ kit_id: string | null; order_item_id: string | null }> | null;
  }>) {
    const status =
      row.status === 'confirmed' || row.status === 'paid'
        ? 'confirmed'
        : row.status === 'reversed'
          ? 'reversed'
          : 'pending';
    const cents = Math.max(0, Math.floor(Number(row.share_cents) || 0));
    const attribution = toOne(row.kit_attributions);
    lines.push({
      kitId: attribution?.kit_id ?? null,
      orderItemId: attribution?.order_item_id ?? null,
      status,
      cents,
    });
    if (status === 'pending') pendingCents += cents;
  }

  for (const row of (ledgerRes.data ?? []) as Array<{
    amount_cents: number | null;
    entry_type: string | null;
    kit_attributions: { order_item_id: string | null } | Array<{ order_item_id: string | null }> | null;
  }>) {
    const cents = Math.floor(Number(row.amount_cents) || 0);
    if (cents === 0) continue;
    confirmedCents += cents;
    lines.push({
      kitId: null,
      orderItemId: toOne(row.kit_attributions)?.order_item_id ?? null,
      status: row.entry_type === 'debit' || row.entry_type === 'reversal' ? 'reversed' : 'confirmed',
      cents,
    });
  }

  return { pendingCents, confirmedCents, lines };
}
