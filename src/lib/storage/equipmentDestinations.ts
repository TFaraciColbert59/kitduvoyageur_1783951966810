/**
 * LKDV — Mon Matériel : destinations mémorisées pour le flux « Ajouter à l'équipement ».
 * Quand un utilisateur ajoute au panier un produit NON possédé (Cas C), on mémorise
 * la destination voulue (kit, checklist, départ, raison) sous une clé stable. À la
 * réception confirmée, la destination est lue puis effacée.
 */

import type { GearDestination } from '@/features/mon-materiel/types';

const DESTINATIONS_KEY = 'lkdv_equipment_destinations';

interface DestinationsStore {
  [productIdOrSlug: string]: GearDestination;
}

function readStore(): DestinationsStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DESTINATIONS_KEY);
    return raw ? (JSON.parse(raw) as DestinationsStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: DestinationsStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(store));
  } catch {
    // quota / privé — la destination est perdue sans casse fonctionnelle
  }
}

export function getEquipmentDestination(productIdOrSlug: string): GearDestination | undefined {
  return readStore()[productIdOrSlug];
}

export function setEquipmentDestination(
  productIdOrSlug: string,
  destination: GearDestination
): void {
  const store = readStore();
  store[productIdOrSlug] = destination;
  writeStore(store);
}

export function clearEquipmentDestination(productIdOrSlug: string): void {
  const store = readStore();
  if (productIdOrSlug in store) {
    delete store[productIdOrSlug];
    writeStore(store);
  }
}

export function listEquipmentDestinations(): DestinationsStore {
  return readStore();
}