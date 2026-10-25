import { describe, expect, it } from 'vitest';
import { buildCompasModel, type CompasMemberInput } from '../engine/compasModel';
import { compasInput, U1, U2 } from './helpers/compasData';
import {
  HUB_GROUP_PATH,
  capacityCounts,
  loadView,
  memberView,
  pendingViews,
  unknownProfiles,
} from '../engine/crewView';
import { isPopulationDefault, withKnownProfile } from '../engine/crew';
import { canOpenCompasLab } from '../dev/labPolicy';

const member = (p: Partial<CompasMemberInput> & { userId: string; name: string }): CompasMemberInput => ({
  avatarUrl: null,
  role: 'member',
  maxCarryKg: null,
  flatSpeedKmh: null,
  experienceLevel: null,
  calibrationLevel: null,
  ...p,
});

describe('moyenne de population ≠ donnée de la personne', () => {
  it('seule la provenance « average » est une valeur par défaut ; sans provenance, la valeur est gardée', () => {
    expect(isPopulationDefault({ flatSpeedKmH: 'average' }, 'flatSpeedKmH')).toBe(true);
    expect(isPopulationDefault({ flatSpeedKmH: 'learned' }, 'flatSpeedKmH')).toBe(false);
    expect(isPopulationDefault({}, 'flatSpeedKmH')).toBe(false);
    expect(isPopulationDefault(null, 'flatSpeedKmH')).toBe(false);
  });

  it('withKnownProfile vide l’allure et le niveau « moyenne », pas ceux appris ou sans provenance', () => {
    const base = { flatSpeedKmh: 4, experienceLevel: 'intermediate' };
    expect(withKnownProfile({ ...base, profileSources: { flatSpeedKmH: 'average', experienceLevel: 'average' } })).toMatchObject({
      flatSpeedKmh: null,
      experienceLevel: null,
    });
    expect(withKnownProfile({ ...base, profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated' } })).toMatchObject(base);
    expect(withKnownProfile({ ...base })).toMatchObject(base);
  });

  it('le modèle ne dit « rythme de Léa » que si son allure est la sienne', () => {
    const avg = { flatSpeedKmH: 'average', experienceLevel: 'average', maxCarryKg: 'average' };
    const model = buildCompasModel(
      compasInput({
        members: [
          member({ userId: U1, name: 'Tony', role: 'owner', flatSpeedKmh: 4.6, experienceLevel: 'advanced', profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated' } }),
          member({ userId: U2, name: 'Léa', flatSpeedKmh: 4, experienceLevel: 'intermediate', maxCarryKg: 14, profileSources: avg }),
        ],
      })
    );
    const lea = model.crew.loads.find((l) => l.userId === U2)!;
    expect(lea.flatSpeedKmh).toBeNull();
    expect(lea.experienceLevel).toBeNull();
    expect(model.crew.pace).toMatchObject({ known: 1, total: 2, slowest: { name: 'Tony', speedKmh: 4.6 } });
  });
});

describe('la charge portée par membre', () => {
  it('sans capacité : aucune barre, « capacité non renseignée », jamais 0 %', () => {
    const v = loadView({ carriedGrams: 3200, capacityKg: null, ratio: null });
    expect(v.text).toBe('porte 3,2 kg · capacité non renseignée');
    expect(v.barPct).toBeNull();
    expect(v.pct).toBeNull();
    expect(v.limit).toBeNull();
  });

  it('avec capacité : barre plafonnée à 100, ton selon le seuil, texte avec chiffres', () => {
    expect(loadView({ carriedGrams: 9000, capacityKg: 14, ratio: 0.64 })).toMatchObject({ pct: 64, barPct: 64, tone: 'good' });
    expect(loadView({ carriedGrams: 13000, capacityKg: 14, ratio: 0.93 })).toMatchObject({ pct: 93, tone: 'warn' });
    const over = loadView({ carriedGrams: 16000, capacityKg: 14, ratio: 1.14 });
    expect(over).toMatchObject({ pct: 114, barPct: 100, tone: 'bad' });
    expect(over.text).toBe('porte 16 kg sur 14 kg');
  });

  it('une capacité issue du profil du voyage est dite « repère moyen » : c’est un repère de population', () => {
    for (const maxCarryKg of ['average', 'estimated']) {
      const v = loadView({ carriedGrams: 5000, capacityKg: 14, ratio: 0.36, profileSources: { maxCarryKg } });
      expect(v.limitNote).toBe('repère moyen');
      expect(v.text).toBe('porte 5 kg sur 14 kg (repère moyen)');
    }
  });

  it('capacityCounts : renseignée, repère moyen, absente', () => {
    expect(
      capacityCounts([
        { capacityKg: 14, profileSources: { maxCarryKg: 'estimated' } },
        { capacityKg: 14, profileSources: { maxCarryKg: 'average' } },
        { capacityKg: 12, profileSources: null },
        { capacityKg: null, profileSources: null },
      ])
    ).toEqual({ declared: 1, estimated: 2, unknown: 1 });
  });
});

describe('niveau, rôle et présence', () => {
  const load = (p: Partial<Parameters<typeof memberView>[0]> = {}) =>
    ({
      userId: U2,
      name: 'Léa',
      avatarUrl: null,
      role: 'member',
      carriedGrams: 0,
      capacityKg: null,
      flatSpeedKmh: null,
      experienceLevel: null,
      calibrationLevel: null,
      profileSources: null,
      ratio: null,
      sharedItemIds: [],
      ...p,
    }) as Parameters<typeof memberView>[0];

  it('niveau et allure absents : null, pas de valeur par défaut déguisée', () => {
    const v = memberView(load(), U1);
    expect(v.level).toBeNull();
    expect(v.pace).toBeNull();
    expect(v.role).toBe('Membre du groupe');
    expect(v.presence).toBe('present');
  });

  it('niveau en mots, « estimé » quand il vient de l’orientation déclarée ; allure « mesurée » quand apprise', () => {
    const v = memberView(
      load({ experienceLevel: 'advanced', flatSpeedKmh: 4.6, profileSources: { experienceLevel: 'estimated', flatSpeedKmH: 'learned' } }),
      U1
    );
    expect(v).toMatchObject({ level: 'confirmé', levelNote: 'estimé', pace: '4,6 km/h', paceNote: 'mesurée' });
  });

  it('l’organisateur est dit organisateur, un rôle inconnu reste « Membre »', () => {
    expect(memberView(load({ userId: U1, role: 'editor' }), U1).role).toBe('Organisateur');
    expect(memberView(load({ role: 'capitaine' }), U1).role).toBe('Membre');
    expect(memberView(load({ role: 'viewer' }), U1).role).toBe('Lecture seule');
  });

  it('invitation en attente : la personne n’est pas encore présente', () => {
    const [p] = pendingViews([{ id: 'i1', userId: null, name: 'Sam', avatarUrl: null, role: 'viewer', createdAt: '2026-10-10T09:00:00Z' }]);
    expect(p.text).toBe('Invitation en attente · lecture seule');
  });

  it('unknownProfiles compte ce qui manque', () => {
    const a = memberView(load(), U1);
    const b = memberView(load({ experienceLevel: 'expert', flatSpeedKmh: 5 }), U1);
    expect(unknownProfiles([a, b])).toEqual({ level: 1, pace: 1 });
  });

  it('le groupe se gère dans le Hub', () => {
    expect(HUB_GROUP_PATH).toBe('/hub/groupe');
  });
});

describe('page de laboratoire /dev/compas', () => {
  it('ne s’ouvre qu’en développement : production, prévisualisation, tests et variable absente la refusent', () => {
    expect(canOpenCompasLab('development')).toBe(true);
    for (const env of ['production', 'test', 'preview', '', undefined]) expect(canOpenCompasLab(env)).toBe(false);
  });
});
