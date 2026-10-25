import { beforeEach, describe, expect, it, vi } from 'vitest';

const askAI = vi.fn();
vi.mock('@/lib/ai/askAI', () => ({ askAI: (req: unknown) => askAI(req) }));

import { requestDraftedItinerary, frenchTypography } from '../engine/aiItinerary';
import { fullDraft } from './fixtures';

/** L'IA renvoie des titres sans accents : c est le symptome, pas la cause. */
const REPONSE = JSON.stringify({
  days: [1],
  steps: [
    {
      day: 1,
      kind: 'ravitaillement',
      title: 'Diner au refuge',
      placeName: 'Refuge des Aiguilles',
      startTime: '19:00',
      durationMin: null,
      reason: 'Reservation a prevoir : lieu et prix a verifier',
      lat: null,
      lon: null,
    },
    {
      day: 1,
      kind: 'arret',
      title: "Arret point d'interet",
      placeName: null,
      startTime: null,
      durationMin: null,
      reason: 'Pause proposee pour observer le paysage',
      lat: null,
      lon: null,
    },
  ],
  hypotheses: [],
});

beforeEach(() => {
  askAI.mockReset();
  askAI.mockResolvedValue({
    text: REPONSE,
    model: 'test',
    degraded: false,
    cached: false,
    provider: 'nvidia',
  });
});

describe('P0.7 — typographie francaise', () => {
  it('FR-01 : espace insecable avant les deux-points', () => {
    expect(frenchTypography('Pause au col : depart')).toContain('\u00A0:');
  });

  it('FR-02 : une heure garde son deux-points, sans espace ni insecable', () => {
    // Inserer une insecable dans « 08:30 » produirait « 08 :30 » : une heure
    // cassee est pire qu une heure sans typographie.
    expect(frenchTypography('Depart a 08:30')).toContain('08:30');
    expect(frenchTypography('Depart a 08:30')).not.toContain('08\u00A0:30');
  });

  it('FR-03 : espace insecable avant point-virgule, point d exclamation et point d interrogation', () => {
    for (const text of ['un; deux', 'un! deux', 'un? deux']) {
      const out = frenchTypography(text);
      expect(out).toMatch(/[\u00A0][;!?]/);
    }
  });

  it('FR-04 : un deux-points precede d un nombre ne recoit pas d espace', () => {
    // « 3:1 » est un rapport, pas une ponctuation : le separer inventerait un
    // second nombre la ou il n y en a qu un.
    expect(frenchTypography('Dosage 3:1')).toContain('3:1');
  });

  it('FR-05 : les mots francais sans accents du domaine sont repares', () => {
    expect(frenchTypography('Diner')).toBe('Dîner');
    expect(frenchTypography('un arret')).toBe('un arrêt');
    expect(frenchTypography('une activite')).toBe('une activité');
    expect(frenchTypography('a verifier')).toBe('à vérifier');
    expect(frenchTypography('c est necessaire')).toBe('c’est nécessaire');
  });

  it('FR-06 : un mot inconnu n est jamais invente', () => {
    // Le normaliseur n est pas un correcteur : il ne doit rien fabriquer.
    expect(frenchTypography('zzqqxx')).toBe('zzqqxx');
    expect(frenchTypography('un lieu inconnu')).toBe('un lieu inconnu');
  });

  it('FR-07 : la normalisation est idempotente', () => {
    const once = frenchTypography('Diner a 08:30 : arret propose');
    expect(frenchTypography(once)).toBe(once);
  });

  it('FR-08 : les titres renvoyes par le modele sont accentues', async () => {
    const { drafted } = await requestDraftedItinerary(fullDraft(), new AbortController().signal);

    expect(drafted).not.toBeNull();
    expect(drafted?.steps[0].title).toBe('Dîner au refuge');
    expect(drafted?.steps[0].reason).toContain('à vérifier');
  });

  it('FR-09 : le lieu propose par le modele est accentue lui aussi', async () => {
    const { drafted } = await requestDraftedItinerary(fullDraft(), new AbortController().signal);

    expect(drafted?.steps[0].placeName).toBe('Refuge des Aiguilles');
    expect(drafted?.steps[1].title).toBe('Arrêt point d’intérêt');
  });

  it('FR-10 : l heure du modele n est pas abimee par la typographie', async () => {
    const { drafted } = await requestDraftedItinerary(fullDraft(), new AbortController().signal);

    expect(drafted?.steps[0].startTime).toBe('19:00');
  });

  it('FR-11 : le prompt envoye a l IA ne contient plus de mot sans accent', async () => {
    await requestDraftedItinerary(fullDraft(), new AbortController().signal);

    const sent = askAI.mock.calls[0]?.[0] as { system: string; prompt: string };
    const texte = `${sent.system}\n${sent.prompt}`;
    // Le prompt est construit ailleurs, sans accents. Il part quand meme : c
    // est de la que viennent les titres « Diner » et « Eau et ravitaillement ».
    expect(texte).not.toMatch(/\bDiner\b/);
    expect(texte).not.toMatch(/\barret\b/);
    expect(texte).not.toMatch(/\bActivite\b/);
    // « - Activite : … » devient « - Activité : … », accent ET insecable.
    expect(sent.prompt).toMatch(/Activité\u00A0:/);
  });

  it('FR-12 : le prompt garde ses dates intactes', async () => {
    await requestDraftedItinerary(fullDraft(), new AbortController().signal);

    const sent = askAI.mock.calls[0]?.[0] as { system: string; prompt: string };
    // Une date cassee par la typographie serait fausse, pas seulement laide.
    expect(sent.prompt).toContain('2026-07-11');
    expect(sent.prompt).not.toMatch(/\d{2}\u00A0:\d{2}/);
  });
});
