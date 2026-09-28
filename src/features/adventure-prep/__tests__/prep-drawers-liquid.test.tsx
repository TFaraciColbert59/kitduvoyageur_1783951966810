/**
 * DPL — Les trois tiroirs d'entrees du preparateur, tels qu'ils doivent etre.
 *
 * Trois grievances, trois verifications structurelles :
 *  - « Lieu » : la boussole et la carte reduites a une icone, dans la barre de
 *    recherche ; la position reelle de la personne presente d office, pour le
 *    depart comme pour l arrivee ; la geolocalisation passe par le module
 *    natif, pas par un `navigator.geolocation` parallele.
 *  - « Date » : plus de date de retour a fixer. Un seul calendrier. Ce que
 *    l'IA n'a pas fixe reste a l'IA, et n'est pas devine a l'affichage.
 *  - « Avec qui » : plus de choix solo/groupe. La liste des amis est une
 *    requete reelle, et la recherche porte sur n'importe quel profil.
 *
 * Vitest tourne en `node` : `useEffect` ne s'execute pas sous
 * `renderToStaticMarkup`. La logique asynchrone est donc verifiee par ses
 * fonctions pures (exports du module), et le rendu par son balisage. C'est la
 * convention deja en place dans `prep-day-focus.test.tsx`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  CalendarSheet,
  GroupSheet,
  PlaceSheet,
  addMember,
  geoErrorMessage,
  groupModeFrom,
  keepReturnDate,
  mergePositionCandidate,
  peopleErrorMessage,
  pickedPlace,
  placeRowDetail,
  placeRowTitle,
  peopleRequestUrl,
  parsePeopleResponse,
  removeMember,
  toMyPositionPlace,
  userDisplayName,
  type PickedPoint,
} from '../components/PrepSetupSheets';
import { fullDraft } from './fixtures';
import type { PlaceCandidate } from '../placeCandidates';
import type { AdventurePrepDraft, PlaceRef } from '../types';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';

const COMPONENT = path.resolve(__dirname, '../components/PrepSetupSheets.tsx');
const source = (): string => readFileSync(COMPONENT, 'utf8');

/** Le store n'est jamais appele sous `renderToStaticMarkup` : un stub suffit. */
const actions = {
  setRoute: () => undefined,
  setCalendar: () => undefined,
  setGroup: () => undefined,
} as unknown as AdventurePrepStore;

const noop = () => undefined;

function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function count(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

/** Coordonnees GPS reelles telles que le module natif les renvoie. */
const GPS = {
  latitude: 45.9237,
  longitude: 6.8694,
  accuracy: 12,
  altitude: 435,
  altitudeAccuracy: 8,
  heading: null,
  speed: null,
  timestamp: 1_767_000_000_000,
};

describe('DPL — Lieu : la barre de recherche porte les deux commandes', () => {
  it('DPL-01: la boussole est une icone seule, sans le texte « Ma position »', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    expect(html).toContain('aria-label="Utiliser ma position"');
    expect(visible(html)).not.toContain('Ma position');
  });

  it('DPL-02: la carte est une icone seule, sans le texte « Choisir sur la carte »', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    expect(html).toContain('aria-label="Choisir un point sur la carte"');
    expect(visible(html)).not.toContain('Choisir sur la carte');
  });

  it('DPL-03: les deux icones sont dans la barre de recherche, boussole a gauche et carte a droite', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    const bar = html.slice(html.indexOf('class="prep-search"'));
    expect(bar).toContain('prep-search');
    const compass = bar.indexOf('aria-label="Utiliser ma position"');
    const input = bar.indexOf('placeholder="Rechercher un lieu');
    const map = bar.indexOf('aria-label="Choisir un point sur la carte"');
    expect(compass).toBeGreaterThan(-1);
    expect(input).toBeGreaterThan(compass);
    expect(map).toBeGreaterThan(input);
  });

  it('DPL-04: plus aucun bouton texte plein largeur dans le tiroir Lieu', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    expect(visible(html)).not.toContain('Ma position bouton');
    // L ancien duo de boutons texte a disparu au profit de deux icones.
    expect(count(html, /<button/g)).toBeLessThanOrEqual(4);
  });

  it('DPL-05: la carte courte est affichee des l ouverture, sans clic prealable', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    expect(html).toContain('class="prep-picker"');
    // Basse, pas carree : la maquette demande une carte « peu haute ».
    expect(html).toMatch(/class="prep-picker"[^>]*style="[^"]*height:\s*1[0-9]{2}px/);
    // En lecture seule, on ne propose pas encore de saisir un nom de point.
    expect(visible(html)).not.toContain('Utiliser ce point');
  });

  it('DPL-06: la carte nomme l extremite editable, depart et arrivee', () => {
    const origin = visible(
      renderToStaticMarkup(
        React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
      ),
    );
    const destination = visible(
      renderToStaticMarkup(
        React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'destination' }),
      ),
    );
    expect(origin).toContain('Départ');
    expect(destination).toContain('Arrivée');
  });

  it('DPL-06b: la carte est basse dans le tiroir, sous les choix', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceSheet, { draft: fullDraft(), actions, onClose: noop, field: 'origin' }),
    );
    // Chercher, choisir, puis poser un point : la carte vient apres la liste,
    // la elle elle ne coupait pas la recherche en deux.
    const map = html.indexOf('class="prep-picker"');
    const list = html.indexOf('class="list"');
    expect(map).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(list);
  });

  it('DPL-08: passer en mode pose amene la carte a l ecran', () => {
    // La carte est basse : sans rappel, l utilisateurPose un point dans le vide.
    expect(source()).toContain('scrollIntoView');
  });
});

describe('DPL — Lieu : un point sans nom ne recoit pas de nom invente', () => {
  const POINT: PickedPoint = { lat: 50.64, lon: 3.06, name: '' };

  it('DPL-07a: un point pose sans nom ne porte aucun nom', () => {
    // « Point 50.64° N 03.06° E » se lit comme un nom de lieu alors que c est
    // une coordonnee. Le lieu reste sans nom ; c est l ecran qui dira « a
    // verifier ».
    expect(pickedPlace(POINT)).toEqual({
      id: 'point-50.6400-3.0600',
      name: '',
      country: '',
      lat: 50.64,
      lon: 3.06,
    });
  });

  it('DPL-07b: le nom saisi par la personne est conserve tel quel', () => {
    expect(pickedPlace({ ...POINT, name: 'Le col' }).name).toBe('Le col');
    expect(pickedPlace({ ...POINT, name: '  Le col  ' }).name).toBe('  Le col  ');
  });

  it('DPL-07c: le lieu retenu n invente aucun pays', () => {
    expect(pickedPlace(POINT).country).toBe('');
  });

  it('DPL-09a: une ligne sans nom se dit telle quelle', () => {
    expect(placeRowTitle({ id: 'x', name: '', country: '', lat: 50.64, lon: 3.06 })).toBe(
      'Point sans nom vérifié',
    );
    expect(placeRowTitle({ id: 'y', name: 'Chamonix', country: 'France', lat: 45.92, lon: 6.86 })).toBe(
      'Chamonix',
    );
  });

  it('DPL-09b: le detail d une ligne sans nom annonce des coordonnees, pas un lieu', () => {
    const candidate: PlaceCandidate = {
      place: { id: 'x', name: '', country: '', lat: 50.64, lon: 3.06 },
      source: 'remembered',
      precision: 'commune',
      context: null,
      hint: null,
    };
    const detail = placeRowDetail(candidate.place, candidate);
    expect(detail).toContain('Coordonnées');
    // Et surtout : la ligne porte un nom, jamais une suite de nombres.
    expect(placeRowTitle(candidate.place)).not.toMatch(/[0-9]/);
  });
});

describe('DPL — Lieu : la position reelle, sans invention', () => {
  it('DPL-10: une lecture GPS devient un lieu selectionnable, aux coordonnees reelles', () => {
    expect(toMyPositionPlace(GPS)).toEqual({
      id: 'here-45.92370-6.86940',
      name: 'Ma position',
      country: '',
      lat: 45.9237,
      lon: 6.8694,
    });
  });

  it('DPL-11: l identifiant est stable pour une meme position, donc pas de doublon', () => {
    expect(toMyPositionPlace(GPS).id).toBe(toMyPositionPlace({ ...GPS, timestamp: 42 }).id);
  });

  it('DPL-12: aucun pays n est devine depuis une position GPS', () => {
    expect(toMyPositionPlace(GPS).country).toBe('');
  });

  it('DPL-13: la position passe en tete de liste, une seule fois', () => {
    const place = toMyPositionPlace(GPS);
    const before: PlaceRef[] = [];
    const merged = mergePositionCandidate(before, place);
    expect(merged[0]?.place).toBe(place);
    expect(mergePositionCandidate(merged, place)).toHaveLength(1);
  });

  it('DPL-14: la fusion ne mute pas la liste d origine', () => {
    const before: PlaceRef[] = [];
    const merged = mergePositionCandidate(before, toMyPositionPlace(GPS));
    expect(before).toHaveLength(0);
    expect(merged).not.toBe(before);
  });

  it('DPL-15: sans position, la liste reste ce qu elle est', () => {
    const place: PlaceRef = { id: 'chamonix', name: 'Chamonix', country: 'France', lat: 45.92, lon: 6.86 };
    const merged = mergePositionCandidate([place], null);
    expect(merged.map((c) => c.place.id)).toEqual(['chamonix']);
  });

  it('DPL-16: un refus de geolocalisation est dit, jamais remplace par une position fausse', () => {
    expect(geoErrorMessage(new Error('Permission denied'))).toContain('Position');
    expect(geoErrorMessage(null)).toBeNull();
  });
});

describe('DPL — Lieu : la geolocalisation passe par le module natif', () => {
  it('DPL-20: le composant importe le wrapper natif partage', () => {
    expect(source()).toContain("from '@/lib/native/geolocation'");
  });

  it('DPL-21: plus aucun appel direct a navigator.geolocation dans ce composant', () => {
    // PrepMap.tsx garde son propre useGeolocation en ligne : c est un autre
    // fichier, hors perimetre. Ici, la source etait la seule a contourner le
    // wrapper — donc elle ne doit plus le faire.
    expect(source()).not.toContain('navigator.geolocation');
  });
});

describe('DPL — Date : un seul calendrier, pas de retour a fixer', () => {
  function calendar(): string {
    return renderToStaticMarkup(
      React.createElement(CalendarSheet, { draft: fullDraft(), actions, onClose: noop }),
    );
  }

  it('DPL-30: il n y a qu un seul calendrier dans le tiroir', () => {
    expect(count(calendar(), /aria-label="Calendrier"/g)).toBe(1);
  });

  it('DPL-31: la date de retour a fixer a disparu, libelle et interrupteur compris', () => {
    const html = calendar();
    expect(visible(html)).not.toContain('date de retour');
    expect(html).not.toContain('role="switch"');
  });

  it('DPL-32: leInterrupteur animals reste, lui est toujours pertinent', () => {
    // Preuve qu on a retire LE bon interrupteur et pas tous les interrupteurs.
    const html = renderToStaticMarkup(
      React.createElement(GroupSheet, { draft: fullDraft(), actions, onClose: noop }),
    );
    expect(html).toContain('role="switch"');
  });

  it('DPL-33: la duree reste reglable, ce n est pas un second calendrier', () => {
    const text = visible(calendar());
    expect(text).toContain('Durée');
  });

  it('DPL-40: une date de retour coherente est conservee', () => {
    expect(keepReturnDate('2026-07-13', '2026-07-11', 3)).toBe('2026-07-13');
  });

  it('DPL-41: une date de retour devenue incoherente est abandonnee, pas affichee', () => {
    // Changer la date de depart invalide une arrivee plus ancienne : la garder
    // afficherait un trajet qui n existe pas.
    expect(keepReturnDate('2026-07-13', '2026-08-01', 3)).toBeNull();
  });

  it('DPL-42: sans date de depart ni duree, l arrivee reste a l IA', () => {
    expect(keepReturnDate('2026-07-13', null, null)).toBeNull();
    expect(keepReturnDate(null, '2026-07-11', 3)).toBeNull();
  });

  it('DPL-43: une duree d un jour rend l arrivee identique au depart', () => {
    expect(keepReturnDate('2026-07-11', '2026-07-11', 1)).toBe('2026-07-11');
  });
});

describe('DPL — Avec qui : le mode se deduit, il ne se choisit plus', () => {
  function group(draft: AdventurePrepDraft): string {
    return renderToStaticMarkup(
      React.createElement(GroupSheet, { draft, actions, onClose: noop }),
    );
  }

  it('DPL-50: le selecteur solo ou groupe a disparu', () => {
    const text = visible(group(fullDraft()));
    expect(text).not.toContain('Solo');
    expect(count(group(fullDraft()), /aria-pressed="true"/g)).toBe(0);
  });

  it('DPL-51: une personne seule reste solo', () => {
    expect(groupModeFrom(1, 0, [])).toBe('solo');
  });

  it('DPL-52: deux adultes, ou meme un adulte et un ami, font un groupe', () => {
    expect(groupModeFrom(2, 0, [])).toBe('groupe');
    expect(groupModeFrom(1, 0, ['Camille'])).toBe('groupe');
    expect(groupModeFrom(1, 1, [])).toBe('groupe');
  });

  it('DPL-53: le nombre d invites reellement choisis compte dans le mode', () => {
    expect(groupModeFrom(1, 0, ['Camille', 'Karim'])).toBe('groupe');
  });

  it('DPL-54: la liste des amis est annoncee, et la recherche est presente', () => {
    const html = group(fullDraft());
    const text = visible(html);
    expect(text).toContain('Nos amis');
    expect(html).toContain('placeholder="Rechercher une personne');
  });

  it('DPL-55: une liste vide ne se presente jamais comme « personne suivi »', () => {
    // Etat de repos : on ne peut pas encore affirmer que la liste est vide,
    // la requete n a pas eu lieu.
    expect(visible(group(fullDraft()))).not.toContain('Vous ne suivez personne');
  });
});

describe('DPL — Avec qui : la reponse de la base est lue telle quelle', () => {
  it('DPL-60: une reponse valide est lue, sans rien ajouter', () => {
    const people = parsePeopleResponse({
      users: [{ id: 'a', fullName: 'Camille', avatarUrl: 'u1', location: 'Annecy', trustScore: 71 }],
      scope: 'friends',
    });
    expect(people).toEqual([
      { id: 'a', fullName: 'Camille', avatarUrl: 'u1', location: 'Annecy', trustScore: 71 },
    ]);
  });

  it('DPL-61: une reponse malformee vaut absence de donnee, pas liste vide', () => {
    expect(parsePeopleResponse(null)).toBeNull();
    expect(parsePeopleResponse({ scope: 'friends' })).toBeNull();
    expect(parsePeopleResponse({ users: 'nope', scope: 'all' })).toBeNull();
  });

  it('DPL-62: une ligne sans identifiant est ecartee, pas renommee', () => {
    const people = parsePeopleResponse({
      users: [{ fullName: 'Sans id' }, { id: 'b', fullName: 'Iris' }],
      scope: 'all',
    });
    expect(people?.map((p) => p.id)).toEqual(['b']);
  });

  it('DPL-63: un champ absent devient null, jamais une valeur de remplacement', () => {
    const people = parsePeopleResponse({ users: [{ id: 'c', fullName: 'Noé' }], scope: 'all' });
    expect(people?.[0]).toEqual({ id: 'c', fullName: 'Noé', avatarUrl: null, location: null, trustScore: null });
  });

  it('DPL-70: une session absente est dite comme telle', () => {
    expect(peopleErrorMessage(401)).toContain('connecté');
  });

  it('DPL-71: une panne du service est dite comme telle, jamais « aucun resultat »', () => {
    const message = peopleErrorMessage(503);
    expect(message).toContain('indisponible');
    expect(message).not.toContain('Aucun résultat');
  });

  it('DPL-72: hors ligne est distingue d un refus', () => {
    expect(peopleErrorMessage(0)).toContain('Hors ligne');
  });

  it('DPL-73: pas d erreur, pas de message', () => {
    expect(peopleErrorMessage(200)).toBeNull();
  });
});

describe('DPL — Avec qui : la liste d invites reste immuable', () => {
  it('DPL-80: ajouter ne mute pas la liste d origine', () => {
    const before = Object.freeze(['Camille']) as readonly string[];
    const after = addMember(before, 'Karim');
    expect(before).toEqual(['Camille']);
    expect(after).toEqual(['Camille', 'Karim']);
  });

  it('DPL-81: un nom vide ou deja present n est pas ajoute deux fois', () => {
    const before = ['Camille'];
    expect(addMember(before, 'Camille')).toEqual(['Camille']);
    expect(addMember(before, '   ')).toEqual(['Camille']);
  });

  it('DPL-82: retirer ne mute pas la liste d origine', () => {
    const before = Object.freeze(['Camille', 'Karim']) as readonly string[];
    expect(removeMember(before, 'Camille')).toEqual(['Karim']);
    expect(before).toEqual(['Camille', 'Karim']);
  });

  it('DPL-83: retirer un absent ne change rien', () => {
    expect(removeMember(['Camille'], 'Iris')).toEqual(['Camille']);
  });

  it('DPL-84: un profil sans nom public reste affichable, sans prenom invente', () => {
    expect(
      userDisplayName({ id: 'x', fullName: '', avatarUrl: null, location: 'Annecy', trustScore: 40 }),
    ).toBe('Profil sans nom');
  });

  it('DPL-85: le nom reel est laite tel quel', () => {
    expect(
      userDisplayName({ id: 'y', fullName: 'Camille', avatarUrl: null, location: null, trustScore: null }),
    ).toBe('Camille');
  });
});

describe('DPL — Avec qui : l url interroge la vraie base', () => {
  it('DPL-90: la liste des amis demande le scope friends', () => {
    expect(peopleRequestUrl('friends', null)).toContain('scope=friends');
  });

  it('DPL-91: la recherche libre demande le scope all et encode le terme', () => {
    expect(peopleRequestUrl('all', 'Camille')).toContain('scope=all');
    expect(peopleRequestUrl('all', 'Camille')).toContain('q=Camille');
  });

  it('DPL-92: le composant appelle bien la route de recherche', () => {
    expect(source()).toContain('/api/users/search');
  });
});

describe('DPL — Date : la duree accorde le francais', () => {
  const renderCalendar = (durationDays: number | null): string => {
    const draft = fullDraft();
    return renderToStaticMarkup(
      React.createElement(CalendarSheet, {
        draft: {
          ...draft,
          calendar: { ...draft.calendar, durationDays },
        },
        actions,
        onClose: () => undefined,
      }),
    );
  };

  it('DPL-100: une duree d un seul jour ne s affiche jamais « 1 jours »', () => {
    const html = renderCalendar(1);
    expect(html).toContain('1 jour');
    expect(html).not.toContain('1 jours');
  });

  it('DPL-101: une duree de plusieurs jours reste au pluriel', () => {
    const html = renderCalendar(4);
    expect(html).toContain('4 jours');
  });

  it('DPL-102: une duree inconnue ne se presente jamais comme un jour reel', () => {
    const html = renderCalendar(null);
    expect(html).toContain('À vérifier');
    expect(html).not.toContain('1 jour');
    expect(html).not.toContain('1 jours');
  });
});
