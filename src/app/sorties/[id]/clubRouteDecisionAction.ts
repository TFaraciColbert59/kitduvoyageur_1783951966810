'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

type DecisionResult = { adopted?: boolean; error?: string };

const decisionSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive().max(2147483647),
  choice: z.enum(['adopt', 'keep']),
});

export async function saveClubRouteDecision(
  id: string,
  revision: number,
  _previous: DecisionResult,
  form: FormData,
): Promise<DecisionResult> {
  const parsed = decisionSchema.safeParse({ id, revision, choice: form.get('choice') });
  if (!parsed.success) return { error: 'Choix de parcours invalide.' };

  const client = await createClient();
  const adopt = parsed.data.choice === 'adopt';
  const { error } = await client.rpc('save_event_route_state', {
    p_event_id: parsed.data.id, p_revision: parsed.data.revision, p_adopt: adopt,
  });
  if (error?.code === 'PT409' || error?.code === '40001') {
    revalidatePath('/sorties/' + id);
    return { error: 'Le parcours ou ta décision a changé. Actualise la fiche.' };
  }
  if (error) return { error: 'Ce parcours est indisponible. Réessaie depuis la fiche.' };

  revalidatePath('/sorties/' + id);
  revalidatePath('/hub', 'layout');
  return { adopted: adopt };
}
