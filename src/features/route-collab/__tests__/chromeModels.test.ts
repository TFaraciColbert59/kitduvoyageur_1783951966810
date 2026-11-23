import { describe, expect, it } from 'vitest';
import { isEditableTarget, levelToClose, levelToDrop } from '../components/workspace/chrome/levels';
import { layoutForWidth } from '../components/workspace/chrome/layout';
import { buildPillModel, readinessText, stageFacts } from '../components/workspace/chrome/pillModel';
import { scanPublications } from '../components/workspace/chrome/publicationAlert';
import { saveStatusOf, type SaveInputs } from '../components/workspace/chrome/saveStatus';
import { computeStageMetrics, formatStageKm } from '../components/workspace/metrics';
import { planSayCommands, parseSayCommand, sectionsToRecalc } from '../sayCommands';
import type { RouteRevisionSnapshot } from '../types';
import { baseWorkspace, basePoints, kit, section, stage } from '../insights/__tests__/fixtures';

const base: SaveInputs = {
  serverSynced: true,
  pending: 0,
  ackedSeq: 4,
  headSeq: 4,
  queued: 0,
  conflicts: 0,
  failedReason: null,
  online: true,
};

describe('saveStatusOf · sauvegarde dite honnêtement (3.5, 3.6)', () => {
  it('« Enregistré » seulement quand le serveur a accusé la dernière séquence', () => {
    expect(saveStatusOf(base).label).toBe('Enregistré');
    expect(saveStatusOf({ ...base, headSeq: 5 }).label).toBe('Non enregistré');
    expect(saveStatusOf({ ...base, serverSynced: false }).label).toBe('Non enregistré');
    expect(saveStatusOf({ ...base, pending: 1 }).label).toBe('Enregistrement…');
    expect(saveStatusOf({ ...base, failedReason: 'Droits insuffisants' })).toMatchObject({ kind: 'unsaved', detail: 'Droits insuffisants' });
  });
  it('hors ligne : « 2 changements en attente » ; au retour : « 1 en conflit · voir »', () => {
    expect(saveStatusOf({ ...base, online: false, queued: 2 }).label).toBe('2 changements en attente');
    expect(saveStatusOf({ ...base, queued: 1 }).label).toBe('1 changement en attente');
    expect(saveStatusOf({ ...base, conflicts: 1, queued: 2 })).toMatchObject({ kind: 'conflict', label: '1 en conflit · voir' });
  });
});

describe('buildPillModel · la pilule parle (3.1, 3.2, 3.7, 3.8)', () => {
  it('résumé « 2 j · 20 km · 1 200 m », deux jours, voyant vert (tracé continu, altitude et surface connues)', () => {
    const m = buildPillModel(baseWorkspace(), base);
    expect(m.summary.replace(/ /g, ' ')).toBe('2 j · 20 km · 1 200 m');
    expect(m.days.map((d) => d.label)).toEqual(['J1', 'J2']);
    expect(m.days[0].title).toMatch(/^Jour 1 · 10 km · D\+ 600 m$/);
    expect(m.light.level).toBe('green');
  });
  it('D+ inconnu : « D+ ? » dans le résumé et « D+ inconnu » sur le jour, jamais 0', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({ sections: [section('s1', a, b), section('s2', b, c, { ascentM: null })] });
    const m = buildPillModel(ws, base);
    expect(m.summary).toMatch(/D\+ \?$/);
    expect(m.days[1].title).toBe('Jour 2 · 10 km · D+ inconnu');
    expect(m.light.level).toBe('orange');
    expect(m.light.firstFaultySectionId).toBe('s2');
  });
  it('« Presque prêt · 2 points », jamais une note', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({
      sections: [section('s1', a, b), section('s2', b, c)],
      stages: [stage('g1', 1, 'a', 'b', { dateIso: '2026-07-10', overnightPlace: null }), stage('g2', 2, 'b', 'c', { dateIso: null })],
    });
    const m = buildPillModel(ws, base);
    expect(m.readiness.text).toMatch(/^(Presque prêt|À compléter) · \d points?$/);
    expect(m.readiness.text).not.toMatch(/\d\s*\/\s*\d|%|★/);
    expect(readinessText({ label: 'Prêt', remaining: [] })).toBe('Prêt');
  });
  it('un jour sans tronçon est dit « distance inconnue », pas 0 km', () => {
    const ws = baseWorkspace({ sections: [] });
    expect(stageFacts(ws, ws.stages[0])).toMatchObject({ km: 'distance inconnue', ascent: 'D+ inconnu', known: false });
  });
  it('voyant rouge : tracé absent', () => {
    const m = buildPillModel(baseWorkspace({ sections: [], points: [] }), base);
    expect(m.light.level).toBe('red');
  });
});

function revision(no: number, by: string, name: string, over: Partial<RouteRevisionSnapshot> = {}): RouteRevisionSnapshot {
  const ws = baseWorkspace();
  return {
    id: `rev-${no}`,
    workspaceId: 'w',
    revisionNo: no,
    parentRevisionId: null,
    basedOnSeq: 1,
    createdBy: by,
    createdByName: name,
    createdAt: '2026-07-01T00:00:00Z',
    kind: 'published',
    summary: '',
    points: ws.points,
    sections: ws.sections,
    stages: ws.stages,
    kitSnapshot: [],
    acknowledgedUnknowns: [],
    ...over,
  };
}

describe('scanPublications · une alerte par publication (3.10)', () => {
  it('une version d’Alice : « Version 2 publiée par Alice » et ce qui change', () => {
    const [a, b, c] = basePoints();
    const r1 = revision(1, 'me', 'Moi');
    const r2 = revision(2, 'alice', 'Alice', {
      sections: [section('s1', a, b), section('s2', b, c, { distanceKm: 14 })],
    });
    const scan = scanPublications({ seenNo: 1, revisions: [r1, r2], currentUserId: 'me' });
    expect(scan.seenNo).toBe(2);
    expect(scan.alert?.title).toBe('Version 2 publiée par Alice');
    expect(scan.alert?.sub).toBe('Ce qui change pour toi : +4 km le jour 2');
  });
  it('plusieurs versions : une seule alerte regroupée', () => {
    const r1 = revision(1, 'me', 'Moi');
    const revs = [r1, revision(2, 'alice', 'Alice'), revision(3, 'eloi', 'Éloi'), revision(4, 'alice', 'Alice')];
    const scan = scanPublications({ seenNo: 1, revisions: revs, currentUserId: 'me' });
    expect(scan.alert?.count).toBe(3);
    expect(scan.alert?.title).toBe('Versions 2 à 4 publiées par Alice et Éloi');
  });
  it('ses propres publications et les versions déjà vues ne déclenchent rien', () => {
    const own = scanPublications({ seenNo: 0, revisions: [revision(1, 'me', 'Moi')], currentUserId: 'me' });
    expect(own.alert).toBeNull();
    expect(own.seenNo).toBe(1);
    const seen = scanPublications({ seenNo: 2, revisions: [revision(1, 'a', 'A'), revision(2, 'a', 'A')], currentUserId: 'me' });
    expect(seen.alert).toBeNull();
    // un brouillon (candidat) n'est pas une publication
    const cand = scanPublications({ seenNo: 0, revisions: [revision(1, 'a', 'A', { kind: 'candidate' })], currentUserId: 'me' });
    expect(cand.alert).toBeNull();
  });
  it('« pour toi » : mes objets à revérifier', () => {
    const r1 = revision(1, 'me', 'Moi', { kitSnapshot: [kit('k1', { assigneeUserId: 'me', assigneeName: 'Moi' })] });
    const r2 = revision(2, 'alice', 'Alice', {
      kitSnapshot: [kit('k1', { assigneeUserId: 'me', assigneeName: 'Moi', status: 'needs_revalidation' })],
    });
    const scan = scanPublications({ seenNo: 1, revisions: [r1, r2], currentUserId: 'me' });
    expect(scan.alert?.sub).toContain('dans ton sac, à revérifier : 1');
  });
  it('première publication du groupe : sans comparaison inventée', () => {
    const scan = scanPublications({ seenNo: 0, revisions: [revision(1, 'alice', 'Alice')], currentUserId: 'me' });
    expect(scan.alert?.sub).toBe('Ce qui change pour toi : premier plan publié du groupe');
  });
});

describe('levels · deux niveaux au plus, un niveau par Échap (4.6)', () => {
  const open = { sheetOpen: true, subDrawer: false, overlay: false, mapMenu: false };
  it('ferme le niveau le plus haut, un seul à la fois', () => {
    expect(levelToClose({ ...open, subDrawer: true, mapMenu: true })).toBe('map-menu');
    expect(levelToClose({ ...open, overlay: true })).toBe('overlay');
    expect(levelToClose({ ...open, subDrawer: true })).toBe('sub-drawer');
    expect(levelToClose(open)).toBe('sheet');
    expect(levelToClose({ ...open, sheetOpen: false })).toBe('none');
  });
  it('un niveau qui s’ouvre remplace l’autre', () => {
    expect(levelToDrop({ subDrawer: true, overlay: true }, 'overlay')).toBe('sub-drawer');
    expect(levelToDrop({ subDrawer: true, overlay: true }, 'sub-drawer')).toBe('overlay');
    expect(levelToDrop({ subDrawer: true, overlay: false }, 'sub-drawer')).toBeNull();
  });
  it('les champs de saisie gardent leur Échap', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('layoutForWidth · deux ou trois colonnes (4.9)', () => {
  it('seuils 640 et 1 024 px', () => {
    expect(layoutForWidth(390)).toBe('mobile');
    expect(layoutForWidth(639)).toBe('mobile');
    expect(layoutForWidth(640)).toBe('tablet');
    expect(layoutForWidth(1023)).toBe('tablet');
    expect(layoutForWidth(1024)).toBe('desktop');
    expect(layoutForWidth(1440)).toBe('desktop');
  });
});

describe('sectionsToRecalc · tronçons à recalculer après « Dis-le »', () => {
  const ctx = { actorId: 'u', actorName: 'U', stamp: 'x', nowIso: '2026-11-18T10:00:00.000Z' };
  it('inverser le sens recalcule tous les tronçons calculés', () => {
    const ws = baseWorkspace({ sport: 'marche', members: [{ userId: 'u', displayName: 'U', role: 'owner' }] });
    const parse = parseSayCommand('inverse le sens');
    const plan = planSayCommands(parse.commands, ws, ctx);
    expect(plan.ok).toBe(true);
    expect(plan.recalc).toBe('all');
    expect(sectionsToRecalc(plan).length).toBeGreaterThan(0);
  });
  it('rien à recalculer : liste vide', () => {
    const ws = baseWorkspace();
    expect(sectionsToRecalc({ recalc: 'none', after: ws })).toEqual([]);
  });
  it('les tronçons manuels ne sont jamais recalculés sans demande', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({ sections: [section('s1', a, b, { mode: 'manual' }), section('s2', b, c)] });
    expect(sectionsToRecalc({ recalc: 'all', after: ws })).toEqual(['s2']);
  });
});

describe('computeStageMetrics · une étape sans tronçon n’est pas à 0 km (4.5)', () => {
  it('distance inconnue tant qu’aucun tronçon ne relie les points de l’étape', () => {
    const ws = baseWorkspace({ sections: [] });
    const m = computeStageMetrics(ws.stages[0], ws.points, ws.sections);
    expect(m.distanceKnown).toBe(false);
    expect(formatStageKm(m)).toBe('Inconnue');
  });
  it('distance connue : écrite en km', () => {
    const ws = baseWorkspace();
    const m = computeStageMetrics(ws.stages[0], ws.points, ws.sections);
    expect(m.distanceKnown).toBe(true);
    expect(formatStageKm(m).replace(/\u202f/g, ' ')).toBe('10 km');
  });
});
