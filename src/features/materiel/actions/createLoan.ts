'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CreateLoanInput {
  productOwnershipId: string;
  borrowerContact: string;
  dueDate?: string | null;
}

export async function createLoan({ productOwnershipId, borrowerContact, dueDate }: CreateLoanInput) {
  if (!productOwnershipId || !borrowerContact || borrowerContact.trim().length === 0) {
    return { success: false, error: 'Informations de prêt incomplètes' };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Non authentifié' };
    }

    const { data: loan, error: insertErr } = await supabase
      .from('materiel_loans')
      .insert({
        product_ownership_id: productOwnershipId,
        lender_id: user.id,
        borrower_contact: borrowerContact.trim(),
        status: 'en_cours',
        loaned_at: new Date().toISOString(),
        due_date: dueDate || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    // Marque l'objet en prêt
    await supabase
      .from('product_ownership')
      .update({ is_lent: true })
      .eq('id', productOwnershipId);

    revalidatePath('/materiel');
    revalidatePath('/materiel/depart');
    revalidatePath('/materiel/disponibilite');

    return { success: true, loanId: loan.id };
  } catch (err: any) {
    console.error('[createLoan]', err);
    return { success: false, error: err?.message || 'Erreur serveur' };
  }
}
