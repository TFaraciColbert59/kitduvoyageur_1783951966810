'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { stepStatuses, type StepExecution } from './stepExecution';
import { stepExecutionRow } from './stepExecutionServer';

const command = z.object({
  tripId: z.string().uuid(),
  stepId: z.string().uuid(),
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().min(0).max(2147483647),
  planUpdatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  status: z.enum(stepStatuses),
  note: z.string().trim().max(500),
});

type SaveResult = { ok: true; execution: StepExecution } | {
  ok: false; message: string; refresh?: boolean;
};

export async function recordStepExecution(input: unknown): Promise<SaveResult> {
  const parsed = command.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Vérifie l’action et la longueur de la note.' };
  const { data: value } = parsed;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_trip_step_execution', {
    p_trip_id: value.tripId,
    p_step_id: value.stepId,
    p_operation_id: value.operationId,
    p_expected_version: value.expectedVersion,
    p_expected_plan_updated_at: value.planUpdatedAt,
    p_status: value.status,
    p_note: value.note || null,
  });
  if (error?.code === '42501') return { ok: false, message: 'Tu n’as pas accès à l’écriture sur cette étape.' };
  if (error?.code === 'PT409') return {
    ok: false, refresh: true, message: 'Cette étape a changé depuis son ouverture. Actualise le suivi.',
  };
  if (error?.code === 'PT404') return { ok: false, refresh: true, message: 'Cette étape a été retirée du plan.' };
  const saved = stepExecutionRow.safeParse(data);
  if (error || !saved.success) return { ok: false, message: 'Enregistrement indisponible. Réessaie.' };

  revalidatePath('/hub');
  return { ok: true, execution: saved.data };
}
