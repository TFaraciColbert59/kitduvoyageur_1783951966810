import {
  checkDocumentExpiry,
  type DocumentExpiryStatus,
} from '@/features/trips/engine/exportEngine';

/**
 * Moteur mobile Documents (sortie) — pur.
 * Réutilise le moteur d'expiration canonique (règle des 6 mois) et ordonne
 * les documents par urgence : expiré > à renouveler > valide > sans échéance.
 */

export type DocsStatus = DocumentExpiryStatus;

export interface DocsInput {
  id: string;
  title: string;
  category?: string | null;
  expires_at: string | null;
  file_url?: string | null;
  notes?: string | null;
}

export interface DocsRow extends DocsInput {
  status: DocsStatus;
  daysRemaining: number | null;
  label: string;
}

export interface DocsView {
  rows: DocsRow[];
  expired: number;
  warning: number;
  valid: number;
  none: number;
  total: number;
}

const STATUS_WEIGHT: Record<DocsStatus, number> = {
  expired: 0,
  warning: 1,
  valid: 2,
  none: 3,
};

export function buildDocsView(docs: DocsInput[], referenceDate: Date = new Date()): DocsView {
  const rows: DocsRow[] = docs.map((doc) => {
    const check = checkDocumentExpiry(doc, referenceDate);
    return {
      ...doc,
      status: check.status,
      daysRemaining: check.daysRemaining,
      label: check.label,
    };
  });

  rows.sort((a, b) => {
    const weight = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    if (weight !== 0) return weight;
    if (a.daysRemaining !== null && b.daysRemaining !== null && a.daysRemaining !== b.daysRemaining) {
      return a.daysRemaining - b.daysRemaining;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    rows,
    expired: rows.filter((row) => row.status === 'expired').length,
    warning: rows.filter((row) => row.status === 'warning').length,
    valid: rows.filter((row) => row.status === 'valid').length,
    none: rows.filter((row) => row.status === 'none').length,
    total: rows.length,
  };
}
