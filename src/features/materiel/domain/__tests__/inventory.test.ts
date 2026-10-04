import { describe, it, expect } from 'vitest';
import { allowedInventoryTransitions, getInventoryStatus } from '../inventory';
import { productOwnershipSchema } from '@/lib/schemas/materiel';
describe('private inventory lifecycle', () => {
 it('falls back to legacy loan flags', () => { expect(getInventoryStatus({is_lent:true})).toBe('en_pret'); expect(getInventoryStatus({is_lent:false})).toBe('en_stock'); });
 it('offers only mode-specific starts and terminal sales', () => { expect(allowedInventoryTransitions({status:'en_stock',listing_mode:'vente'})).toContain('vendu'); expect(allowedInventoryTransitions({status:'en_stock',listing_mode:'personnel'})).not.toContain('vendu'); expect(allowedInventoryTransitions({status:'vendu'})).toEqual([]); expect(allowedInventoryTransitions({status:'en_location',listing_mode:'location'})).toEqual(['en_stock']); });
 it('keeps legacy defaults and rejects incoherent commercial records', () => { expect(productOwnershipSchema.parse({name:'Sac'}).status).toBe('en_stock'); expect(productOwnershipSchema.safeParse({name:'Sac',serial_number:'123',quantity:2}).success).toBe(false); expect(productOwnershipSchema.safeParse({name:'Sac',listing_mode:'location',rental_price_cents:0}).success).toBe(false); expect(productOwnershipSchema.safeParse({name:'Sac',status:'vendu'}).success).toBe(false); });
});
