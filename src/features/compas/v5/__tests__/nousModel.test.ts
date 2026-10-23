import { describe, expect, it } from 'vitest';
import { FR_T } from '../../components/compasTypes';
import {
  buildShare,
  cleanReturnTime,
  emergencyView,
  gearSummary,
  hasRoute,
  mailtoHref,
  memberFacts,
  paceHeld,
  partyBounds,
  pendingFacts,
  planSwitch,
} from '../model/nous';
import { makeData, makeInput, U } from './fixtures';

describe('nous : bascule solo / avec d’autres', () => {
  it('vers le groupe : au moins deux personnes', () => {
    expect(planSwitch('group', 1, 0)).toEqual({ ok: true, partySize: 2 });
  });
  it('vers le groupe : au moins les membres présents plus les invitations', () => {
    expect(planSwitch('group', 3, 0)).toEqual({ ok: true, partySize: 3 });
    expect(planSwitch('group', 2, 2)).toEqual({ ok: true, partySize: 4 });
    expect(planSwitch('group', 40, 30)).toEqual({ ok: true, partySize: 50 });
  });
  it('vers le solo : une personne, sauf si d’autres membres sont dans le voyage', () => {
    expect(planSwitch('solo', 1, 0)).toEqual({ ok: true, partySize: 1 });
    expect(planSwitch('solo', 1, 3)).toEqual({ ok: true, partySize: 1 });
    expect(planSwitch('solo', 2, 0)).toEqual({ ok: false, reason: 'othersInTrip' });
  });
  it('bornes du stepper : jamais sous 2 ni sous le nombre de membres', () => {
    expect(partyBounds(1)).toEqual({ min: 2, max: 50 });
    expect(partyBounds(4)).toEqual({ min: 4, max: 50 });
  });
});

describe('nous : membres, allure et provenance', () => {
  it('rôle, niveau et allure viennent du modèle ; le propriétaire est l’organisateur', () => {
    const { model } = makeData();
    const f = memberFacts(model, U.tony);
    const tony = f.find((m) => m.userId === U.tony)!;
    expect(tony).toMatchObject({ isYou: true, role: 'owner', pace: { kmh: 4.2, provenance: null } });
    expect(tony.level).toMatchObject({ key: 'regular', raw: 'regulier' });
    expect(f.find((m) => m.userId === U.claire)).toMatchObject({ isYou: false, role: 'editor' });
    expect(f.find((m) => m.userId === U.leo)?.role).toBe('member');
  });
  it('le plus lent donne l’allure retenue', () => {
    const { model } = makeData();
    const f = memberFacts(model, U.tony);
    expect(f.filter((m) => m.setsPace).map((m) => m.name)).toEqual(['Léo']);
    expect(paceHeld(model.crew.pace)).toEqual({ kind: 'held', name: 'Léo', kmh: 3.4, known: 4, total: 4 });
  });
  it('une valeur absente est absente : ni zéro ni défaut', () => {
    const { model } = makeData({
      members: [
        { userId: U.tony, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: null, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null },
        { userId: U.claire, name: 'Claire', avatarUrl: null, role: 'viewer', maxCarryKg: null, flatSpeedKmh: null, experienceLevel: null, calibrationLevel: null },
      ],
    });
    const f = memberFacts(model, U.tony);
    expect(f.every((m) => m.pace === null && m.level === null && !m.setsPace)).toBe(true);
    expect(f[1].role).toBe('viewer');
    expect(paceHeld(model.crew.pace)).toEqual({ kind: 'none' });
  });
  it('une allure « average » n’est jamais présentée comme celle de la personne', () => {
    const { model } = makeData({
      members: [
        { userId: U.tony, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4.5, experienceLevel: 'advanced', calibrationLevel: null, profileSources: { flatSpeedKmH: 'average', experienceLevel: 'average' } },
        { userId: U.claire, name: 'Claire', avatarUrl: null, role: 'editor', maxCarryKg: 12, flatSpeedKmh: 4.6, experienceLevel: 'advanced', calibrationLevel: null, profileSources: { flatSpeedKmH: 'learned', experienceLevel: 'estimated' } },
      ],
    });
    const f = memberFacts(model, U.tony);
    expect(f[0].pace).toBeNull();
    expect(f[0].level).toBeNull();
    expect(f[1].pace).toEqual({ kmh: 4.6, provenance: 'learned' });
    expect(f[1].level).toMatchObject({ key: 'advanced', provenance: 'estimated' });
    expect(model.crew.pace.slowest?.name).toBe('Claire');
  });
  it('un niveau inconnu garde le texte de la base', () => {
    const { model } = makeData({
      members: [{ userId: U.tony, name: 'Tony', avatarUrl: null, role: 'owner', maxCarryKg: 14, flatSpeedKmh: 4, experienceLevel: 'sherpa', calibrationLevel: null }],
    });
    expect(memberFacts(model, U.tony)[0].level).toMatchObject({ key: null, raw: 'sherpa' });
  });
  it('invitations en attente', () => {
    expect(pendingFacts([{ id: 'i1', userId: null, name: 'Sophie', avatarUrl: null, role: 'viewer', createdAt: '2026-10-20' }])).toEqual([
      { id: 'i1', name: 'Sophie', avatarUrl: null, role: 'viewer' },
    ]);
  });
});

describe('nous : matériel commun', () => {
  it('liste les objets communs sans porteur et ceux déjà portés', () => {
    const { model } = makeData();
    const g = gearSummary(model);
    expect(g.sharedCount).toBe(2);
    expect(g.unassigned.map((l) => l.name).sort()).toEqual(['Réchaud et popote', 'Tente 2 places']);
    expect(g.shares.every((s) => s.items.length === 0)).toBe(true);
  });
  it('un objet porté compte pour son porteur, poids partiel si un objet n’a pas de poids', () => {
    const { model } = makeData({
      items: [
        { id: 'a', name: 'Tente', category: null, quantity: 1, weightGrams: 1900, isPacked: false, isVital: false, isWorn: false, isConsumable: false, ownership: 'shared', ownerId: U.claire, inventoryItemId: null, shopProductId: null, condition: null, reason: null, purchaseState: null },
        { id: 'b', name: 'Corde', category: null, quantity: 1, weightGrams: null, isPacked: false, isVital: false, isWorn: false, isConsumable: false, ownership: 'shared', ownerId: U.claire, inventoryItemId: null, shopProductId: null, condition: null, reason: null, purchaseState: null },
      ],
    });
    const g = gearSummary(model);
    expect(g.unassigned).toEqual([]);
    expect(g.shares.find((s) => s.userId === U.claire)).toMatchObject({ items: ['Tente', 'Corde'], grams: 1900, partial: true });
  });
});

describe('nous : numéros de secours', () => {
  it('le 112 en France, avec sa source européenne', () => {
    expect(emergencyView('fr')).toEqual({ source: 'eu', numbers: [{ number: '112', use: 'all' }] });
  });
  it('les numéros établis d’un autre pays', () => {
    expect(emergencyView('US')).toEqual({ source: 'national', numbers: [{ number: '911', use: 'all' }] });
    expect(emergencyView('jp')).toEqual({
      source: 'national',
      numbers: [
        { number: '110', use: 'police' },
        { number: '119', use: 'fireRescue' },
      ],
    });
  });
  it('pays inconnu ou sans numéro établi : le 112 seul, dit comme tel', () => {
    expect(emergencyView(null)).toEqual({ source: 'fallback', numbers: [{ number: '112', use: 'all' }] });
    expect(emergencyView('ZZ').source).toBe('fallback');
  });
});

describe('nous : message pour prévenir un proche', () => {
  const solo = makeInput();
  const { model } = makeData({ trip: { ...solo.trip, partySize: 1 }, members: [solo.members[0]] });
  const draft = (returnTime: string | null, countryCode: string | null = 'fr') => buildShare({ model, countryCode, returnTime, t: FR_T, locale: 'fr' });

  it('contient le voyage, les jours (distance, montée, nuit notée), le retour et le 112', () => {
    const d = draft('18:30');
    expect(d.subject).toBe('Mon itinéraire : Randonnée · Vercors');
    expect(d.body).toContain('Je pars en solo : Randonnée · Vercors.');
    expect(d.body).toMatch(/Du .*3 novembre.* au .*5 novembre/);
    expect(d.body).toContain('Sainte-Eulalie-en-Royans → Rencurel');
    expect(d.body).toContain('14 km');
    expect(d.body).toContain('820 m de montée');
    expect(d.body).toContain('nuit : Gîte du Royans');
    expect(d.body).toMatch(/Retour prévu le .*5 novembre.* vers 18:30\./);
    expect(d.body).toContain('préviens les secours : 112.');
    expect(d.body).toContain('Envoyé depuis le Compas');
  });
  it('sans heure de retour : la date de fin seule, jamais une heure inventée', () => {
    const d = draft(null);
    expect(d.body).toMatch(/Retour prévu le .*5 novembre.*\./);
    expect(d.body).not.toMatch(/vers \d/);
  });
  it('aucune coordonnée GPS dans le message', () => {
    expect(draft('18:30').body).not.toMatch(/\b4[45]\.\d{2,}|\b5\.[0-9]{2,}/);
  });
  it('pays inconnu : pas de numéro national inventé', () => {
    const d = draft(null, null);
    expect(d.body).toContain('(112 en Europe)');
  });
  it('la langue suit la locale', () => {
    const en = buildShare({ model, countryCode: 'fr', returnTime: '18:30', t: FR_T, locale: 'en' });
    expect(en.body).toContain('Je pars en solo'); // FR_T garde les phrases françaises ; les dates suivent la locale
    expect(en.body).toMatch(/Nov/);
  });
  it('heure de retour : seule la forme HH:MM est gardée', () => {
    expect(cleanReturnTime('18:30')).toBe('18:30');
    expect(cleanReturnTime('7:5')).toBeNull();
    expect(cleanReturnTime('25:00')).toBeNull();
    expect(cleanReturnTime(null)).toBeNull();
  });
  it('mailto: pour un message court, rien pour un message trop long', () => {
    const short = mailtoHref({ subject: 'Salut', body: 'Corps' });
    expect(short).toBe('mailto:?subject=Salut&body=Corps');
    expect(mailtoHref({ subject: 'x', body: 'é'.repeat(2000) })).toBeNull();
  });
  it('un voyage sans étape n’a pas d’itinéraire à partager', () => {
    expect(hasRoute(model)).toBe(true);
    expect(hasRoute(makeData({ steps: [] }).model)).toBe(false);
  });
});
