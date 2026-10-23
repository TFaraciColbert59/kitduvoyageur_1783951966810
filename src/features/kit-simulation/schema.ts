import { z } from 'zod';
export const slotSchema=z.enum(['pack','shelter','bag','pad','rain','light','first_aid',
  'navigation','water_container','water_treatment','cook']);
export const simulationRequest=z.object({
  mode:z.enum(['balanced','ul','eco']),
  accommodation:z.enum(['tent','tarp','refuge','hotel']),
  cooking:z.boolean(),naturalWater:z.boolean(),
  minTempC:z.number().finite().min(-60).max(50).nullable(),
  minimumPadR:z.number().finite().min(0).max(15).nullable(),
  coldMarginC:z.number().finite().min(0).max(15),
  budgetCents:z.number().int().min(0).max(100000000),
  maxPackWeightG:z.number().int().min(1).max(100000),
  packVolumeMl:z.number().int().min(1).max(500000),
  consumablesG:z.number().int().min(0).max(100000).nullable()
}).strict();
export type SimulationRequest=z.infer<typeof simulationRequest>;
