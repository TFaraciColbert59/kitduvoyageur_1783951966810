import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const crm = readFileSync(path.resolve(__dirname, 'tokens.css'), 'utf8');
const lkdv = readFileSync(path.resolve(__dirname, '../../../src/styles/tokens.css'), 'utf8');

describe('jetons de design', () => {
  it('les jetons copiés sont identiques à ceux de LKDV (EX-UX-01)', () => {
    expect(crm).toBe(lkdv);
  });
});
