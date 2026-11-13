import type { HealthConsentScope } from '@/features/sensors';

export interface HealthScopeView {
  scope: HealthConsentScope;
  label: string;
  description: string;
  group: 'read' | 'write';
  conditional: boolean;
}

/**
 * Libellés d'écran des scopes P01. Les règles d'autorisation restent dans
 * `src/features/sensors/consentP01` ; ce tableau ne sert qu'à l'affichage.
 */
export const HEALTH_SCOPE_VIEWS: readonly HealthScopeView[] = [
  {
    scope: 'workouts_read',
    label: 'Lire les séances',
    description: 'Importer les séances réalisées dans Santé.',
    group: 'read',
    conditional: false,
  },
  {
    scope: 'heart_rate_read',
    label: 'Lire la fréquence cardiaque',
    description: 'Lire les mesures cardiaques associées aux séances.',
    group: 'read',
    conditional: false,
  },
  {
    scope: 'cadence_read',
    label: 'Lire la cadence',
    description: 'Lire la cadence de course ou de pédalage.',
    group: 'read',
    conditional: false,
  },
  {
    scope: 'power_read',
    label: 'Lire la puissance',
    description: 'Lire la puissance mesurée par un capteur.',
    group: 'read',
    conditional: false,
  },
  {
    scope: 'distance_read',
    label: 'Lire la distance',
    description: 'Lire la distance enregistrée par Santé.',
    group: 'read',
    conditional: false,
  },
  {
    scope: 'workouts_write',
    label: 'Écrire les séances',
    description: 'Enregistrer une séance LKDV dans Santé.',
    group: 'write',
    conditional: false,
  },
  {
    scope: 'heart_rate_write',
    label: 'Écrire la fréquence cardiaque',
    description: 'Ajouter les mesures cardiaques d’une séance.',
    group: 'write',
    conditional: true,
  },
  {
    scope: 'calories_write',
    label: 'Écrire les calories',
    description: 'Ajouter les calories actives d’une séance.',
    group: 'write',
    conditional: true,
  },
];

export const READ_SCOPE_VIEWS = HEALTH_SCOPE_VIEWS.filter((view) => view.group === 'read');
export const WRITE_SCOPE_VIEWS = HEALTH_SCOPE_VIEWS.filter((view) => view.group === 'write');

export function scopeLabel(scope: HealthConsentScope): string {
  return HEALTH_SCOPE_VIEWS.find((view) => view.scope === scope)?.label ?? scope;
}

export function joinScopeLabels(scopes: readonly HealthConsentScope[]): string {
  return scopes.map(scopeLabel).join(', ');
}
