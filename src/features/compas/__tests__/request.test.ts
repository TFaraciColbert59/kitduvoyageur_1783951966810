import { describe, expect, it } from 'vitest';
import { defaultDays, understandRequest } from '../engine/request';

const TODAY = '2026-10-07';
const line = (r: ReturnType<typeof understandRequest>, key: string) => r.lines.find((l) => l.key === key);

describe('understandRequest — « voici ce que j’ai compris »', () => {
  it('la phrase seule suffit', () => {
    const r = understandRequest('5 jours de trek dans le Vercors à 3, en refuge', TODAY);
    expect(r.activity).toBe('trekking');
    expect(line(r, 'lieu')).toMatchObject({ value: 'Vercors', state: 'compris' });
    expect(line(r, 'quand')).toMatchObject({ value: '5 jours', state: 'compris' });
    expect(line(r, 'groupe')).toMatchObject({ value: '3 personnes', state: 'compris' });
    expect(line(r, 'nuits')).toMatchObject({ value: 'Refuges' });
    expect(r.say).toBe('5 jours de trek dans le Vercors à 3, en refuge');
    expect(r.empty).toBe(false);
  });

  it('sans durée : durée par défaut annoncée et ajoutée à la phrase', () => {
    const r = understandRequest('escalade à Kalymnos', TODAY);
    expect(line(r, 'quand')).toMatchObject({ state: 'defaut', value: '3 jours par défaut · date choisie au mieux' });
    expect(r.say).toBe('escalade à Kalymnos · 3 jours');
  });

  it('les précisions priment et partent avec la phrase', () => {
    const r = understandRequest('rando dans les Vosges', TODAY, { days: 4, party: 2, activity: 'trekking' });
    expect(r.activity).toBe('trekking');
    expect(line(r, 'activite')?.state).toBe('precise');
    expect(line(r, 'quand')).toMatchObject({ value: '4 jours', state: 'precise' });
    expect(line(r, 'groupe')).toMatchObject({ value: '2 personnes', state: 'precise' });
    expect(r.say).toBe('rando dans les Vosges · 4 jours · à 2');
  });

  it('lieu non lu par les règles : cherché dans la phrase (l’IA le trouvera)', () => {
    const r = understandRequest('Le Népal en trek, 3 semaines', TODAY);
    expect(line(r, 'lieu')).toMatchObject({ state: 'a_trouver' });
    expect(line(r, 'quand')?.value).toBe('21 jours');
  });

  it('sortie de quelques heures : pas de durée par défaut', () => {
    const r = understandRequest('rando 2h demain autour de Grenoble', TODAY);
    expect(line(r, 'quand')?.state).toBe('compris');
    expect(r.say).toBe('rando 2h demain autour de Grenoble');
  });

  it('vide sans phrase ni activité', () => {
    expect(understandRequest('  ', TODAY).empty).toBe(true);
    expect(understandRequest('', TODAY, { activity: 'ski' }).empty).toBe(false);
    expect(understandRequest('', TODAY, { activity: 'ski' }).say).toBe('6 jours');
  });

  it('durées par défaut cohérentes', () => {
    expect(defaultDays('running')).toBe(1);
    expect(defaultDays('trekking')).toBe(7);
    expect(defaultDays(null)).toBe(7);
  });
});
