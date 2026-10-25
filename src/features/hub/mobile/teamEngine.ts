/**
 * Moteur mobile de l'équipe (sortie) — fonctions pures, testables sans DOM.
 * Initiales, libellés de rôles, charge du chien et dates d'arrivée.
 */

export type TeamMemberRole = 'owner' | 'editor' | 'viewer';
export type CarnetRole = 'guide' | 'medic' | 'member';

const TEAM_ROLE_LABELS: Record<TeamMemberRole, string> = {
  owner: 'Organisateur',
  editor: 'Éditeur',
  viewer: 'Lecteur',
};

const CARNET_ROLE_LABELS: Record<CarnetRole, string> = {
  guide: 'Guide',
  medic: 'Secouriste',
  member: 'Équipier',
};

/** Initiales d'un nom (2 max) ; jamais vide. */
export function personInitials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'V';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function teamRoleLabel(role: TeamMemberRole): string {
  return TEAM_ROLE_LABELS[role] ?? role;
}

export function carnetRoleLabel(role: CarnetRole): string {
  return CARNET_ROLE_LABELS[role] ?? role;
}

export interface DogLoadInput {
  isCarryingPack: boolean;
  packWeightKg: number;
  maxCarryingCapacityKg: number;
}

export interface DogLoadView {
  pct: number;
  over: boolean;
  label: string;
}

/** Charge du sac de bât : pourcentage borné, surcharge, libellé prêt à afficher. */
export function dogLoadView(dog: DogLoadInput): DogLoadView {
  const pack = Number(dog.packWeightKg) || 0;
  const max = Number(dog.maxCarryingCapacityKg) || 0;
  const over = dog.isCarryingPack && pack > max;
  const pct = dog.isCarryingPack && max > 0 ? Math.round((pack / max) * 100) : 0;
  return {
    pct,
    over,
    label: dog.isCarryingPack ? `${pack} kg (${pct}%)` : 'Non équipé',
  };
}

/** Date d'arrivée courte fr-FR (« Rejoint le 9 sept. ») ; vide si invalide. */
export function formatJoinDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `Rejoint le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
