'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateLoanStatus(loanId: string, status: 'en_cours' | 'rendu' | 'en_retard' | 'litige') {
  if (!loanId || typeof loanId !== 'string') {
    return { success: false, error: 'ID de prêt invalide' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === 'rendu') {
      patch.returned_at = new Date().toISOString();
    }

    const { data: loan, error: updateErr } = await supabase
      .from('materiel_loans')
      .update(patch)
      .eq('id', loanId)
      .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
      .select('product_ownership_id')
      .maybeSingle();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Met aussi à jour le flag is_lent sur l'objet d'inventaire
    if (loan?.product_ownership_id) {
      await supabase
        .from('product_ownership')
        .update({ is_lent: status !== 'rendu' })
        .eq('id', loan.product_ownership_id);
    }

    revalidatePath('/materiel');
    revalidatePath('/materiel/depart');
    revalidatePath('/materiel/disponibilite');

    return { success: true };
  } catch (err: any) {
    console.error('[updateLoanStatus]', err);
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}
