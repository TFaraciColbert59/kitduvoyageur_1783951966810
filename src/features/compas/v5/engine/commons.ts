/**
 * Compas v5 : photos géolocalisées de Wikimedia Commons (fonctions pures).
 *
 * Une photo n'est montrée que si elle est prise AU lieu cherché (recherche géographique de Commons),
 * sous une licence qui autorise la réutilisation, avec son auteur et sa page. Sinon : `null`, jamais
 * une photo d'ailleurs. Ce module construit la requête et lit la réponse ; le réseau et le cache sont
 * dans `server/commons.ts`.
 */

import { distanceKm } from '../../engine/places';
import type { V5Photo } from '../types';

/** Rayon de recherche autour d'un lieu, en mètres (l'API accepte de 10 à 10 000). */
export const COMMONS_RADIUS_M = 1000;
/** Largeur demandée pour la vignette, en pixels. */
export const COMMONS_THUMB_PX = 480;
/** Photos lues par requête : assez pour trouver un cadrage correct, peu pour rester léger. */
export const COMMONS_LIMIT = 20;

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

export interface CommonsPoint {
  lat: number;
  lon: number;
}

/**
 * Requête de recherche géographique sur l'espace de noms « Fichier » (6), avec l'image réduite, ses
 * métadonnées de licence et ses coordonnées (pour choisir la plus proche). Les champs de licence sont
 * filtrés : la réponse reste courte.
 */
export function commonsGeosearchUrl(from: CommonsPoint, radiusM: number = COMMONS_RADIUS_M): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggscoord: `${from.lat.toFixed(5)}|${from.lon.toFixed(5)}`,
    ggsradius: String(Math.min(10_000, Math.max(10, Math.round(radiusM)))),
    ggslimit: String(COMMONS_LIMIT),
    ggsnamespace: '6',
    prop: 'imageinfo|coordinates',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: String(COMMONS_THUMB_PX),
    iiextmetadatafilter: 'Artist|LicenseShortName|License|Copyrighted',
    coprimary: 'primary',
    colimit: String(COMMONS_LIMIT),
  });
  return `${COMMONS_API}?${params.toString()}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Texte brut d'un champ HTML de Commons : balises retirées, entités lues, espaces réduits. */
export function plainText(html: unknown): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export type CommonsLicense = { name: string; attribution: boolean };

/**
 * Licences acceptées : domaine public, CC0, CC BY et CC BY-SA avec leur numéro de version (« CC BY-SA 4.0 »).
 * Refusées : NC, ND, GFDL seule, « Attribution » sans version, licences de réutilisation restreinte.
 * `attribution` : la licence exige de citer l'auteur (sans auteur lisible, la photo est écartée).
 */
export function acceptedLicense(shortName: unknown, licenseCode: unknown): CommonsLicense | null {
  const short = plainText(shortName);
  const code = plainText(licenseCode).toLowerCase();
  if (/^cc0\b/i.test(short) || code === 'cc0' || /^cc0-/.test(code)) return { name: 'CC0', attribution: false };
  if (/^(public domain|domaine public)\b/i.test(short) || code === 'pd' || /^pd-/.test(code))
    return { name: 'Domaine public', attribution: false };
  // « CC BY-SA 4.0 », « CC BY 2.0 », « CC BY-SA 3.0 de » (portage national : accepté, texte gardé).
  if (/^CC BY(-SA)? \d\.\d(?: (?!igo$)[a-z]{2,3})?$/.test(short)) return { name: short, attribution: true };
  return null;
}

const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FILE_EXT = /\.(jpe?g|png|webp)$/i;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function hostIs(url: unknown, host: string): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === host;
  } catch {
    return false;
  }
}

function meta(info: Record<string, unknown>, field: string): unknown {
  const ext = info.extmetadata;
  if (!ext || typeof ext !== 'object') return undefined;
  const entry = (ext as Record<string, unknown>)[field];
  return entry && typeof entry === 'object' ? (entry as Record<string, unknown>).value : undefined;
}

interface Candidate {
  photo: V5Photo;
  /** Distance au lieu cherché (m), null quand Commons ne donne pas la position du fichier. */
  distanceM: number | null;
  /** Ordre de la réponse (Commons classe par distance). */
  order: number;
  good: boolean;
}

/** Les pages de la réponse : liste (formatversion 2) ou objet indexé par identifiant (version 1). */
function pagesOf(json: unknown): Array<Record<string, unknown>> {
  const pages = (json as { query?: { pages?: unknown } } | null)?.query?.pages;
  const list = Array.isArray(pages) ? pages : pages && typeof pages === 'object' ? Object.values(pages) : [];
  return list.filter((p): p is Record<string, unknown> => !!p && typeof p === 'object');
}

/** Distance de repère entre deux plages de distance : un écart de moins de 300 m ne départage pas. */
const NEAR_BUCKET_M = 300;

/**
 * La photo à montrer pour un lieu, ou `null`. Parmi les fichiers jpg, png ou webp sous licence
 * acceptée et avec un auteur lisible, la plus proche l'emporte par tranches de 300 m ; à tranche égale,
 * le format paysage d'au moins 600 px de large passe devant ; à égalité, la plus proche.
 */
export function parseCommonsGeosearch(json: unknown, from: CommonsPoint): V5Photo | null {
  const candidates: Candidate[] = [];
  pagesOf(json).forEach((page, order) => {
    const infoList = page.imageinfo;
    const info = Array.isArray(infoList) ? infoList[0] : null;
    if (!info || typeof info !== 'object') return;
    const i = info as Record<string, unknown>;
    const title = typeof page.title === 'string' ? page.title : '';
    if (!FILE_EXT.test(title) || typeof i.mime !== 'string' || !MIMES.has(i.mime)) return;
    // Seuls les hôtes de Wikimedia : la vignette, puis la page du fichier.
    if (!hostIs(i.thumburl, 'upload.wikimedia.org') || !hostIs(i.descriptionurl, 'commons.wikimedia.org')) return;
    const license = acceptedLicense(meta(i, 'LicenseShortName'), meta(i, 'License'));
    if (!license) return;
    const artist = plainText(meta(i, 'Artist')).slice(0, 120);
    if (license.attribution && !artist) return;
    const width = num(i.width);
    const height = num(i.height);
    const coords = Array.isArray(page.coordinates) ? (page.coordinates[0] as Record<string, unknown> | undefined) : undefined;
    const lat = num(coords?.lat);
    const lon = num(coords?.lon);
    candidates.push({
      photo: { url: i.thumburl, credit: artist || 'Auteur non indiqué', license: license.name, pageUrl: i.descriptionurl },
      distanceM: lat != null && lon != null ? Math.round(distanceKm(from, { lat, lon }) * 1000) : null,
      order,
      good: width != null && height != null && width >= 600 && width > height,
    });
  });
  if (!candidates.length) return null;
  const bucket = (c: Candidate) => (c.distanceM == null ? Number.MAX_SAFE_INTEGER : Math.floor(c.distanceM / NEAR_BUCKET_M));
  candidates.sort(
    (a, b) =>
      bucket(a) - bucket(b) ||
      Number(b.good) - Number(a.good) ||
      (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) ||
      a.order - b.order
  );
  return candidates[0].photo;
}
