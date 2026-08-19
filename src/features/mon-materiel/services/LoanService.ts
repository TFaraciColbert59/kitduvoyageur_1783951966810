'use client';

/**
 * LKDV — Mon Matériel : service prêts.
 * → Routage des prêts (« Prêté par moi ») : les mutations passent par
 *   `gear_items` (RLS FOR ALL), la table `loans` reste en lecture seule.
 */

import { createClient } from '@/lib/supabase/client';
import type { GearLoanRecord } from '../types/gear';

export interface LoanMutationResult {
  ok: boolean;
  error?: string;
}

export class LoanService {
  private supabase = createClient();

  async listLoansForGear(gearId: string): Promise<GearLoanRecord[]> {
    const { data, error } = await this.supabase
      .from('loans')
      .select('*')
      .eq('gear_item_id', gearId)
      .order('loaned_at', { ascending: false })
      .limit(50);
    if (error) {
      console.warn('[LoanService] listLoansForGear:', error.message);
      return [];
    }
    return (data || []) as GearLoanRecord[];
  }

  /** Rendu : l'objet redevient disponible dans l'inventaire. */
  async markReturned(gearId: string): Promise<LoanMutationResult> {
    const { error } = await this.supabase
      .from('gear_items')
      .update({ loan_status: 'disponible', loan_to_name: null })
      .eq('id', gearId);
    if (error) {
      console.warn('[LoanService] markReturned:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  /** Relance : loggé dans l'historique (best-effort) — le prêt reste actif. */
  async nudge(gearId: string, borrower?: string): Promise<LoanMutationResult> {
    const { error } = await this.supabase.from('gear_history').insert({
      gear_item_id: gearId,
      event_type: 'loan_reminder',
      event_date: new Date().toISOString(),
      notes: borrower ? `Relance envoyée à ${borrower}.` : 'Relance envoyée.',
    });
    if (error) {
      console.warn('[LoanService] nudge (best-effort):', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}