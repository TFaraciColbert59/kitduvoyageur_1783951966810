import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FreeDepartureScreen } from '../components/FreeDepartureScreen';
import { activityById } from '@/features/adventure-prep/catalog';
import type { LocationPermission } from '../engine/location';

/**
 * La carte est un chunk MapLibre : elle n'a rien a faire dans un rendu HTML
 * statique. On la remplace par un marqueur pour que le test porte sur le
 * TEXTE de l'ecran — ce que l'utilisateur lit — et non sur la bibliotheque de
 * rendu de la carte.
 */
vi.mock('../components/FreeTraceMap', () => ({
  FreeTraceMap: ({ pillLabel }: { pillLabel: string }) => (
    <div data-testid="carte">{pillLabel}</div>
  ),
}));

const state = vi.hoisted(() => ({ current: { activityId: null as string | null } }));

vi.mock('../store/useFreeDepartureStore', () => {
  const use = ((selector: (store: { activityId: string | null }) => unknown) =>
    selector(state.current)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useFreeDepartureStore: use };
});

const HANDOFF = {
  onRequestPermission: () => undefined,
  onStart: () => undefined,
  onClose: () => undefined,
  onPickActivity: () => undefined,
  onUseAutoDetection: () => undefined,
};

/** Texte reellement affiche : balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function render(permission: LocationPermission = 'inconnue') {
  state.current = { activityId: null };
  return renderToStaticMarkup(
    React.createElement(FreeDepartureScreen, { permission, ...HANDOFF })
  );
}

function renderManual(activityId: string) {
  state.current = { activityId };
  return renderToStaticMarkup(
    React.createElement(FreeDepartureScreen, { permission: 'inconnue', ...HANDOFF })
  );
}

describe('60-libre-avant — ecran « Pret a partir ? »', () => {
  it('FREE-A01: reprend le titre et la promesse de la maquette', () => {
    const text = visible(render());
    expect(text).toContain('Partir librement');
    expect(text).toContain('Prêt à partir ?');
    expect(text).toContain('Aucun itinéraire : tu marches, on enregistre.');
  });

  it('FREE-A02: propose exactement les deux modes de la maquette', () => {
    const text = visible(render());
    expect(text).toContain('Détection automatique');
    expect(text).toContain('L’activité est proposée à la fin, tu confirmes');
    expect(text).toContain('Je choisis l’activité');
    expect(text).toContain('Randonnée, vélo, kayak…');
  });

  it('FREE-A03: la detection automatique est le mode par defaut', () => {
    const html = render();
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-mode="auto"');
  });

  it('FREE-A04: un choix manuel remplace la detection et nomme l’activite', () => {
    const text = visible(renderManual('rando-journee'));
    const label = activityById('rando-journee')?.label ?? '@@absent';
    expect(text).toContain(label);
    expect(text).toContain('Activité choisie par toi');
  });

  it('FREE-A05: le retour a l’automatique est possible', () => {
    expect(visible(renderManual('rando-journee'))).toContain('Revenir à la détection');
  });

  it('FREE-A06: l’usage de la position est explique AVANT toute demande', () => {
    const text = visible(render());
    expect(text).toContain('Ta position sert à tracer ton parcours');
    expect(text).toContain('Uniquement pendant l’activité');
    expect(text).toContain('rien n’est partagé sans ton accord');
  });

  it('FREE-A07: la carte d’avant-depart porte la pastille « Autour de moi »', () => {
    expect(render()).toContain('Autour de moi');
  });

  it('FREE-A08: l’action dominante est unique et explicite', () => {
    const text = visible(render());
    expect(text).toContain('Démarrer');
    // Une seule action primaire : pas de second « Continuer » ambigu.
    expect(text.match(/Démarrer/g) ?? []).toHaveLength(1);
  });

  it('FREE-A09: aucun score, aucune note, aucun pourcentage', () => {
    const text = visible(render());
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('FREE-A10: un refus est explique sans jamais bloquer le depart', () => {
    const text = visible(render('refusee'));
    expect(text).toContain('Localisation refusée');
    expect(text).toContain('sans trace ni distance');
    expect(text).toContain('Démarrer');
  });

  it('FREE-A11: une panne GPS n’est jamais presentee comme un refus', () => {
    const text = visible(render('indisponible'));
    expect(text).toContain('indisponible sur cet appareil');
    expect(text).not.toContain('sans trace ni distance');
  });

  it('FREE-A12: « Demarrer » reste disponible quel que soit l’etat de localisation', () => {
    for (const permission of ['inconnue', 'accordee', 'refusee', 'indisponible'] as const) {
      expect(visible(render(permission)), permission).toContain('Démarrer');
    }
  });

  it('FREE-A13: la fermeture vers le hub reste atteignable au clavier', () => {
    const html = render();
    expect(html).toContain('aria-label="Revenir au hub"');
  });

  it('FREE-A14: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render()).not.toContain('safe-area-inset');
  });

  it('FREE-A15: le choix manuel passe par un dialogue, pas par un ecran empile', () => {
    expect(render()).toContain('aria-haspopup="dialog"');
  });
});
