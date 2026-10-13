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
export async function getCreatorCredits(userId: string): Promise<CreatorCreditsView> {
  const supabase = createCreatorClient();

  const [sharesRes, ledgerRes] = await Promise.all([
    supabase
      .from('kit_royalty_shares')
      .select('kit_id, order_item_id, status, amount_cents')
      .eq('user_id', userId),
    supabase
      .from('store_credit_ledger')
      .select('source_id, amount_cents, entry_type')
      .eq('user_id', userId),
  ]);
  if (sharesRes.error) throw new Error(sharesRes.error.message);
  if (ledgerRes.error) throw new Error(ledgerRes.error.message);

  const lines: CreatorCreditLine[] = [];
  let pendingCents = 0;
  let confirmedCents = 0;

  for (const row of (sharesRes.data ?? []) as Array<{
    kit_id: string | null;
    order_item_id: string | null;
    status: string | null;
    amount_cents: number | null;
  }>) {
    const status =
      row.status === 'confirmed' ? 'confirmed' : row.status === 'reversed' ? 'reversed' : 'pending';
    const cents = Math.max(0, Math.floor(Number(row.amount_cents) || 0));
    lines.push({ kitId: row.kit_id, orderItemId: row.order_item_id, status, cents });
    if (status === 'pending') pendingCents += cents;
  }

  for (const row of (ledgerRes.data ?? []) as Array<{
    source_id: string | null;
    amount_cents: number | null;
    entry_type: string | null;
  }>) {
    const cents = Math.floor(Number(row.amount_cents) || 0);
    if (cents === 0) continue;
    confirmedCents += cents;
    lines.push({
      kitId: null,
      orderItemId: row.source_id,
      status: row.entry_type === 'reversal' ? 'reversed' : 'confirmed',
      cents,
    });
  }

  return { pendingCents, confirmedCents, lines };
}
