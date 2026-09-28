import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DepartureStep } from '../components/DepartureStep';
import { fullDraft, draftWithoutItineraryInput, CHAMONIX, ARGENTIERE } from './fixtures';
import { buildItinerary } from '../engine/itinerary';
import { assignPlaces, type PlaceCandidate } from '../engine/places';
import { applyRouting, type RouteLeg, type RoutingResolution } from '../engine/routing';
import { applyWeather } from '../engine/measurements';
import type { AdventurePrepDraft } from '../types';

/**
 * zustand v5 sert le `getServerSnapshot` — l'etat INITIAL — pendant
 * `renderToStaticMarkup`. Injecter un etat via `setState` n'aurait donc
 * aucun effet. On remplace le store par un selecteur pur : le composant
 * under-test est reellement execute, seule la source de donnees change.
 */
const state = vi.hoisted(() => ({ current: null as { draft: AdventurePrepDraft } | null }));

vi.mock('../store/useAdventurePrepStore', () => {
  const use = ((selector: (store: { draft: AdventurePrepDraft }) => unknown) =>
    selector(state.current as { draft: AdventurePrepDraft })) as unknown as {
    getState: () => unknown;
  };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/**
 * `DepartureStep` redirige vers /hub apres un enregistrement reussi : il
 * consomme donc `useRouter`, qui exige un contexte applicatif absent de
 * `renderToStaticMarkup`. Meme harnais que offline-prep.test.tsx : seul le
 * contexte de navigation est remplace, le composant reste reellement execute.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));
function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(DepartureStep, { onOpenSheet: () => undefined }));
}

/**
 * Texte reellement affiche, balises et attributs retires.
 *
 * Les regles produit portent sur ce que l'utilisateur LIT, pas sur les noms de
 * classes : les garder dans l'assertion rendrait le test fragile et faux.
 */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Les lieux REELS du corridor Chamonix - Argentiere, rendus par /api/pois.
const CORRIDOR: PlaceCandidate[] = [
  { id: 'o-gouter', name: 'Refuge du Gouter', category: 'refuge', lat: 45.8447, lon: 6.8427, description: null, region: null, country: 'France', pricePerNight: 75, phone: null, website: null, isVerifiable: true },
  { id: 'o-merlet', name: 'Source du Merlet', category: 'water', lat: 45.8756, lon: 6.8234, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-midi', name: 'Aiguille du Midi', category: 'viewpoint', lat: 45.879, lon: 6.8873, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-plan', name: 'Refuge du Plan de l Aiguille', category: 'refuge', lat: 45.8934, lon: 6.8756, description: null, region: null, country: 'France', pricePerNight: 48, phone: null, website: null, isVerifiable: true },
  { id: 'o-lac-blanc', name: 'Lac Blanc', category: 'water', lat: 45.9123, lon: 6.9012, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
  { id: 'o-bossons', name: 'Torrent des Bossons', category: 'water', lat: 45.8567, lon: 6.8456, description: null, region: null, country: 'France', pricePerNight: null, phone: null, website: null, isVerifiable: true },
];

// Un parcours route et drape : l etat REEL dans lequel le recapitulatif
// s affiche. Sur un modele nu aucune mesure n existe, et tout parait
// « a verifier » par defaut : les tests ne prouveraient alors rien.
function measuredDraft(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  const draft = fullDraft(overrides);
  const built = buildItinerary(draft);
  if (!built) throw new Error('modele de regles absent');
  const located = assignPlaces(built, CORRIDOR, CHAMONIX, ARGENTIERE);
  const geometry = [[6.8, 45.9], [6.9, 45.95]] as unknown as RouteLeg['geometry'];
  const resolution: RoutingResolution = {
    perDay: located.perDay.map((_, index) => ({
      distanceKm: 21,
      durationMin: 150,
      geometry,
      elevGainM: 400 + index,
      elevLossM: 380,
    })),
    legByStepId: {},
  };
  const dated = applyWeather(applyRouting(located, resolution), draft.calendar.startDate, [
    { date: '2026-07-11', tMaxC: 21, tMinC: 9, precipMm: 0, precipProbPct: 10, windMaxKmh: 18, code: 2, label: 'Partiellement nuageux' },
    { date: '2026-07-12', tMaxC: 18, tMinC: 7, precipMm: 4, precipProbPct: 60, windMaxKmh: 25, code: 61, label: 'Pluie faible' },
    { date: '2026-07-13', tMaxC: 16, tMinC: 6, precipMm: 0, precipProbPct: 20, windMaxKmh: 30, code: 3, label: 'Ciel voilé' },
  ]);
  return { ...draft, itinerary: dated };
}

describe('DepartureStep — écran de départ', () => {
  it('DEPART-01: affiche la couverture et ouvre sa modification', () => {
    const html = render(fullDraft({ coverName: 'Trois jours de refuge' }));
    expect(html).toContain('Trois jours de refuge');
    expect(html).toContain('Modifier');
  });

  it('DEPART-02: n’invente pas de couverture quand elle n’est pas personnalisée', () => {
    expect(render(fullDraft({ coverName: null }))).toContain('Ton aventure');
  });

  it('DEPART-03: récapitule équipement, eau et repas, participants', () => {
    const html = render(fullDraft());
    expect(html).toContain('Équipement');
    expect(html).toContain('Eau et repas');
    expect(html).toContain('Participants');
    expect(html).toContain('2 personnes');
  });

  it('DEPART-04: l’activité choisie donne le titre d’aide, pas « À vérifier »', () => {
    const html = render(fullDraft());
    expect(html).toContain('Randonnée');
    expect(html).toContain('3 jours');
  });

  it('DEPART-05: un sac vide ne vaut pas 0 kg', () => {
    const html = render(fullDraft());
    expect(html).toMatch(/Poids du sac/i);
    expect(html).not.toMatch(/Poids du sac\s*:\s*0[,.]0*\s*kg/);
  });

  it('DEPART-06: la préparation n’est jamais chiffrée', () => {
    const text = visible(render(fullDraft()));
    expect(text).toContain('À vérifier');
    // Ni pourcentage, ni note sur 100, ni score : la préparation n'a pas de note (A9).
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('DEPART-07: signale une date de départ manquante', () => {
    const html = render(
      fullDraft({
        calendar: { startDate: null, durationDays: 3, durationIsSuggested: false, startDateIsSuggested: false, returnDate: null },
      }),
    );
    expect(html).toContain('Date de départ à vérifier');
  });

  it('DEPART-08: le bouton d’enregistrement est nommé et disponible', () => {
    const html = render(fullDraft());
    expect(html).toContain('Enregistrer mon aventure');
  });

  it('DEPART-09: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render(fullDraft())).not.toContain('safe-area-inset');
  });

  it('DEPART-10: le brouillon vierge ne suppose aucune activité', () => {
    expect(render(draftWithoutItineraryInput())).toContain('Activité à choisir');
  });

  it('DEPART-11: l’équipement dérive de l’activité, même avant synchronisation', () => {
    const html = render(fullDraft());
    // Le catalogue impose l'eau et la trousse : jamais « aucun équipement ».
    expect(html).toContain('Équipement');
    expect(html).not.toContain('Aucun équipement identifié');
  });

  it('DEPART-12: le récap publie la distance et le dénivelé MESURÉS', () => {
    const text = visible(render(measuredDraft()));
    // 21 km x 3 joursneees = 63 km routiers, 400+401+402 m de denivele.
    expect(text).toContain('63 km');
    expect(text).toContain('1 203 m');
    expect(text).not.toContain('Distance à vérifier');
  });

  it('DEPART-13: le récap déroule le programme jour par jour', () => {
    const text = visible(render(measuredDraft()));
    expect(text).toContain('Jour 1');
    expect(text).toContain('Jour 2');
    expect(text).toContain('Jour 3');
  });

  it('DEPART-14: chaque jour affiche la météo mesurée de sa date', () => {
    const text = visible(render(measuredDraft()));
    expect(text).toContain('Partiellement nuageux');
    expect(text).toContain('Pluie faible');
  });

  it('DEPART-15: sans mesure, le récap reste « à vérifier » et n’invente rien', () => {
    // Le meme parcours, sans passage sur le reseau : la distance demeure
    // inconnue et doit se lire comme telle, jamais 0 km.
    const text = visible(render(fullDraft()));
    expect(text).toContain('À vérifier');
    expect(text).not.toMatch(/0\s*km/);
  });

  it('DEPART-16: chaque jour affiche SA distance, et non celle du voyage', () => {
    // Trois journees de longueurs DIFFERENTES : si l ecran repetait le total,
    // 12 km et 30 km n apparaitraient nulle part ailleurs.
    const draft = measuredDraft();
    const parJour = [21, 12, 30];
    const avecJours = {
      ...draft,
      itinerary: {
        ...(draft.itinerary as NonNullable<typeof draft.itinerary>),
        perDay: parJour.map((distanceKm) => ({
          distanceKm,
          movingMin: 120,
          activityMin: 240,
          elevGainM: 400,
          elevLossM: 380,
        })),
      },
    };
    const text = visible(render(avecJours));
    // Le total du voyage, en haut.
    expect(text).toContain('63 km');
    // Puis la distance de CHAQUE journee, dans sa carte.
    expect(text).toContain('21 km');
    expect(text).toContain('12 km');
    expect(text).toContain('30 km');
  });

  it('DEPART-17: la carte d un jour porte ses trois mesures', () => {
    const html = render(measuredDraft());
    const cartes = html.split('prep-programme__day"').slice(1);
    expect(cartes).toHaveLength(3);
    for (const carte of cartes) {
      expect(carte).toContain('prep-programme__daymetrics');
      expect(carte).toContain('Distance');
      expect(carte).toContain('Durée');
      expect(carte).toContain('Budget');
    }
  });
});
