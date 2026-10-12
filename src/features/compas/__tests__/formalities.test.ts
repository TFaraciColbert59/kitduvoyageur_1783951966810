import { describe, expect, it } from 'vitest';
import { isStoredFormalities, readerFormalities, withoutStoredFormalities } from '../engine/formalities';
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
    is_planned: true,
    metadata: { autofill: 'run-1', source: 'estimation', basis: 'barème Compas 2026-10 · ressortissant français, tarif officiel connu' },
  };

  it('la ligne chiffrée par la préparation, planifiée et intacte, est reconnue', () => {
    expect(isStoredFormalities(legacy)).toBe(true);
  });

  it('quelle que soit sa base : la préparation en a écrit plusieurs, aucune ne doit passer', () => {
    for (const basis of [
      undefined,
      '',
      'barème Compas 2026-10 · ressortissant français, tarif officiel connu',
      'barème Compas 2026-09 · tarif officiel connu · à vérifier avant de partir',
      'estimation du spécialiste',
    ])
      expect(isStoredFormalities({ ...legacy, metadata: { autofill: 'run-1', source: 'estimation', ...(basis === undefined ? {} : { basis }) } }), String(basis)).toBe(true);
  });

  it('une dépense saisie à la main, même nommée « Formalités », ne l’est pas', () => {
    expect(isStoredFormalities({ title: 'Formalités : visa', is_planned: true, metadata: null })).toBe(false);
    expect(isStoredFormalities({ title: 'Formalités : visa', is_planned: true, metadata: { note: 'payé en ligne' } })).toBe(false);
    expect(isStoredFormalities({ title: 'Parking', is_planned: true, metadata: legacy.metadata })).toBe(false);
  });

  it('réglée (plus planifiée) : c’est devenu une dépense de la personne, elle compte', () => {
    expect(isStoredFormalities({ ...legacy, is_planned: false })).toBe(false);
    expect(isStoredFormalities({ ...legacy, is_planned: null })).toBe(false);
    const { is_planned: _planned, ...undecided } = legacy;
    void _planned;
    expect(isStoredFormalities(undecided)).toBe(false);
  });

  it('retouchée depuis sa création (montant, titre…) : elle compte, au-delà de la marge de la passe', () => {
    const at = '2026-10-09T09:00:00.000Z';
    expect(isStoredFormalities({ ...legacy, created_at: at, updated_at: '2026-10-09T09:00:03.000Z' })).toBe(true);
    expect(isStoredFormalities({ ...legacy, created_at: at, updated_at: '2026-10-09T09:00:05.000Z' })).toBe(true);
    expect(isStoredFormalities({ ...legacy, created_at: at, updated_at: '2026-10-09T09:00:06.000Z' })).toBe(false);
    expect(isStoredFormalities({ ...legacy, created_at: at, updated_at: '2026-10-10T18:30:00.000Z' })).toBe(false);
  });

  it('des dates absentes ou illisibles ne prouvent aucune retouche : la ligne reste retirée', () => {
    expect(isStoredFormalities({ ...legacy, created_at: null, updated_at: '2026-10-10T18:30:00.000Z' })).toBe(true);
    expect(isStoredFormalities({ ...legacy, created_at: '2026-10-09T09:00:00.000Z', updated_at: undefined })).toBe(true);
    expect(isStoredFormalities({ ...legacy, created_at: 'hier', updated_at: 'ce matin' })).toBe(true);
  });

  it('`withoutStoredFormalities` ne retire que les lignes reconnues, dans l’ordre', () => {
    const rows = [
      { id: 'a', ...legacy },
      { id: 'b', ...legacy, is_planned: false },
      { id: 'c', title: 'Parking', is_planned: true, metadata: null },
      { id: 'd', ...legacy, created_at: '2026-10-09T09:00:00.000Z', updated_at: '2026-10-09T10:00:00.000Z' },
      { id: 'e', ...legacy },
    ];
    expect(withoutStoredFormalities(rows).map((r) => r.id)).toEqual(['b', 'c', 'd']);
  });
});
