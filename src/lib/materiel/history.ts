/** Libellés humains pour les actions d'historique de kit — testable, sans I/O. */

const LABELS: Record<string, string> = {
  created: 'Création',
  updated: 'Mise à jour',
  deleted: 'Suppression',
  restored: 'Restauré',
  forked: 'Fork',
  optimized: 'Optimisé',
  compared: 'Comparé',
};

const TONES: Record<string, 'sage' | 'info' | 'warn' | 'danger' | 'stone'> = {
  created: 'sage',
  updated: 'info',
  deleted: 'danger',
  restored: 'warn',
  forked: 'stone',
  optimized: 'sage',
  compared: 'stone',
};

export function historyLabel(action: string): string {
  return LABELS[action] ?? action;
}

export function historyTone(action: string): 'sage' | 'info' | 'warn' | 'danger' | 'stone' {
  return TONES[action] ?? 'stone';
}