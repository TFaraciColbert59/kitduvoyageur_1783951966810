import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { understandRequest } from '../engine/request';
import { resemblesQuery } from '../engine/places';

// Constats de la phase 7 (docs/compas/phase7/CONSTATS.md) : chaque test rejoue la phrase du jeu qui a révélé le défaut.
const TODAY = '2026-10-19';
const line = (r: ReturnType<typeof understandRequest>, key: string) => r.lines.find((l) => l.key === key);

describe('C-001 · le groupe dit par « avec … » est compris', () => {
  it('« avec mon couple » → 2 personnes', () => {
    const r = understandRequest('2 semaines en Sardaigne en juillet avec mon couple', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '2 personnes', state: 'compris' });
  });
  it('« avec 2 enfants » → moi et 2 enfants', () => {
    const r = understandRequest('week-end à Annecy avec 2 enfants', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '3 personnes', state: 'compris' });
  });
  it('« avec ma femme et 2 enfants » → 4', () => {
    const r = understandRequest('3 jours dans le Vercors avec ma femme et 2 enfants', TODAY);
    expect(line(r, 'groupe')).toMatchObject({ value: '4 personnes' });
  });
  it('sans nombre sûr (« avec des amis », « avec mon sac »), le groupe reste non compris', () => {
    expect(line(understandRequest('3 jours dans le Vercors avec des amis', TODAY), 'groupe')?.state).toBe('defaut');
    expect(line(understandRequest('3 jours dans le Vercors avec mon sac de 10 kg', TODAY), 'groupe')?.state).toBe('defaut');
  });
  it('un nombre dit ailleurs prime (« à 4 avec des amis »)', () => {
    expect(line(understandRequest('3 jours dans le Vercors à 4 avec des amis', TODAY), 'groupe')).toMatchObject({ value: '4 personnes' });
  });
});

describe('C-002 · la saison dite place le départ', () => {
  it('« week-end à Chamonix en hiver » ne part pas en octobre', () => {
    const r = understandRequest('un week-end à Chamonix en hiver', TODAY);
    expect(line(r, 'quand')?.value).toMatch(/déc\./);
  });
  it('la saison en cours ne change pas le départ (automne, dit en octobre)', () => {
    const a = understandRequest('un week-end à Annecy', TODAY);
    const b = understandRequest('un week-end à Annecy en automne', TODAY);
    expect(line(b, 'quand')?.value).toBe(line(a, 'quand')?.value);
  });
  it('un mois dit l’emporte sur la saison', () => {
    const r = understandRequest('week-end à Chamonix en février, en hiver', TODAY);
    expect(line(r, 'quand')?.value).toMatch(/févr\./);
  });
});

describe('C-003 · un lieu qui ne ressemble pas à la demande est refusé', () => {
  it('« Highlanders écossais » n’est pas « Highlands écossais »', () => {
    expect(resemblesQuery({ name: 'Highlanders écossais' }, 'Highlands écossais')).toBe(false);
  });
  it('même nom ou nom plus long accepté', () => {
    expect(resemblesQuery({ name: 'Chamonix-Mont-Blanc' }, 'Chamonix')).toBe(true);
    expect(resemblesQuery({ name: 'Annecy' }, 'Annecy')).toBe(true);
  });
  it('C-008 · même lieu dit dans une autre langue (Gran Paradiso)', () => {
    expect(resemblesQuery({ name: 'Parco Nazionale Gran Paradiso' }, 'Parc national du Gran Paradiso')).toBe(true);
    expect(resemblesQuery({ name: 'Highlanders écossais' }, 'Highlands écossais')).toBe(false);
  });
});

describe('C-005 · le crédit de la carte ne passe pas par-dessus un tiroir', () => {
  it('.cp-map crée son propre contexte d’empilement', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-map \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/isolation:\s*isolate/);
  });
  it('D-32 · le crédit est sous le panneau des calques', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    expect(css).toMatch(/\.cp-map \.leaflet-bottom\.leaflet-right \{\s*z-index: 3 !important/);
  });
  it('D-31 · le panneau des calques défile au-dessus de la barre d’onglets', () => {
    const css = readFileSync('src/features/compas/compas.css', 'utf8');
    const block = /^\.cp-mopts \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(block).toMatch(/max-height:[^;]*--cp-nav-clear/);
    expect(block).toMatch(/overflow-y:\s*auto/);
  });
});
