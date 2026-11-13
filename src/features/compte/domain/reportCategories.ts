/**
 * Motifs de signalement d'un profil ou d'un contenu relationnel.
 *
 * Ce catalogue est partagé par l'écran (`ReportBlockModal`) et la route
 * serveur : le client n'envoie qu'un identifiant fermé, le serveur choisit le
 * libellé et la sévérité réellement enregistrés. Aucun texte libre ne devient
 * un motif de modération.
 */

export type ReportSeverity = 'grave' | 'normal';

export interface ReportCategory {
  id: string;
  label: string;
  severity: ReportSeverity;
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  { id: 'harassment', label: 'Comportement inapproprié / Harcèlement', severity: 'grave' },
  { id: 'sexual', label: 'Contenu à caractère sexuel non sollicité', severity: 'grave' },
  { id: 'scam', label: 'Arnaque financière suspectée', severity: 'grave' },
  { id: 'threat', label: 'Menace ou mise en danger', severity: 'grave' },
  { id: 'fake_profile', label: 'Profil suspect ou faux', severity: 'normal' },
  { id: 'other', label: 'Autre motif', severity: 'normal' },
] as const;

/** Résout un identifiant reçu du client ; `null` si le motif est inconnu. */
export function findReportCategory(id: unknown): ReportCategory | null {
  if (typeof id !== 'string') return null;
  const normalized = id.trim();
  if (!normalized) return null;
  return REPORT_CATEGORIES.find((category) => category.id === normalized) ?? null;
}
