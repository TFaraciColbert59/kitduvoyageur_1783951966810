import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_INVITE_PERMISSIONS,
  INVITE_PERMISSIONS_STORAGE_KEY,
  PrepInviteScreen,
  deliverInvite,
  deserializeInvitePermissions,
  formatCoverDates,
  inviteBlock,
  participantsLabel,
  readInvitePermissions,
  remainingPlaces,
  serializeInvitePermissions,
  setInvitePermission,
  writeInvitePermissions,
  type InvitePermissions,
  type InviteSharePayload,
  type PrepInviteScreenProps,
} from '../components/PrepInviteScreen';
import { fullDraft } from './fixtures';
import type { AdventurePrepDraft } from '../types';

/**
 * Meme harnais que prep-screens.test.tsx : sous `renderToStaticMarkup`,
 * zustand v5 sert l'etat INITIAL et `setState` n'a aucun effet. Le module du
 * store est donc remplace par un selecteur pur — le composant est reellement
 * execute, seule la source de donnees change.
 *
 * Aucun test ne produit de vraie signature : `createInviteToken` vit cote
 * serveur, elle est ici injectee sous forme d'une fonction factice.
 */
const state = vi.hoisted(() => ({
  current: null as { draft: AdventurePrepDraft; adventureId: string } | null,
}));

vi.mock('../store/useAdventurePrepStore', () => {
  type Store = { draft: AdventurePrepDraft; adventureId: string };
  const use = ((selector: (store: Store) => unknown) =>
    selector(state.current as Store)) as unknown as { getState: () => unknown };
  use.getState = () => state.current;
  return { useAdventurePrepStore: use };
});

/** Jeton factice : la vraie signature n'est jamais produite ici. */
const URL_OK = 'https://kduk.ovh/i/jeton-de-test';
const builderOk: NonNullable<PrepInviteScreenProps['buildInviteUrl']> = () => Promise.resolve(URL_OK);

function render(props: Partial<PrepInviteScreenProps> = {}, draft = fullDraft()): string {
  state.current = { draft, adventureId: 'av-test' };
  const merged: PrepInviteScreenProps = { buildInviteUrl: builderOk, ...props };
  return renderToStaticMarkup(React.createElement(PrepInviteScreen, merged));
}

/** Ce que l'utilisateur LIT, balises et attributs retires. */
function visible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Le bouton d'envoi, avec ou sans l'attribut `disabled`. */
const CTA = /<button[^>]*>[\s\S]*?Envoyer l’invitation/;
const CTA_DISABLED = /<button[^>]*\sdisabled=""[^>]*>[\s\S]*?Envoyer l’invitation/;

afterEach(() => {
  vi.unstubAllGlobals();
});

/** localStorage minimal : le node n'en fournit pas. */
function stubStorage(): Map<string, string> {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    },
  });
  return map;
}

describe('InvitePermissions — contrat des droits', () => {
  it('INV-01: les quatre droits sont declares et types', () => {
    const full: InvitePermissions = {
      viewProgram: true,
      proposeChanges: true,
      editDirectly: true,
      inviteOthers: true,
    };
    expect(Object.keys(full).sort()).toEqual([
      'editDirectly',
      'inviteOthers',
      'proposeChanges',
      'viewProgram',
    ]);
  });

  it('INV-02: le defaut est le strict necessaire', () => {
    expect(DEFAULT_INVITE_PERMISSIONS).toEqual({
      viewProgram: true,
      proposeChanges: true,
      editDirectly: false,
      inviteOthers: true,
    });
  });

  it('INV-03: la serialisation conserve les quatre droits', () => {
    const permissions: InvitePermissions = {
      viewProgram: true,
      proposeChanges: false,
      editDirectly: true,
      inviteOthers: false,
    };
    expect(deserializeInvitePermissions(serializeInvitePermissions(permissions))).toEqual(permissions);
  });

  it('INV-04: une valeur absente ou aberrante retombe sur le defaut', () => {
    expect(deserializeInvitePermissions('{"viewProgram":false}')).toEqual({
      ...DEFAULT_INVITE_PERMISSIONS,
      viewProgram: false,
    });
    expect(deserializeInvitePermissions('pas du json')).toEqual(DEFAULT_INVITE_PERMISSIONS);
    expect(deserializeInvitePermissions(null)).toEqual(DEFAULT_INVITE_PERMISSIONS);
    expect(deserializeInvitePermissions('{"viewProgram":"oui"}').viewProgram).toBe(true);
  });

  it('INV-05: la bascule est immuable', () => {
    const before: InvitePermissions = { ...DEFAULT_INVITE_PERMISSIONS };
    const after = setInvitePermission(before, 'editDirectly', true);
    expect(before.editDirectly).toBe(false);
    expect(after.editDirectly).toBe(true);
    expect(after).not.toBe(before);
  });
});

describe('InvitePermissions — persistance locale', () => {
  it('INV-06: les droits sont persists et relus a l identique', () => {
    const map = stubStorage();
    const permissions: InvitePermissions = {
      viewProgram: true,
      proposeChanges: false,
      editDirectly: true,
      inviteOthers: false,
    };
    writeInvitePermissions(permissions);
    expect(map.get(INVITE_PERMISSIONS_STORAGE_KEY)).toBeTypeOf('string');
    expect(readInvitePermissions()).toEqual(permissions);
  });

  it('INV-07: un stockage indisponible ne leve pas', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('bloque');
        },
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    expect(() => writeInvitePermissions(DEFAULT_INVITE_PERMISSIONS)).not.toThrow();
    expect(readInvitePermissions()).toEqual(DEFAULT_INVITE_PERMISSIONS);
  });
});

describe('inviteBlock — pourquoi l envoi est refuse', () => {
  const OK = { url: URL_OK, message: 'On part samedi', linkPending: false };

  it('INV-08: un lien et un message suffisent', () => {
    expect(inviteBlock(OK)).toBeNull();
  });

  it('INV-08b: une resolution en cours n est pas une alarme', () => {
    const block = inviteBlock({ ...OK, linkPending: true });
    expect(block?.code).toBe('lien_en_attente');
    expect(block?.severity).toBe('attente');
    expect(block?.text).not.toMatch(/clé d’invitation/);
  });

  it('INV-09: `url === null` bloque avec une raison ecrite', () => {
    const block = inviteBlock({ ...OK, url: null });
    expect(block?.code).toBe('lien_indisponible');
    expect(block?.severity).toBe('alerte');
    expect(block?.text).toMatch(/clé d’invitation/i);
  });

  it('INV-10: un message vide ou blanc bloque l envoi', () => {
    expect(inviteBlock({ ...OK, message: '' })?.code).toBe('message_vide');
    expect(inviteBlock({ ...OK, message: '   \n  ' })?.code).toBe('message_vide');
    expect(inviteBlock({ ...OK, message: '' })?.text).toContain('Écris un mot à tes invités');
  });
});

describe('deliverInvite — partage puis presse-papiers', () => {
  const payload: InviteSharePayload = { title: 'Boucle', text: 'On part samedi', url: URL_OK };

  it('INV-11: sans `navigator.share`, le presse-papiers prend le relais', async () => {
    const copy = vi.fn(() => Promise.resolve());
    const result = await deliverInvite(payload, { copy }, 72);
    expect(copy).toHaveBeenCalledExactlyOnceWith(URL_OK);
    expect(result.channel).toBe('presse-papiers');
    expect(result.message).toContain('72 h');
  });

  it('INV-12: quand le partage existe, le presse-papiers n est pas sollicite', async () => {
    const share = vi.fn(() => Promise.resolve());
    const copy = vi.fn(() => Promise.resolve());
    const result = await deliverInvite(payload, { share, copy }, 48);
    expect(share).toHaveBeenCalledOnce();
    expect(copy).not.toHaveBeenCalled();
    expect(result.channel).toBe('partage');
    expect(result.message).toContain('48 h');
  });

  it('INV-13: un partage annule ne copie pas en silence et le dit', async () => {
    const share = vi.fn(() => Promise.reject(new Error('annule')));
    const copy = vi.fn(() => Promise.resolve());
    const result = await deliverInvite(payload, { share, copy }, 72);
    expect(copy).not.toHaveBeenCalled();
    expect(result.channel).toBe('aucun');
    expect(result.message).toMatch(/n’a pas été transmis/);
  });

  it('INV-14: un appareil incapable de partager le dit aussi', async () => {
    const result = await deliverInvite(payload, {}, 72);
    expect(result.channel).toBe('aucun');
    expect(result.message.length).toBeGreaterThan(10);
  });
});

describe('Donnees derivees — effectif et dates', () => {
  it('INV-15: les places restantes sortent de l effectif prevu', () => {
    expect(remainingPlaces(fullDraft(), 4)).toBe(2);
    expect(remainingPlaces(fullDraft(), 2)).toBe(0);
    expect(remainingPlaces(fullDraft(), 1)).toBe(0);
    expect(remainingPlaces(fullDraft(), null)).toBeNull();
  });

  it('INV-16: l effectif s accorde en francais', () => {
    expect(participantsLabel(fullDraft())).toBe('2 personnes');
    const solo = fullDraft();
    expect(participantsLabel({ ...solo, group: { ...solo.group, adults: 1, children: 0 } })).toBe(
      '1 personne',
    );
  });

  it('INV-17: les dates restent a verifier plutot qu inventees', () => {
    expect(formatCoverDates(fullDraft().calendar)).toBe('11 juillet 2026 → 13 juillet 2026');
    expect(
      formatCoverDates({
        startDate: null,
        durationDays: 3,
        durationIsSuggested: false,
        startDateIsSuggested: false,
        returnDate: null,
      }),
    ).toBe('À vérifier');
  });
});

describe('PrepInviteScreen — rendu', () => {
  it('INV-18: l ecran propose les quatre libelles demandes', () => {
    const text = visible(render());
    expect(text).toContain('Voir le programme');
    expect(text).toContain('Proposer des changements');
    expect(text).toContain('Modifier directement');
    expect(text).toContain('Inviter d’autres');
    expect(text).toContain('Message');
    expect(text).toContain('Envoyer l’invitation');
  });

  it('INV-19: la carte de couverture recapitule nom, dates et participants', () => {
    const text = visible(render({}, fullDraft({ coverName: 'Boucle des lacs' })));
    expect(text).toContain('Boucle des lacs');
    expect(text).toContain('11 juillet 2026 → 13 juillet 2026');
    expect(text).toContain('2 personnes');
    expect(text).toContain('1 personne déjà dans le groupe');
  });

  it('INV-20: sans image, l ecran le dit au lieu d inventer une photo', () => {
    const text = visible(render());
    expect(text).toContain('Aucune image appliquée');
    expect(render()).not.toContain('<img');
  });

  it('INV-21: une image reelle est rendue avec un decor vide', () => {
    const html = render({ coverImageUrl: 'https://exemple.test/photo.jpg' });
    expect(html).toContain('src="https://exemple.test/photo.jpg"');
    expect(html).toContain('alt=""');
  });

  it('INV-22: sans jeton, le CTA est desactive ET l ecran explique pourquoi', () => {
    const html = render({ buildInviteUrl: null });
    expect(html).toMatch(CTA_DISABLED);
    expect(visible(html)).toContain('n’a pas pu être signé');
  });

  it('INV-23: un jeton null renvoye par le serveur bloque aussi le CTA', () => {
    // Le `null` du serveur n'est connu qu'apres effet : sous markup statique
    // l'ecran doit encore attendre. La correspondance `null` -> explication
    // « cle absente » est verifiee sur la fonction pure en INV-09.
    const html = render({ buildInviteUrl: () => Promise.resolve(null) });
    expect(html).toMatch(CTA_DISABLED);
    expect(visible(html)).toContain('Préparation du lien sécurisé');
  });

  it('INV-24: un builder qui leve ne casse pas l ecran', () => {
    // Le rejet n'est observable qu'apres effet : sous markup statique l'ecran
    // doit rester dans l'attente, jamais annoncer un echec qui n'a pas eu lieu.
    const html = render({ buildInviteUrl: () => Promise.reject(new Error('reseau')) });
    expect(html).toMatch(CTA_DISABLED);
    expect(visible(html)).toContain('Envoyer l’invitation');
    expect(visible(html)).not.toContain('clé d’invitation du serveur est absente');
  });

  it('INV-25: en attente de lien, l ecran attend sans accuser la cle', () => {
    const html = render();
    expect(html).toMatch(CTA);
    expect(html).toMatch(CTA_DISABLED);
    expect(visible(html)).toContain('Préparation du lien sécurisé');
    // Le seul vrai verrou au premier rendu est le message : l'inviteBlock
    // couvre le cas « lien resolu + message ecrit » (INV-08).
    expect(html).toContain('role="status"');
  });

  it('INV-26: un groupe complet desactive « inviter d’autres » et l explique', () => {
    const text = visible(render({ capacity: 2 }));
    expect(text).toContain('Le groupe est complet');
    expect(text).toContain('ne peut pas inviter quelqu’un');
  });

  it('INV-27: le groupe incomplet laisse le droit actif', () => {
    expect(visible(render({ capacity: 6 }))).not.toContain('Le groupe est complet');
  });

  it('INV-28: aucun droit ne parle de localisation', () => {
    const html = render();
    const labels = [
      'Voir le programme',
      'Proposer des changements',
      'Modifier directement',
      'Inviter d’autres',
    ];
    for (const label of labels) {
      const row = html.slice(html.indexOf(label), html.indexOf(label) + 400);
      expect(row).not.toMatch(/localisation|position|traçabilité|gps/i);
    }
    expect(visible(html)).toContain('ne donne pas accès à ta localisation');
  });

  it('INV-29: le refus d envoi est annonce dans la page, pas seulement sur le bouton', () => {
    const html = render();
    expect(html).toContain('aria-describedby="prep-invite-block"');
    expect(visible(html)).toContain('Préparation du lien sécurisé');
    // Un blocage reel passe en `alert` : l'ecran ne se contente jamais d'un
    // bouton gris sans explication audible.
    expect(html).not.toContain('role="alert"');
  });

  it('INV-30: chaque interrupteur expose son role et son libelle', () => {
    const html = render();
    expect(html.match(/role="switch"/g) ?? []).toHaveLength(4);
    expect(html).toContain('aria-label="Voir le programme"');
    expect(html).toContain('aria-label="Inviter d’autres"');
  });

  it('INV-31: la preparation n est jamais notee ni chiffree en pourcentage', () => {
    const text = visible(render());
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/\d+\s*\/\s*100/);
    expect(text).not.toMatch(/score|note\s*\/\s*\d|sur\s*100/i);
  });

  it('INV-32: n’utilise jamais env(safe-area-inset) en page', () => {
    expect(render()).not.toContain('safe-area-inset');
  });

  it('INV-33: le bouton de fermeture n apparait que si le parent le fournit', () => {
    expect(render()).not.toContain('Fermer');
    const onBack = vi.fn();
    expect(render({ onBack })).toContain('Fermer');
  });
});

describe('Regles de code du fichier', () => {
  const source = readFileSync(new URL('../components/PrepInviteScreen.tsx', import.meta.url), 'utf8');

  it('INV-34: aucun hex dans le composant', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('INV-35: toute la couleur passe par un token', () => {
    const colors = source.match(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/g);
    expect(colors).toBeNull();
  });
});
