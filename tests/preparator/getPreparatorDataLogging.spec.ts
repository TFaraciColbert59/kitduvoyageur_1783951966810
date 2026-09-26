import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.join(process.cwd(), 'src/features/preparator/server/getPreparatorData.ts'),
  'utf8'
);

describe('journalisation du catalogue activités', () => {
  it('signale la donnée complémentaire sans journaliser lobjet erreur', () => {
    expect(source).toContain(
      "console.warn('[preparer] catalogue d\\'activités indisponible');"
    );
    expect(source).not.toContain(
      "console.error('[preparer] catalogue d\\'activités indisponible:', error);"
    );
  });
});