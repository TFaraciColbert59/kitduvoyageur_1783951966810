import { describe, expect, it } from 'vitest';
import { isStoredFormalities, readerFormalities } from '../engine/formalities';
import { entryFees } from '../engine/costs';
import { entryRequirement } from '../server/entryRequirements';

/**
 * VIE PRIVÉE (lot Z1) : le poste « Formalités » (visa, ESTA…) dépend de la NATIONALITÉ : rangé comme
 * dépense du voyage, sa seule présence (et sa base « ressortissant français ») la dit à tous les
 * lecteurs du voyage. Il se calcule donc à la lecture, avec le profil du LECTEUR, et ne se range pas.
 */
const find = (p: string, d: string) => entryRequirement(p, d);
const ask = (over: Partial<Parameters<typeof readerFormalities>[0]> = {}) =>
  readerFormalities({ countryCode: 'US', abroad: true, party: 2, reader: { nationality: 'FR' }, find, ...over });

describe('readerFormalities — la ligne chiffrée du lecteur, jamais rangée', () => {
  it('Français aux États-Unis : l’ESTA × 2 personnes, avec sa date de vérification et le fait qu’elle n’est pas dans le total', () => {
    expect(ask()).toEqual({
      title: 'Formalités : ESTA (40 $)',
      perPerson: 35,
      party: 2,
      amount: 70,
      currency: 'EUR',
      basis:
        'barème Compas 2026-10 · ressortissant français, tarif officiel connu, exigence vérifiée le 3 octobre 2026 (TravelRequirements.info), à vérifier avant de partir · calculé pour toi à l’ouverture, non compté dans le total du voyage',
    });
  });

  it('le montant est le barème du pays, au groupe', () => {
    const fee = entryFees('US');
    expect(ask({ party: 5 })).toMatchObject({ perPerson: fee?.eur, party: 5, amount: (fee?.eur ?? 0) * 5 });
  });

  it('un départ inconnu garde la ligne (on n’est pas SÛR d’être déjà dans le pays) ; un départ déjà dans le pays, non', () => {
    expect(ask({ abroad: null })).not.toBeNull();
    expect(ask({ abroad: false })).toBeNull();
  });

  it('une autre nationalité, aucune nationalité : rien d’affirmé, aucune ligne', () => {
    expect(ask({ reader: { nationality: 'DE' } })).toBeNull();
    expect(ask({ reader: { nationality: 'US' } })).toBeNull();
    expect(ask({ reader: { nationality: null } })).toBeNull();
  });

  it('seulement quand la table dit qu’un visa ou une autorisation est requis', () => {
    // Vietnam : exemption de 45 jours pour un Français. Portugal : libre circulation.
    expect(ask({ countryCode: 'VN' })).toBeNull();
    expect(ask({ countryCode: 'PT' })).toBeNull();
    // Son propre pays, pays hors du jeu, pays sans code : rien.
    expect(ask({ countryCode: 'FR' })).toBeNull();
    expect(ask({ countryCode: null })).toBeNull();
    expect(ask({ countryCode: 'ZZ' })).toBeNull();
  });

  it('le Népal (visa à l’arrivée) est chiffré pour un Français, jamais pour un Allemand', () => {
    expect(ask({ countryCode: 'NP' })).toMatchObject({ title: 'Formalités : visa népalais (30 jours) + permis de trek TIMS', amount: 90 });
    expect(ask({ countryCode: 'NP', reader: { nationality: 'DE' } })).toBeNull();
  });

  it('la table ne confirme rien ou le barème ne chiffre pas ce pays : aucune ligne plutôt qu’un montant deviné', () => {
    const none = () => null;
    expect(ask({ find: none })).toBeNull();
    // Rwanda : visa à l'arrivée gratuit pour les membres de la Francophonie, aucun barème.
    expect(entryRequirement('FR', 'RW')?.kind).toBe('visa_arrivee');
    expect(ask({ countryCode: 'RW' })).toBeNull();
  });

  it('un groupe invalide compte pour une personne', () => {
    expect(ask({ party: 0 })).toMatchObject({ party: 1, amount: 35 });
    expect(ask({ party: Number.NaN })).toMatchObject({ party: 1, amount: 35 });
  });
});

describe('isStoredFormalities — la dépense « Formalités » rangée par une préparation d’avant ce correctif', () => {
  const legacy = {
    title: 'Formalités : ESTA (40 $)',
    metadata: { autofill: 'run-1', source: 'estimation', basis: 'barème Compas 2026-10 · ressortissant français, tarif officiel connu' },
  };

  it('la ligne chiffrée par la préparation, pour un ressortissant français, est reconnue', () => {
    expect(isStoredFormalities(legacy)).toBe(true);
  });

  it('une dépense saisie à la main, même nommée « Formalités », ne l’est pas', () => {
    expect(isStoredFormalities({ title: 'Formalités : visa', metadata: null })).toBe(false);
    expect(isStoredFormalities({ title: 'Formalités : visa', metadata: { note: 'payé en ligne' } })).toBe(false);
    expect(isStoredFormalities({ title: 'Parking', metadata: legacy.metadata })).toBe(false);
  });
});
