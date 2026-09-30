/**
 * Chantier configurateur (P0) — l'inventaire réel devient une entrée du sac.
 *
 * Module PUR. Il traduit les lignes `product_ownership` de l'utilisateur en
 * éléments de kit que le moteur contextuel sait comparer à ses règles, et il
 * sépare explicitement quatre états : possédé, disponible, adapté, préparé.
 *
 * Règles non négociables :
 * - un objet prêté (`is_lent`) n'est PAS disponible ;
 * - un objet `a_remplacer` ou `pour_pieces` n'est PAS considéré adapté ;
 * - une maintenance échue à la date de départ rend l'objet « à vérifier » ;
 * - un poids absent reste `null`, jamais 0 ;
 * - rien n'est « préparé » : posséder n'est pas emballer.
 */
import type { TripItem } from '@/features/trips/types/trip.types';

/** Sous-ensemble lu de `product_ownership` (RLS : propriétaire uniquement). */
export interface OwnedGearRow {
  id: string;
  name: string;
  category: string | null;
  weight_g: number | null;
  condition: string | null;
  is_lent: boolean;
  maintenance_due_at: string | null;
  expiry_date: string | null;
  quantity?: number | null;
}

export type OwnedGearAvailability =
  | 'disponible'
  | 'prete'
  | 'hors_service'
  | 'a_verifier';

export interface OwnedGearAssessment {
  id: string;
  name: string;
  availability: OwnedGearAvailability;
  /** Raison lisible, toujours présente sauf pour `disponible`. */
  reason: string | null;
}

const OUT_OF_SERVICE = new Set(['a_remplacer', 'pour_pieces']);

/** ISO `YYYY-MM-DD` ou ISO complet → `YYYY-MM-DD`, sinon null. */
function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

/**
 * Évalue un objet possédé pour une date de départ donnée.
 * `departureDay` absent : les échéances ne peuvent pas être jugées, l'objet
 * reste disponible mais l'échéance est signalée si elle existe.
 */
export function assessOwnedGear(
  row: OwnedGearRow,
  departureDay: string | null
): OwnedGearAssessment {
  if (row.is_lent) {
    return { id: row.id, name: row.name, availability: 'prete', reason: 'Objet actuellement prêté' };
  }
  if (row.condition && OUT_OF_SERVICE.has(row.condition)) {
    return {
      id: row.id,
      name: row.name,
      availability: 'hors_service',
      reason: row.condition === 'a_remplacer' ? 'Marqué « à remplacer »' : 'Marqué « pour pièces »',
    };
  }
  const departure = isoDay(departureDay);
  const maintenance = isoDay(row.maintenance_due_at);
  const expiry = isoDay(row.expiry_date);
  if (departure && expiry && expiry <= departure) {
    return { id: row.id, name: row.name, availability: 'a_verifier', reason: `Périmé le ${expiry}` };
  }
  if (departure && maintenance && maintenance <= departure) {
    return {
      id: row.id,
      name: row.name,
      availability: 'a_verifier',
      reason: `Entretien prévu le ${maintenance}`,
    };
  }
  return { id: row.id, name: row.name, availability: 'disponible', reason: null };
}

/**
 * Objets réellement utilisables par le moteur de kit, au format `TripItem`.
 * Seuls les objets `disponible` y figurent : un objet « à vérifier » ne doit
 * pas faire disparaître silencieusement un besoin vital.
 */
export function inventoryToKitItems(
  rows: readonly OwnedGearRow[],
  departureDay: string | null,
  nowIso: string = new Date(0).toISOString()
): TripItem[] {
  return rows
    .filter((row) => assessOwnedGear(row, departureDay).availability === 'disponible')
    .map((row) => ({
      id: `inv-${row.id}`,
      trip_id: 'adventure-plan',
      item_name: row.name,
      category: row.category,
      quantity: Math.max(1, Math.trunc(row.quantity ?? 1)),
      weight_grams: typeof row.weight_g === 'number' && row.weight_g > 0 ? row.weight_g : null,
      is_packed: false,
      // `needed` : possédé et disponible, pas encore préparé (jamais `packed`).
      status: 'needed',
      packed_by: null,
      inventory_item_id: row.id,
      affiliate_link_id: null,
      source: 'inventory',
      ownership: 'personal',
      condition: (row.condition as TripItem['condition']) ?? null,
      // Éléments virtuels (non persistés) : horodatage déterministe injecté.
      created_at: nowIso,
      updated_at: nowIso,
    }));
}

/** Résumé chiffré pour les warnings : jamais de PII, seulement des comptes. */
export function summarizeInventory(
  rows: readonly OwnedGearRow[],
  departureDay: string | null
): Record<OwnedGearAvailability, number> {
  const summary: Record<OwnedGearAvailability, number> = {
    disponible: 0,
    prete: 0,
    hors_service: 0,
    a_verifier: 0,
  };
  for (const row of rows) summary[assessOwnedGear(row, departureDay).availability] += 1;
  return summary;
}
