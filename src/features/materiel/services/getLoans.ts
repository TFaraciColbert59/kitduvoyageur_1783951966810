import { createClient } from '@/lib/supabase/server';

export interface LoanItem {
  id: string;
  product_ownership_id: string | null;
  lender_id: string;
  borrower_id: string | null;
  borrower_contact: string | null;
  status: 'en_cours' | 'rendu' | 'en_retard' | 'litige';
  loaned_at: string;
  due_date: string | null;
  returned_at: string | null;
}

/** getLoans — prêts de l'utilisateur (prêteur ou emprunteur) (Server-only, RLS). */
export async function getLoans(): Promise<LoanItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('materiel_loans')
      .select('*')
      .or(`lender_id.eq.${user.id},borrower_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []) as LoanItem[];
  } catch (err) {
    console.error('getLoans', err);
    return [];
  }
}
