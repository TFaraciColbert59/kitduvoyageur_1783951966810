import { describe, it, expect } from 'vitest';
import { openPointsView, OPEN_POINTS_INLINE_LIMIT, type OpenPoint } from '../components/DepartureStep';

function pt(id: string): OpenPoint {
  return { id, label: `label ${id}`, sheet: null };
}

describe('P3.2 — le bandeau « à vérifier » s étire sans dériver en mur de texte', () => {
  it('sous le seuil, on nomme chaque point : chacun se corrige d un clic', () => {
    const points = [pt('equipement'), pt('repas'), pt('activite'), pt('depart'), pt('date')];
    const v = openPointsView(points);
    expect(OPEN_POINTS_INLINE_LIMIT).toBe(6);
    expect(v.mode).toBe('liste');
    expect(v.points).toHaveLength(5);
  });

  it('au seuil exact, on liste encore (le seuil est inclus dans la liste)', () => {
    const points = Array.from({ length: OPEN_POINTS_INLINE_LIMIT }, (_, i) => pt(`gap-${i}`));
    expect(openPointsView(points).mode).toBe('liste');
  });

  it('au seuil + 1, on resume : un resume au lieu de sept lignes', () => {
    const points = Array.from({ length: OPEN_POINTS_INLINE_LIMIT + 1 }, (_, i) => pt(`gap-${i}`));
    expect(openPointsView(points).mode).toBe('resume');
  });

  it('deux trous d étape de même nature forment UN seul groupe, pas deux', () => {
    const v = openPointsView([pt('gap-a'), pt('gap-b')]);
    expect(v.groupes).toHaveLength(1);
    expect(v.groupes[0].cle).toBe('etapes');
    expect(v.groupes[0].count).toBe(2);
  });

  it('les groupes sont exacts : les natures connues gardent leur libellé', () => {
    const v = openPointsView([pt('equipement'), pt('repas'), pt('depart'), pt('date'), pt('participants')]);
    const total = v.groupes.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(5);
    expect(v.groupes.map((g) => g.cle).sort()).toEqual(
      ['date', 'depart', 'equipement', 'participants', 'repas'].sort(),
    );
    expect(v.groupes.find((g) => g.cle === 'equipement')?.label).toBe('Equipement');
  });

  it('un identifiant inconnu ne disparaît pas : il est compté, pas ignoré', () => {
    const v = openPointsView([pt('equipement'), pt('mecanique-inconnue')]);
    const total = v.groupes.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(2);
    expect(v.groupes.find((g) => g.cle === 'autres')?.count).toBe(1);
  });

  it('le regroupement ne perd AUCUN point, même en résumé', () => {
    const points = [
      pt('equipement'),
      pt('repas'),
      pt('depart'),
      pt('date'),
      pt('participants'),
      pt('inconnu'),
      pt('gap-0'),
    ];
    const v = openPointsView(points);
    expect(v.mode).toBe('resume');
    expect(v.groupes.reduce((n, g) => n + g.count, 0)).toBe(points.length);
    expect(v.points).toHaveLength(points.length);
  });

  it('le vide est un vide : aucun point, aucun groupe, aucun résumé', () => {
    const v = openPointsView([]);
    expect(v.mode).toBe('liste');
    expect(v.points).toEqual([]);
    expect(v.groupes).toEqual([]);
  });
});