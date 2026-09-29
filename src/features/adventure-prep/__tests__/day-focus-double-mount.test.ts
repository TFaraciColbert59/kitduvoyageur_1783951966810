/**
 * Le double montage du publisher de jours.
 *
 * Le shell (`AdventurePrepShell.tsx:743`) monte deja
 * `usePrepDayFocusPublisher(draft, step !== 'destination')`, et c'est lui qui
 * enveloppe les trois ecrans. `ItineraryStep.tsx:430` le monte UNE SECONDE
 * fois, avec le `focusable` par defaut.
 *
 * Deux hoods, dont un faux :
 *  - sur l etape 1, le shell publie `focusable=false` et masque le rail ;
 *    l ecran de l etape 2, lui, n est pas monte a ce moment-la ;
 *  - sur l etape 2, deux effects publient la meme liste. La garde de
 *    signature rend l operation idempotente, donc aucun scintillement visible
 *    -- mais le store est ecrit deux fois, et le `focusable` du second mount
 *    passerait `true` la ou le shell aura decide `false`.
 *
 * Ce test doit rester ROUGE tant que le second montage existe. C est un
 * temoin, pas un adoucissement : le corriger, c est supprimer le mount de
 * `ItineraryStep`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CHEMIN = path.join(process.cwd(), 'src/features/adventure-prep/components/ItineraryStep.tsx');
const source = readFileSync(CHEMIN, 'utf8');

describe('Selecteur de jours — une seule source de publication', () => {
  it('L6.6-DOUBLE: ItineraryStep ne remonte pas le publisher que le shell monte deja', () => {
    const montages = source.match(/usePrepDayFocusPublisher\(/g) ?? [];
    expect(montages).toHaveLength(0);
  });
});
