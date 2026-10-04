/**
 * Narration et paysage : les deux garde-fous "n'invente jamais".
 *
 * 1. La narration est deterministe et ne sort que des donnees derivees.
 * 2. Le paysage n'utilise que des tokens de design (jamais de hex libre).
 */

import { describe, expect, it } from 'vitest';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import { ZONES, tForZone } from '@/features/trajectoire/domain/scaleAxis';
import { NARRATION_ORIGIN_LABEL, narrate } from '@/features/trajectoire/ui/narration';
import { sceneBackground, zonePalette } from '@/features/trajectoire/ui/zonePalette';

const INTENTION = analyzeIntention(
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposés'
);

function snapshotAt(zoneId: (typeof ZONES)[number]['id']) {
  return deriveTrajectoire({ t: tForZone(zoneId), intention: INTENTION, traces: DEMO_TRACES });
}

describe('narration - determinisme', () => {
  it('rend deux fois exactement la meme sortie pour le meme etat', () => {
    const snapshot = snapshotAt('expedition');
    expect(narrate(snapshot, INTENTION)).toEqual(narrate(snapshot, INTENTION));
  });

  it('etiquette sa provenance pour ne jamais passer pour une invention', () => {
    const narration = narrate(snapshotAt('raid'), INTENTION);
    expect(narration.origin).toBe('modele');
    expect(NARRATION_ORIGIN_LABEL).toContain('n’invente jamais');
    for (const line of narration.lines) {
      expect(line.origin).toBe('modele');
    }
  });

  it('une ligne par facette, toutes non vides', () => {
    const narration = narrate(snapshotAt('expedition'), INTENTION);
    expect(narration.headline).not.toBe('');
    expect(narration.lines.map((line) => line.id)).toEqual([
      'danger',
      'window',
      'plan',
      'kit',
      'traces',
    ]);
    for (const line of narration.lines) {
      expect(line.text.trim().length).toBeGreaterThan(10);
    }
  });

  it('reprend la destination et la zone de l intention et du curseur', () => {
    const snapshot = snapshotAt('monde');
    const narration = narrate(snapshot, INTENTION);
    expect(narration.headline).toContain(INTENTION.destination.name);
    expect(narration.headline).toContain('tour du monde');
  });

  it('change de narration quand l echelle change', () => {
    const run = narrate(snapshotAt('run'), INTENTION);
    const monde = narrate(snapshotAt('monde'), INTENTION);
    expect(run.headline).not.toBe(monde.headline);
  });
});

describe('zonePalette - aucune couleur libre', () => {
  it('chaque zone expose ses trois stops', () => {
    for (const zone of ZONES) {
      const palette = zonePalette(zone.id);
      expect(palette.a).toMatch(/^var\(--[a-z0-9-]+\)$/);
      expect(palette.b).toMatch(/^var\(--[a-z0-9-]+\)$/);
      expect(palette.c).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it('n introduit aucun hex ni rgb en dur', () => {
    for (const zone of ZONES) {
      const background = sceneBackground(zone.id);
      expect(background).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(background).not.toMatch(/\brgba?\(/i);
    }
  });

  it('construit un fond en quatre couches pour chaque zone (lueur + ciel + profondeur + lit sombre)', () => {
    for (const zone of ZONES) {
      const layers = sceneBackground(zone.id).split('),');
      expect(layers).toHaveLength(4);
    }
  });

  it('retombe sur une palette valide pour une zone inconnue', () => {
    // @ts-expect-error - on verifie la defense de bord.
    expect(zonePalette('inconnue')).toEqual(zonePalette('run'));
  });
});
