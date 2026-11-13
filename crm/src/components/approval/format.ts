import type { RequestDetail } from '../../lib/rpc';

/**
 * Montant porté par le libellé de la demande (« Remboursement de 89,90 € — … »).
 * Le libellé est la valeur lue par l'humain qui valide ; `amount_cents` reste le
 * champ structuré de repli. Les deux doivent coïncider : tout écart est un défaut
 * de données à corriger à la source, jamais à masquer ici.
 */
export function amountFromText(text: string): number | null {
  const match = text.match(/(\d[\d\s.\u00a0]*)[,.](\d{2})\s*€/);
  if (!match) return null;
  const units = Number(match[1].replace(/[^\d]/g, ''));
  const cents = Number(match[2]);
  if (!Number.isFinite(units) || !Number.isFinite(cents)) return null;
  return units * 100 + cents;
}

/** Montant demandé, en centimes, tel qu'affiché et comparé à la saisie. */
export function requestedCents(request: RequestDetail): number | null {
  return amountFromText(request.label) ?? request.amount_cents;
}

/** « 89,90 € » → 8990. Tolère espaces (dont insécables), « € » et virgule. */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00a0€]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Code de confirmation du contrat serveur : 8 premiers caractères hexadécimaux. */
export function fingerprintCode(fingerprint: string | null | undefined): string | null {
  if (!fingerprint) return null;
  const hex = fingerprint.replace(/^sha256:/i, '').trim();
  const match = hex.match(/^[0-9a-f]{8}/i);
  return match ? match[0].toLowerCase() : null;
}

/** « aujourd’hui 21:42 », « hier 09:10 », sinon « 7 nov. 2026, 21:42 ». */
export function stampFr(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'non renseigné';
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay) return `aujourd’hui ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `hier ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

/** Libellé lisible d'un motif : les codes connus, sinon le code humanisé. */
const REASON_LABEL: Record<string, string> = {
  produit_defectueux: 'Produit défectueux'
};

export function reasonLabel(code: string | null | undefined): string {
  if (!code) return 'non renseigné';
  const known = REASON_LABEL[code];
  if (known) return known;
  const words = code.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
