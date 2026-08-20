import { createClient } from '@/lib/supabase/server';

export interface AlertItem {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  is_resolved: boolean;
  due_at: string | null;
  created_at: string;
}

/** getAlerts — alertes actives de l'utilisateur (Server-only, RLS). */
export async function getAlerts(): Promise<AlertItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []) as AlertItem[];
  } catch (err) {
    console.error('getAlerts', err);
    return [];
  }
}
