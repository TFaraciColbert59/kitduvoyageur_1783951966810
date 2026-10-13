import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OfficialAlertTexts from '../components/OfficialAlertTexts';
import { MAX_POLYGON_CHARS, parsePolygon } from '../engine/capGeometry';
import { METEOALARM_FEEDS } from '../engine/meteoalarmFeeds';
import {
  LIMITS,
  cleanText,
  digestMeteoalarm,
  readDigest,
  readMeteoalarm,
  safeHttpsUrl,
} from '../engine/officialAlerts';

/**
 * Le flux Meteoalarm est celui d'un tiers (plan 4.9, contrôle de sécurité du lot U) :
 * texte nettoyé et borné, adresses en https, tailles de listes bornées, message
 * illisible compté (jamais pris pour un lieu calme), messages de test ignorés,
 * texte officiel gardé par langue. Formes relevées sur les flux réels du 11 oct. 2026.
 */

const NOW = new Date('2026-10-11T07:00:00+02:00');
const BASE = { from: '2026-10-11', to: '2026-10-12', now: NOW, fetchedAt: '2026-10-11T05:00:00.000Z' };

interface InfoSpec {
  language?: string;
  area?: string;
  headline?: unknown;
  description?: unknown;
  instruction?: unknown;
  web?: unknown;
  senderName?: unknown;
  level?: string | null;
  onset?: string;
  expires?: string | null;
  polygon?: string[];
}
const info = (o: InfoSpec = {}) => ({
  language: o.language ?? 'fr-FR',
  headline: o.headline,
  description: o.description,
  instruction: o.instruction,
  web: o.web,
  senderName: o.senderName ?? 'Service',
  onset: o.onset ?? '2026-10-11T06:00:00+02:00',
  ...(o.expires === null ? {} : { expires: o.expires ?? '2026-10-11T21:00:00+02:00' }),
  area: [{ areaDesc: o.area ?? 'Rhône', ...(o.polygon ? { polygon: o.polygon } : {}) }],
  parameter: [
    ...(o.level === null ? [] : [{ valueName: 'awareness_level', value: o.level ?? '3; orange; Severe' }]),
    { valueName: 'awareness_type', value: '3; Thunderstorm' },
  ],
});
const warning = (id: string, infos: unknown[], extra: Record<string, unknown> = {}) => ({
  alert: { identifier: id, msgType: 'Alert', status: 'Actual', sent: '2026-10-10T18:00:00+02:00', info: infos, ...extra },
});
const FR = { ...BASE, names: ['Rhône'], feed: METEOALARM_FEEDS.fr };

describe('cleanText — texte d’un tiers', () => {
  it('retire les caractères de contrôle et les marques de direction forcée, garde les retours à la ligne', () => {
    expect(cleanText('Vent\u0000 fort\u0007\r\nPrudence‮', 100)).toBe('Vent fort\nPrudence');
    expect(cleanText('a⁦b⁩c', 100)).toBe('abc');
    expect(cleanText('x\u0085y\u007fz', 100)).toBe('xyz');
  });

  it('un texte vide ou qui n’est pas un texte : null', () => {
    expect(cleanText('   \u0000 ', 100)).toBeNull();
    expect(cleanText(undefined, 100)).toBeNull();
    expect(cleanText(42, 100)).toBeNull();
    expect(cleanText({ toString: () => 'x' }, 100)).toBeNull();
  });

  it('borne la longueur, sans couper un caractère en deux', () => {
    const long = '🌧'.repeat(50);
    const out = cleanText(long, 10) as string;
    expect([...out]).toHaveLength(10);
    expect(out.endsWith('…')).toBe(true);
    expect(cleanText('court', 10)).toBe('court');
  });

  it('ne touche pas au HTML : c’est du texte, affiché comme tel', () => {
    expect(cleanText('<img src=x onerror=alert(1)>', 100)).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('safeHttpsUrl — adresse d’un tiers', () => {
  it('https seulement, sans identifiants, bornée', () => {
    expect(safeHttpsUrl('https://warnungen.geosphere.at')).toBe('https://warnungen.geosphere.at/');
    expect(safeHttpsUrl('http://www.meteoswiss.admin.ch')).toBeNull();
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('data:text/html,<script>1</script>')).toBeNull();
    expect(safeHttpsUrl('https://user:pass@exemple.fr/')).toBeNull();
    expect(safeHttpsUrl(`https://exemple.fr/${'a'.repeat(LIMITS.web)}`)).toBeNull();
    expect(safeHttpsUrl('pas une adresse')).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});

describe('digestMeteoalarm — entrée non fiable', () => {
  it('l’alerte rendue ne porte que du texte nettoyé et une adresse https', () => {
    const feed = {
      warnings: [
        warning('a', [
          info({
            headline: 'Orage\u0000 <b>fort</b>',
            description: 'Grêle|Rafales',
            web: 'http://exemple.fr/alerte',
            senderName: 'Service‮',
          }),
        ]),
        warning('b', [
          info({
            web: 'https://www.exemple.fr/alerte',
            level: '4; red; Extreme',
            onset: '2026-10-12T06:00:00+02:00',
            expires: '2026-10-12T21:00:00+02:00',
          }),
        ]),
      ],
    };
    const { alerts } = readMeteoalarm(feed, FR);
    const a = alerts.find((x) => x.id === 'b');
    expect(a?.web).toBe('https://www.exemple.fr/alerte');
    const o = alerts.find((x) => x.id === 'a');
    expect(o).not.toHaveProperty('web');
    // Pas de HTML interprété ni retiré : le texte reste tel quel (échappé à l'affichage), sans caractère de contrôle.
    expect(o?.headline).toBe('Orage <b>fort</b>');
    expect(o?.headline).not.toContain('\u0000');
  });

  it('une langue inventée n’est pas reprise comme étiquette de langue', () => {
    const feed = { warnings: [warning('a', [info({ language: '"><script>x</script>', description: 'Texte' })])] };
    const { alerts } = readMeteoalarm(feed, FR);
    expect(alerts[0].texts?.[0].lang).toBe('');
  });

  it('texte officiel : titre, description et consigne par langue, français puis anglais puis langue locale', () => {
    const feed = {
      warnings: [
        warning('it-1', [
          info({ language: 'it-IT', area: 'Sardegna', headline: 'Allerta', description: 'Vento forte', instruction: 'Prudenza' }),
          info({ language: 'en-GB', area: 'Sardegna', headline: 'Warning', description: 'Strong wind', instruction: 'Take care' }),
        ]),
      ],
    };
    const { alerts } = readMeteoalarm(feed, { ...BASE, names: ['Sardegna'], feed: METEOALARM_FEEDS.it });
    expect(alerts[0].texts).toEqual([
      { lang: 'en-GB', headline: 'Warning', description: 'Strong wind', instruction: 'Take care' },
      { lang: 'it-IT', headline: 'Allerta', description: 'Vento forte', instruction: 'Prudenza' },
    ]);
    // Le titre affiché dans le libellé est le premier : anglais avant la langue locale.
    expect(alerts[0].headline).toBe('Warning');
  });

  it('les textes longs d’une alerte déjà finie ne sont pas gardés (poids du cache), ceux d’une alerte en vigueur le sont', () => {
    const feed = {
      warnings: [
        warning('finie', [info({ description: 'Ancien texte', expires: '2026-10-10T20:00:00+02:00' })]),
        warning('active', [info({ description: 'Texte en vigueur', instruction: 'Consigne' })]),
      ],
    };
    const digest = digestMeteoalarm(feed, NOW)!;
    const byId = (id: string) => digest.candidates.find((c) => c.id === id)!;
    expect(byId('finie').blocks[0].description).toBeNull();
    expect(byId('active').blocks[0]).toMatchObject({ description: 'Texte en vigueur', instruction: 'Consigne' });
  });

  it('une description démesurée est bornée', () => {
    const feed = { warnings: [warning('a', [info({ description: 'x'.repeat(LIMITS.text * 3) })])] };
    const text = readMeteoalarm(feed, FR).alerts[0].texts?.[0].description as string;
    expect([...text]).toHaveLength(LIMITS.text);
  });

  it('un message de test, d’exercice ou de brouillon n’est pas une alerte', () => {
    for (const status of ['Test', 'Exercise', 'Draft', 'System']) {
      const feed = { warnings: [warning('t', [info()], { status }), warning('ok', [info({ area: 'Ailleurs' })])] };
      expect(readMeteoalarm(feed, FR).alerts, status).toEqual([]);
    }
    const reel = { warnings: [warning('r', [info()])] };
    expect(readMeteoalarm(reel, FR).alerts).toHaveLength(1);
  });
});

describe('bornes de taille d’un flux', () => {
  it('trop de messages : les premiers sont lus, le flux est dit incomplet', () => {
    const many = Array.from({ length: LIMITS.warnings + 5 }, (_, i) => warning(`w${i}`, [info({ area: 'Ailleurs' })]));
    const digest = digestMeteoalarm({ warnings: many }, NOW)!;
    expect(digest.candidates).toHaveLength(LIMITS.warnings);
    expect(digest.dropped).toBe(true);
  });

  it('trop de langues dans un message, ou de zones dans une langue : ignorés au-delà, flux dit incomplet', () => {
    const langues = Array.from({ length: LIMITS.infosPerAlert + 3 }, (_, i) => info({ language: `fr-${i}` }));
    expect(digestMeteoalarm({ warnings: [warning('a', langues)] }, NOW)!.dropped).toBe(true);
    const zones = info();
    zones.area = Array.from({ length: LIMITS.areasPerInfo + 2 }, (_, i) => ({ areaDesc: `Zone ${i}` }));
    expect(digestMeteoalarm({ warnings: [warning('a', [zones])] }, NOW)!.dropped).toBe(true);
  });

  it('un nom de zone démesuré est borné', () => {
    const feed = { warnings: [warning('a', [info({ area: 'Z'.repeat(5000) })])] };
    const area = digestMeteoalarm(feed, NOW)!.candidates[0].blocks[0].areas[0].name;
    expect([...area].length).toBeLessThanOrEqual(LIMITS.areaName);
  });

  it('un contour démesuré est ignoré, jamais lu à moitié', () => {
    const point = '45.0,5.0 ';
    const enorme = point.repeat(Math.ceil(MAX_POLYGON_CHARS / point.length) + 10);
    expect(parsePolygon(enorme)).toBeNull();
    expect(parsePolygon('45.0,5.0 45.0,6.0 46.0,6.0 45.0,5.0')).not.toBeNull();
  });

  it('un corps qui n’a pas la forme d’un flux est refusé, sans exception', () => {
    for (const body of [null, 'texte', 12, [], { warnings: 'x' }, { warnings: { 0: 1 } }]) {
      expect(() => digestMeteoalarm(body, NOW)).not.toThrow();
      expect(digestMeteoalarm(body, NOW)).toBeNull();
    }
    // Des éléments de forme inattendue ne font pas tomber la lecture.
    const bizarre = { warnings: [null, 1, 'x', {}, { alert: null }, { alert: { sent: 12, info: 'x' } }, warning('ok', [info(), null, 7])] };
    expect(() => readMeteoalarm(bizarre, FR)).not.toThrow();
    expect(readMeteoalarm(bizarre, FR).alerts).toHaveLength(1);
  });
});

describe('un message illisible n’est jamais pris pour un lieu calme', () => {
  const lisible = warning('lisible', [info({ area: 'Ailleurs' })]);

  it('vigilance sans heure de fin (bulletins maritimes du DWD, 11 oct. 2026) : le flux ne prouve plus le calme, même en France', () => {
    const sansFin = warning('sans-fin', [info({ expires: null })]);
    const digest = digestMeteoalarm({ warnings: [lisible, sansFin] }, NOW)!;
    expect(digest.dropped).toBe(true);
    // France : sans ce message, « Rhône » absent du flux serait un département calme.
    expect(readDigest(digestMeteoalarm({ warnings: [lisible] }, NOW)!, FR)).toMatchObject({ alerts: [], knowledge: 'complete' });
    expect(readDigest(digest, FR)).toMatchObject({ alerts: [], knowledge: 'aucune' });
  });

  it('flux à contours : un message non lu empêche d’affirmer qu’il n’y a rien sur le lieu', () => {
    const carre = ['45.0,5.0 45.0,6.0 46.0,6.0 46.0,5.0 45.0,5.0'];
    const dehors = warning('c', [info({ area: 'Zone A', polygon: carre })]);
    const sansFin = warning('x', [info({ area: 'Zone B', polygon: carre, expires: null })]);
    const opts = { ...BASE, names: [], point: { lat: 10, lon: 10 }, feed: METEOALARM_FEEDS.ch };
    expect(readDigest(digestMeteoalarm({ warnings: [dehors] }, NOW)!, opts).knowledge).toBe('complete');
    expect(readDigest(digestMeteoalarm({ warnings: [dehors, sansFin] }, NOW)!, opts).knowledge).toBe('aucune');
  });

  it('les alertes trouvées restent montrées, la liste est dite partielle', () => {
    const sansFin = warning('x', [info({ area: 'Ailleurs', expires: null })]);
    const trouvee = warning('t', [info()]);
    const r = readDigest(digestMeteoalarm({ warnings: [sansFin, trouvee] }, NOW)!, FR);
    expect(r.alerts).toHaveLength(1);
    expect(r.knowledge).toBe('partielle');
  });

  it('niveau absent : message compté comme non lu ; niveau vert sans fenêtre lisible : rien à signaler, rien de perdu', () => {
    expect(digestMeteoalarm({ warnings: [lisible, warning('n', [info({ level: null })])] }, NOW)!.dropped).toBe(true);
    const vert = warning('v', [info({ level: '1; green; Minor', expires: null })]);
    expect(digestMeteoalarm({ warnings: [lisible, vert] }, NOW)!.dropped).toBe(false);
  });

  it('heure d’émission illisible : message compté comme non lu', () => {
    const sansHeure = { alert: { identifier: 's', msgType: 'Alert', status: 'Actual', sent: 'hier', info: [info()] } };
    expect(digestMeteoalarm({ warnings: [lisible, sansHeure] }, NOW)!.dropped).toBe(true);
  });
});

describe('texte officiel affiché comme du texte', () => {
  it('aucun HTML n’est interprété : les balises du flux sortent échappées', () => {
    const html = renderToStaticMarkup(
      <OfficialAlertTexts
        title="Vigilance orange · orages (Rhône)"
        texts={[
          {
            lang: 'fr-FR',
            headline: '<script>alert(1)</script>',
            description: '<img src=x onerror=alert(1)>',
            instruction: 'a | b',
          },
        ]}
      />
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    // Le Style Guide de Meteoalarm : un texte à barres verticales devient une liste.
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
  });

  it('une étiquette de langue invalide n’arrive pas dans l’attribut lang', () => {
    const html = renderToStaticMarkup(
      <OfficialAlertTexts texts={[{ lang: '"><script>', headline: 'Titre', description: null, instruction: null }]} />
    );
    expect(html).not.toContain('lang=');
    expect(html).not.toContain('<script');
  });

  it('sans texte à montrer, rien n’est affiché', () => {
    expect(renderToStaticMarkup(<OfficialAlertTexts texts={[]} />)).toBe('');
    expect(
      renderToStaticMarkup(<OfficialAlertTexts texts={[{ lang: 'fr', headline: null, description: null, instruction: null }]} />)
    ).toBe('');
  });
});
