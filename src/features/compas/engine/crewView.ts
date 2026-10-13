/**
 * Compas · Nous : ce que l'écran dit de chaque membre, EN LECTURE (fonctions pures).
 *
 * Niveau, présence, rôle et charge portée viennent du modèle réel du voyage. Une valeur absente est
 * dite absente (« non renseigné »), jamais un zéro ni une valeur de remplissage. La gestion du groupe
 * (inviter, retirer, changer un rôle) reste au Hub (`/hub/groupe`) : ce module ne décrit que ce qui se
 * lit.
 */
import type { CompasMemberLoad } from './compasModel';
import { isPopulationDefault } from './crew';
import { formatKg } from './format';
import type { CompasPendingInvite } from './team';

/** Page du Hub qui gère le groupe : invitations, rôles, retraits. Le Compas y renvoie. */
export const HUB_GROUP_PATH = '/hub/groupe';

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Organisateur',
  editor: 'Peut modifier',
  viewer: 'Lecture seule',
  member: 'Membre du groupe',
};

/** Niveau d'expérience (`trip_member_profiles.experience_level`) dit en mots. */
export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'débutant',
  intermediate: 'intermédiaire',
  advanced: 'confirmé',
  expert: 'expert',
};

export type LoadTone = 'good' | 'warn' | 'bad' | undefined;

export interface MemberLoadView {
  /** Poids porté, ex. « 9,2 kg ». */
  carried: string;
  /** Capacité en kg, ex. « 14 kg » ; null quand elle n'est pas renseignée. */
  limit: string | null;
  /** « repère moyen » quand la limite est une moyenne de population, pas une donnée de la personne. */
  limitNote: string | null;
  /** Rapport charge / capacité en pourcentage entier, null sans capacité. */
  pct: number | null;
  /** Largeur de la barre (0 à 100), null sans capacité : pas de barre. */
  barPct: number | null;
  tone: LoadTone;
  /** La phrase complète, pour la lecture d'écran et l'affichage. */
  text: string;
}

export interface MemberView {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** Rôle dans le voyage, dit en mots (« Organisateur », « Lecture seule »…). */
  role: string;
  /** Niveau (« confirmé »), null s'il n'est pas renseigné. */
  level: string | null;
  /** Le niveau vient de l'orientation que la personne a déclarée : « estimé ». */
  levelNote: string | null;
  /** Allure à plat dite (« 4,6 km/h »), null si elle n'est pas renseignée. */
  pace: string | null;
  /** « mesurée » quand l'allure vient des sorties de la personne. */
  paceNote: string | null;
  /** Présence dans le voyage : la personne a rejoint (les invitations en attente sont à part). */
  presence: 'present';
  load: MemberLoadView;
}

const kmh = (v: number) => `${String(v).replace('.', ',')} km/h`;
const kgText = (kg: number) => `${String(Math.round(kg * 10) / 10).replace('.', ',')} kg`;

export function loadView(
  m: Pick<CompasMemberLoad, 'carriedGrams' | 'capacityKg' | 'ratio' | 'profileSources'>
): MemberLoadView {
  const carried = formatKg(m.carriedGrams);
  const hasLimit = m.capacityKg != null && m.capacityKg > 0;
  const limit = hasLimit ? kgText(m.capacityKg as number) : null;
  // Toute capacité issue du profil du voyage est un repère de population (20 % d'un poids moyen) :
  // jamais la limite propre de la personne.
  const estimated =
    hasLimit &&
    (isPopulationDefault(m.profileSources, 'maxCarryKg') ||
      m.profileSources?.maxCarryKg === 'estimated');
  const pct = m.ratio == null ? null : Math.round(m.ratio * 100);
  const tone: LoadTone = pct == null ? undefined : pct > 100 ? 'bad' : pct > 90 ? 'warn' : 'good';
  const limitNote = estimated ? 'repère moyen' : null;
  const text = hasLimit
    ? `porte ${carried} sur ${limit}${limitNote ? ` (${limitNote})` : ''}`
    : `porte ${carried} · capacité non renseignée`;
  return {
    carried,
    limit,
    limitNote,
    pct,
    barPct: pct == null ? null : Math.min(100, Math.max(0, pct)),
    tone,
    text,
  };
}

export function memberView(m: CompasMemberLoad, ownerId: string): MemberView {
  const level = m.experienceLevel ? (LEVEL_LABEL[m.experienceLevel] ?? m.experienceLevel) : null;
  const pace = m.flatSpeedKmh != null && m.flatSpeedKmh > 0 ? kmh(m.flatSpeedKmh) : null;
  return {
    userId: m.userId,
    name: m.name,
    avatarUrl: m.avatarUrl,
    role: m.userId === ownerId ? ROLE_LABEL.owner : (ROLE_LABEL[m.role ?? ''] ?? 'Membre'),
    level,
    levelNote: level && m.profileSources?.experienceLevel === 'estimated' ? 'estimé' : null,
    pace,
    paceNote: pace && m.profileSources?.flatSpeedKmH === 'learned' ? 'mesurée' : null,
    presence: 'present',
    load: loadView(m),
  };
}

export function memberViews(loads: readonly CompasMemberLoad[], ownerId: string): MemberView[] {
  return loads.map((m) => memberView(m, ownerId));
}

export interface PendingView {
  id: string;
  name: string;
  /** « Invité · peut modifier » : la personne n'a pas encore répondu. */
  text: string;
}

export function pendingViews(invites: readonly CompasPendingInvite[]): PendingView[] {
  return invites.map((inv) => ({
    id: inv.id,
    name: inv.name,
    text: `Invitation en attente · ${ROLE_LABEL[inv.role].toLowerCase()}`,
  }));
}

/** Combien de membres n'ont ni niveau ni allure renseignés : l'écran le dit une fois, pas ligne à ligne. */
export function unknownProfiles(views: readonly MemberView[]): { level: number; pace: number } {
  return {
    level: views.filter((v) => v.level == null).length,
    pace: views.filter((v) => v.pace == null).length,
  };
}

/**
 * Capacités de portage : propres à la personne (`declared`), repère moyen de population
 * (`estimated`), ou absentes (`unknown`). Seules les premières sont « renseignées ».
 */
export function capacityCounts(
  loads: ReadonlyArray<Pick<CompasMemberLoad, 'capacityKg' | 'profileSources'>>
): { declared: number; estimated: number; unknown: number } {
  let declared = 0;
  let estimated = 0;
  let unknown = 0;
  for (const m of loads) {
    if (m.capacityKg == null || !(m.capacityKg > 0)) unknown += 1;
    else if (
      isPopulationDefault(m.profileSources, 'maxCarryKg') ||
      m.profileSources?.maxCarryKg === 'estimated'
    )
      estimated += 1;
    else declared += 1;
  }
  return { declared, estimated, unknown };
}
