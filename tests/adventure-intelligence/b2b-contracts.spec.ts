import { describe, it, expect } from 'vitest';
import {
  B2B_CONTRACT_VERSION,
  b2bContractCatalog,
} from '@/features/adventure-intelligence/domain/b2bContracts';

describe('A8 — contrats B2B futurs (TEST-A8-B2B)', () => {
  it('TEST-A8-B2B-01: le catalogue expose les versions et contrats disponibles', () => {
    const catalog = b2bContractCatalog();

    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.map((entry) => entry.version)).toEqual(['v1']);
    expect(catalog[0].version).toBe(B2B_CONTRACT_VERSION);
    expect(catalog[0].contracts.map((contract) => contract.name)).toEqual([
      'difficulty',
      'eta',
      'conditions',
    ]);

    for (const contract of catalog[0].contracts) {
      expect(contract.version).toBe(B2B_CONTRACT_VERSION);
      expect(contract.methods.length).toBeGreaterThan(0);
      expect(contract.inputFields.length).toBeGreaterThan(0);
      expect(contract.outputFields.length).toBeGreaterThan(0);
      for (const field of [...contract.inputFields, ...contract.outputFields]) {
        expect(field.name.trim().length).toBeGreaterThan(0);
        expect(field.type.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('TEST-A8-B2B-02: les contrats ne transportent aucune donnée de santé', () => {
    const catalog = b2bContractCatalog();
    const serialized = JSON.stringify(catalog).toLowerCase();

    for (const forbidden of [
      'health',
      'santé',
      'sante',
      'heart',
      'cardio',
      'blood',
      'medical',
      'allerg',
      'bpm',
      'vo2',
      'poids',
      'userid',
      'memberid',
      'displayname',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    const byName = new Map(catalog[0].contracts.map((contract) => [contract.name, contract]));
    expect(byName.get('difficulty')?.inputFields.map((field) => field.name)).toEqual([
      'segmentId',
      'direction',
    ]);
    expect(byName.get('difficulty')?.outputFields.map((field) => field.name)).toEqual([
      'difficulty',
      'confidence',
    ]);
    expect(byName.get('eta')?.inputFields.map((field) => field.name)).toEqual([
      'segmentIds',
      'profileRef',
    ]);
    expect(byName.get('eta')?.outputFields.map((field) => field.name)).toEqual([
      'etaP50',
      'etaP90',
      'confidence',
    ]);
    expect(byName.get('conditions')?.outputFields.map((field) => field.name)).toEqual([
      'activeEvents',
      'confidence',
    ]);
  });
});
