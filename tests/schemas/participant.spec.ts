import { describe, it, expect } from 'vitest';
import { participantSchema } from '@/lib/schemas/materiel';

const KIT = '11111111-1111-4111-8111-111111111111';

describe('participantSchema', () => {
  it('accepte un participant valide', () => {
    const r = participantSchema.safeParse({ kit_id: KIT, name: 'Marie' });
    expect(r.success).toBe(true);
  });
  it('accepte avec contact', () => {
    const r = participantSchema.safeParse({ kit_id: KIT, name: 'Secours', contact: '06 12 34 56 78' });
    expect(r.success).toBe(true);
  });
  it('rejette un nom vide', () => {
    const r = participantSchema.safeParse({ kit_id: KIT, name: '' });
    expect(r.success).toBe(false);
  });
  it('rejette un kit_id invalide', () => {
    const r = participantSchema.safeParse({ kit_id: 'abc', name: 'X' });
    expect(r.success).toBe(false);
  });
});
