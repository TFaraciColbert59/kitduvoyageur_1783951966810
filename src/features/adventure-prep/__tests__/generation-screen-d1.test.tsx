import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ItineraryStepScreen } from '../components/ItineraryStep';
import { GENERATION_PHASES, markPhaseDone, startGeneration } from '../engine/generation';
import { buildItinerary } from '../engine/itinerary';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft, GenerationState } from '../types';

/**
 * Meme harnais que prep-screens.test.tsx : sous renderToStaticMarkup, zustand v5
 * sert l etat INITIAL et setState n a aucun effet. Seul le module du store est
 * remplace par un selecteur pur ; le composant est reellement execute.
 *
 * D1 porte sur l ecran INTERMEDIAIRE : ce que l utilisateur voit pendant que la
 * generation tourne. Un bouton mort peint comme un bouton actif est un defaut
 * d honnnetete, pas un detail de style.
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

const noop = () => undefined;

function render(draft: AdventurePrepDraft): string {
  state.current = { draft };
  return renderToStaticMarkup(React.createElement(ItineraryStepScreen, { onOpenSheet: noop }));
}

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Un brouillon reelement en cours de generation, phases a jour. */
function enCours(doneCount = 0): AdventurePrepDraft {
  let generation: GenerationState = startGeneration(initial());
  for (const phase of GENERATION_PHASES.slice(0, doneCount)) {
    generation = markPhaseDone(generation, phase.id);
  }
  return fullDraft({ itinerary: null, generation });
}

/** Un brouillon dont le parcours existe reellement : construit par le moteur, jamais a la main. */
function avecParcours(): AdventurePrepDraft {
  const draft = fullDraft({ completedSteps: ['destination', 'itinerary'] });
  return { ...draft, itinerary: buildItinerary(draft) };
}

function initial(): GenerationState {
  return {
    status: 'idle',
    phases: GENERATION_PHASES.map((p) => ({ ...p, done: false })),
    steps: [],
    days: 0,
    error: null,
    notice: null,
    failure: null,
    rejectedReason: null,
    outcomes: [],
  };
}

const HINT = 'point de passage';

describe('D1 - ecran intermediaire de generation', () => {
  it('D1-1: n affiche aucun bouton de suite pendant la generation', () => {
    const html = render(enCours(2));
    expect(visible(html)).not.toContain('Vers le départ');
  });

  it('D1-2: pendant la generation, le seul CTA est « Arreter »', () => {
    const html = render(enCours(2));
    expect(visible(html)).toContain('Arrêter');
    // Le footer ne doit pas exister non plus : un pied de page vide reserve
    // ferait sauter toute la mise en page a la fin de la generation.
    expect(html).not.toContain('prep-footer');
  });

  it('D1-3: n affiche ni carte ni promesse de point de passage sans itineraire', () => {
    const html = render(enCours(2));
    expect(html).not.toContain('prep-map');
    expect(visible(html)).not.toContain(HINT);
  });

  it('D1-4: n affiche pas « a verifier » pendant la generation', () => {
    // Le texte etait coupe par le haut et masque par la carte des phases :
    // il ne parle d aucune distance, il n a rien a dire tant que rien n existe.
    expect(visible(render(enCours(2)))).not.toContain('À vérifier');
  });

  it('D1-5: nomme les 7 phases reelles, dans l ordre, avec leur etat', () => {
    const html = render(enCours(3));
    const text = visible(html);
    let curseur = -1;
    for (const phase of GENERATION_PHASES) {
      const at = text.indexOf(phase.label);
      expect(at, `phase absente : ${phase.label}`).toBeGreaterThan(curseur);
      curseur = at;
    }
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-state="active"');
    expect(html).toContain('data-state="pending"');
  });

  it('D1-6: le rail annonce le travail reellement fait, pas un pourcentage', () => {
    const text = visible(render(enCours(3)));
    expect(text).not.toMatch(/\d+\s*%/);
  });

  it('D1-7: la carte et le CTA reviennent des que l itineraire existe', () => {
    const html = render(avecParcours());
    expect(visible(html)).toContain('Vers le départ');
    expect(html).toContain('prep-map');
    expect(visible(html)).toContain(HINT);
  });

  it('D1-8: le rail a bien disparu quand la generation est terminee', () => {
    // fullDraft() n a pas d itineraire : le rail y serait absent par absence de
    // generation, pas parce qu il a disparu. Il faut un parcours REELLEMENT
    // construit ; le rail disparait alors qu une generation a bien eu lieu.
    const html = render(avecParcours());
    expect(html).not.toContain('prep-rail');
    expect(visible(html)).not.toContain('Arrêter');
  });
});

describe('D1-B - le rail est du verre, pas une dalle', () => {
  const css = readFileSync(
    join(process.cwd(), 'src/features/adventure-prep/adventure-prep.css'),
    'utf8'
  );

  function bloc(selector: string): string {
    const at = css.indexOf(selector + ' {');
    expect(at, `selecteur absent : ${selector}`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  }

  it('D1-9: .prep-rail applique un backdrop-filter comme les autres panneaux', () => {
    const rail = bloc('.prep-rail');
    expect(rail).toMatch(/backdrop-filter:/);
    expect(rail).toContain('var(--prep-panel-blur)');
    expect(rail).toContain('var(--prep-hairline)');
    expect(rail).toContain('var(--prep-glass-material)');
  });

  it('D1-10: .prep-rail n est plus un aplat opaque', () => {
    // La premiere version comptait sur un [^)]* qui s arretait au premier )
    // de var(--card-tint-solid) : elle ne voyait donc jamais le 92% et passait
    // sur un rail non verre. Le contrat est « pas d aplat calcule », pas
    // « pas de couleur » : le materiau de panneau en declare une, translucide.
    const rail = bloc('.prep-rail');
    expect(rail).toContain('var(--prep-panel-bg)');
    expect(rail).not.toContain('--card-tint-solid');
    expect(rail).not.toMatch(/background-color:[^;]*color-mix/);
  });
});
