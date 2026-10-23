import {z} from 'zod';
import {slotSchema} from './schema';
import type {Option} from './core';
const row=z.object({
  option_id:z.string().min(1),product_id:z.string().uuid(),name:z.string().min(1),
  slot:slotSchema,weight_g:z.number().int().nonnegative().nullable(),
  measured_weight_g:z.number().int().nonnegative().nullable(),
  volume_ml:z.number().int().nonnegative().nullable(),
  comfort_c:z.number().finite().nullable(),r_value:z.number().finite().nonnegative().nullable(),
  verified:z.boolean(),source:z.enum(['owned','loan','rent','used','new']),
  price_cents:z.number().int().nonnegative(),currency:z.literal('EUR'),
  available_units:z.number().int().min(0).max(100),valid_until:z.string().datetime({offset:true})
}).strict();
export function adaptCandidates(value:unknown):Option[] {
  return z.array(row).max(2048).parse(value).map(x=>({
    id:x.option_id,spec:{productId:x.product_id,name:x.name,slot:x.slot,
      weightG:x.weight_g,volumeMl:x.volume_ml,comfortC:x.comfort_c,
      rValue:x.r_value,verified:x.verified},source:x.source,
    priceCents:x.price_cents,currency:x.currency,availableUnits:x.available_units,
    validUntil:x.valid_until,measuredWeightG:x.measured_weight_g,worn:false
  }));
}
