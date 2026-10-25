/**
 * Compas v5 · tiroir Nous : tout ce que l'écran calcule pour se présenter (fonctions PURES, sans React).
 *
 * Les membres, rôles, allures et niveaux viennent du modèle (`model.crew`) ; ici on les ordonne et on dit d'où
 * ils viennent. Règles tenues :
 * - une valeur absente est absente (`null`) : l'écran dit « non renseigné », jamais un zéro ni un défaut ;
 * - une moyenne de population (`profileSources.<champ> === 'average'`) n'est jamais présentée comme celle de la
 *   personne (le modèle l'a déjà retirée ; on la retire encore ici si une entrée la laisse passer) ;
 * - les sorties des autres membres ne sont pas lues : on n'expose que ce que le profil de voyage dit ;
 * - le texte d'itinéraire à partager est fabriqué ICI, sur l'appareil, à partir du voyage : rien n'est stocké ni
 *   envoyé par nos serveurs.
 */
import type { CompasKitLine, CompasMemberLoad, CompasModel } from '../../engine/compasModel';
import type { CompasPendingInvite } from '../../engine/team';
import { emergencyFor } from '../../offline/snapshot';
import { formatDate, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import type { CompasT } from '../../components/compasTypes';

/* ---------- Solo ou avec d'autres ---------- */

/** Plafond de la taille du groupe (le schéma serveur de `compasSetPartySizeAction`). */
export const MAX_PARTY = 50;
/** « Avec d'autres » : au moins deux personnes. */
export const MIN_GROUP = 2;

export type NousMode = 'solo' | 'group';

export type SwitchPlan =
  | { ok: true; partySize: number }
  | { ok: false; reason: 'othersInTrip' };

/**
 * Taille à écrire pour passer d'un mode à l'autre.
 * - vers le groupe : au moins 2, et au moins les membres déjà présents plus les invitations en attente ;
 * - vers le solo : 1, sauf si d'autres membres sont dans le voyage (on ne les efface pas : il faut les retirer
 *   d'abord depuis la gestion du groupe).
 */
export function planSwitch(target: NousMode, members: number, pending: number): SwitchPlan {
  if (target === 'solo') return members > 1 ? { ok: false, reason: 'othersInTrip' } : { ok: true, partySize: 1 };
  return { ok: true, partySize: Math.min(MAX_PARTY, Math.max(MIN_GROUP, members + Math.max(0, pending))) };
}

/** Bornes du stepper de la taille du groupe : jamais sous le nombre de membres présents, jamais sous 2. */
export function partyBounds(members: number): { min: number; max: number } {
  return { min: Math.max(MIN_GROUP, members), max: MAX_PARTY };
}

/* ---------- Membres ---------- */

export type RoleKey = 'owner' | 'editor' | 'viewer' | 'member';
export type LevelKey = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'regular' | 'seasoned';

const LEVELS: Record<string, LevelKey> = {
  beginner: 'beginner',
  debut: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  expert: 'expert',
  regulier: 'regular',
  aguerri: 'seasoned',
};

export type Provenance = 'learned' | 'estimated' | null;

const provenanceOf = (sources: Record<string, string> | null | undefined, field: string): Provenance => {
  const v = sources?.[field];
  return v === 'learned' || v === 'estimated' ? v : null;
};

export interface MemberFacts {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isYou: boolean;
  role: RoleKey;
  /** Niveau : sa clé (traduite par l'écran) ou le texte brut s'il n'est pas reconnu ; null : non renseigné. */
  level: { key: LevelKey | null; raw: string; provenance: Provenance } | null;
  /** Allure à plat en km/h, avec sa provenance ; null : non renseignée. */
  pace: { kmh: number; provenance: Provenance } | null;
  /** Cette personne donne l'allure retenue (la plus lente des allures connues). */
  setsPace: boolean;
}

const roleKey = (m: CompasMemberLoad, ownerId: string): RoleKey => {
  if (m.userId === ownerId) return 'owner';
  return m.role === 'editor' || m.role === 'viewer' ? m.role : 'member';
};

export function memberFacts(model: CompasModel, viewerId: string | null): MemberFacts[] {
  const slowest = model.crew.pace.slowest;
  const several = model.crew.loads.length > 1;
  return model.crew.loads.map((m): MemberFacts => {
    const averagePace = m.profileSources?.flatSpeedKmH === 'average';
    const averageLevel = m.profileSources?.experienceLevel === 'average';
    const raw = m.experienceLevel?.trim() ?? '';
    return {
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
      isYou: viewerId != null && m.userId === viewerId,
      role: roleKey(m, model.ownerId),
      level:
        raw && !averageLevel
          ? { key: LEVELS[raw.toLowerCase()] ?? null, raw, provenance: provenanceOf(m.profileSources, 'experienceLevel') }
          : null,
      pace:
        m.flatSpeedKmh != null && m.flatSpeedKmh > 0 && !averagePace
          ? { kmh: m.flatSpeedKmh, provenance: provenanceOf(m.profileSources, 'flatSpeedKmH') }
          : null,
      setsPace: several && slowest != null && slowest.userId === m.userId,
    };
  });
}

export type PaceHeld =
  | { kind: 'none' }
  | { kind: 'held'; name: string; kmh: number; known: number; total: number };

/** « Allure retenue » : celle du plus lent parmi les allures connues (`model.crew.pace`). */
export function paceHeld(pace: CompasModel['crew']['pace']): PaceHeld {
  if (!pace.slowest) return { kind: 'none' };
  return { kind: 'held', name: pace.slowest.name, kmh: pace.slowest.speedKmh, known: pace.known, total: pace.total };
}

/* ---------- Invitations ---------- */

export interface PendingFacts {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'editor' | 'viewer';
}

export function pendingFacts(invites: readonly CompasPendingInvite[]): PendingFacts[] {
  return invites.map((i) => ({ id: i.id, name: i.name, avatarUrl: i.avatarUrl, role: i.role }));
}

/* ---------- Matériel commun ---------- */

export interface GearShare {
  userId: string;
  name: string;
  items: string[];
  grams: number;
  /** Au moins un objet porté n'a pas de poids : le total est partiel. */
  partial: boolean;
}

export interface GearSummary {
  shares: GearShare[];
  unassigned: CompasKitLine[];
  /** Objets communs (portés ou non). */
  sharedCount: number;
}

const weightOf = (l: CompasKitLine): number | null => (l.weightGrams == null ? null : l.weightGrams * l.quantity);

export function gearSummary(model: CompasModel): GearSummary {
  const byId = new Map(model.kit.lines.map((l) => [l.id, l]));
  const shares = model.crew.loads.map((m): GearShare => {
    const lines = m.sharedItemIds.map((id) => byId.get(id)).filter((l): l is CompasKitLine => !!l);
    return {
      userId: m.userId,
      name: m.name,
      items: lines.map((l) => l.name),
      grams: lines.reduce((sum, l) => sum + (weightOf(l) ?? 0), 0),
      partial: lines.some((l) => weightOf(l) == null),
    };
  });
  const carried = shares.reduce((n, s) => n + s.items.length, 0);
  return { shares, unassigned: model.crew.unassignedShared, sharedCount: carried + model.crew.unassignedShared.length };
}

/* ---------- Numéros de secours ---------- */

export type EmergencyUse = 'all' | 'police' | 'fireRescue';

export interface EmergencyView {
  /** `eu` : le 112 ; `national` : numéros du pays ; `fallback` : pays inconnu, le 112 seul. */
  source: 'eu' | 'national' | 'fallback';
  numbers: Array<{ number: string; use: EmergencyUse }>;
}

const useOf = (text: string): EmergencyUse => {
  const t = text.trim().toLowerCase();
  if (t === 'police') return 'police';
  if (t === 'pompiers et secours') return 'fireRescue';
  return 'all';
};

/**
 * Numéros de secours du pays de destination, depuis la table déjà établie du Compas (`emergencyFor`). Pays
 * inconnu ou sans numéro établi : le 112 seul, dit comme tel.
 */
export function emergencyView(countryCode: string | null): EmergencyView {
  const found = emergencyFor(countryCode);
  if (!found) return { source: 'fallback', numbers: [{ number: '112', use: 'all' }] };
  const eu = found.numbers.length === 1 && found.numbers[0].number === '112';
  return { source: eu ? 'eu' : 'national', numbers: found.numbers.map((n) => ({ number: n.number, use: useOf(n.use) })) };
}

/* ---------- Texte d'itinéraire à partager ---------- */

export const RETURN_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Heure de retour saisie (« 18:30 ») ou null ; une valeur mal formée est ignorée, jamais devinée. */
export function cleanReturnTime(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  return RETURN_TIME.test(v) ? v : null;
}

const day = (iso: string, locale: Locale) =>
  formatDate(new Date(`${iso.slice(0, 10)}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }, locale) ||
  iso;

export interface ShareDraft {
  subject: string;
  body: string;
}

const key = (suffix: string) => `compas.v5.nous.${suffix}` as TranslationKey;

/** Il y a un itinéraire à partager : au moins un jour de marche. */
export const hasRoute = (model: CompasModel): boolean => model.route.dayPlans.length > 0;

/**
 * Message pour prévenir un proche : voyage, dates, jours (titre, distance, montée, nuit notée), retour prévu et
 * numéros de secours. Fabriqué côté client, à partir du voyage seul ; aucune coordonnée GPS n'y figure.
 */
export function buildShare(input: {
  model: CompasModel;
  countryCode: string | null;
  returnTime: string | null;
  t: CompasT;
  locale: Locale;
}): ShareDraft {
  const { model, t, locale } = input;
  const num = (n: number) => formatNumber(n, { maximumFractionDigits: 1 }, locale);
  const { start, end } = model.dates;
  const lines: string[] = [t(key('share.intro'), { title: model.title })];
  if (start && end && end !== start) lines.push(t(key('share.dates'), { start: day(start, locale), end: day(end, locale) }));
  else if (start) lines.push(t(key('share.date'), { start: day(start, locale) }));
  lines.push('');
  for (const d of model.route.dayPlans) {
    const head = d.date
      ? t(key('share.day'), { day: d.day, date: day(d.date, locale), title: d.title })
      : t(key('share.dayNoDate'), { day: d.day, title: d.title });
    const facts = [
      d.distanceKm != null ? t(key('share.km'), { km: num(d.distanceKm) }) : null,
      d.gainM != null && d.gainM > 0 ? t(key('share.gain'), { gain: num(d.gainM) }) : null,
      d.stay ? t(key('share.stay'), { stay: d.stay }) : null,
    ].filter(Boolean);
    lines.push(facts.length ? `${head} · ${facts.join(' · ')}` : head);
  }
  lines.push('');
  const back = end ?? start;
  if (back && input.returnTime) lines.push(t(key('share.returnAt'), { date: day(back, locale), time: input.returnTime }));
  else if (back) lines.push(t(key('share.returnOn'), { date: day(back, locale) }));
  else if (input.returnTime) lines.push(t(key('share.returnTime'), { time: input.returnTime }));
  const emergency = emergencyView(input.countryCode);
  lines.push(
    emergency.source === 'fallback'
      ? t(key('share.emergencyUnknown'))
      : t(key('share.emergency'), { numbers: emergency.numbers.map((n) => n.number).join(', ') })
  );
  lines.push('', t(key('share.footer')));
  return { subject: t(key('share.subject'), { title: model.title }), body: lines.join('\n') };
}

/** Longueur au-delà de laquelle un lien `mailto:` n'est plus fiable selon les messageries. */
export const MAILTO_MAX = 1900;

/** Lien `mailto:` du message, ou null s'il serait trop long (on propose alors la copie). */
export function mailtoHref(draft: ShareDraft): string | null {
  const href = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  return href.length <= MAILTO_MAX ? href : null;
}
