import 'server-only';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { stepStatuses, type StepExecution } from './stepExecution';

const instant = z.string().refine((value) => Number.isFinite(Date.parse(value)));

export const stepExecutionRow = z.object({
  step_id: z.string().uuid(),
  status: z.enum(stepStatuses),
  version: z.number().int().positive(),
  occurred_at: instant,
  actual_started_at: instant.nullable(),
  actual_arrived_at: instant.nullable(),
  actual_completed_at: instant.nullable(),
  note: z.string().nullable(),
  archived: z.boolean(),
  planned_title: z.string(),
  planned_day_number: z.number().int().positive(),
  planned_start_time: z.string().nullable(),
});

export async function readStepExecutions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
): Promise<Record<string, StepExecution> | null | undefined> {
  const { data, error } = await supabase.rpc('read_trip_step_execution', { p_trip_id: tripId });
  if (error?.code === '42501') return undefined;
  if (error) return null;
  const parsed = z.array(stepExecutionRow).safeParse(data);
  if (!parsed.success) return null;
  return Object.fromEntries(parsed.data.map((row) => [row.step_id, row]));
}
