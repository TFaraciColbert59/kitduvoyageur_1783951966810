import { UserEquipmentItem } from '@/hooks/useEquipment';
import { GearItemData } from '@/lib/mock/mon-materiel-marceline';

/**
 * Adaptateur universel pour convertir un UserEquipmentItem (donnée réelle DB / state)
 * en GearItemData (format consommé par les composants de l'inventaire).
 */
export function adaptUserEquipmentToGearItemData(item: UserEquipmentItem): GearItemData {
  return {
    id: item.id,
    name: item.name,
    brand: item.brand || undefined,
    model: item.model || undefined,
    category: item.category || 'autre',
    condition: item.condition || 'excellent',
    weight: (item.weight_g || 0) / 1000,
    weight_g: item.weight_g || 0,
    count: item.quantity || 1,
    quantity: item.quantity || 1,
    is_rented: Boolean(item.loan_status && item.loan_status !== 'disponible'),
    purchase_date: item.purchase_date || item.acquired_at || undefined,
    purchase_price: item.purchase_price ?? undefined,
    image: item.image || undefined,
    alt: item.name,
    notes: item.notes || undefined,
    is_favorite: item.is_favorite || false,
    loan_status: (item.loan_status === 'prêté' || item.loan_to_name ? 'prêté' : 'disponible') as 'prêté' | 'disponible',
    loan_to_name: item.loan_to_name || undefined,
    is_listed_for_sale: item.is_listed_for_sale || false,
    wear_percentage: item.wear_percentage ?? (item.condition === 'usé' ? 70 : item.condition === 'bon' ? 30 : 10),
    size_label: item.size_label || undefined,
    materials: item.materials || undefined,
    sole_type: item.sole_type || undefined,
    waterproof_rating: item.waterproof_rating || undefined,
    ref_code: item.serial_number || item.ref_code || undefined,
    description: item.notes || undefined,
    sorties_count: item.usage_count || 0,
  };
}

/**
 * Détection des alertes d'anticipation et de maintenance
 */
export interface GearAnticipationAlerts {
  hasMaintenanceDue: boolean;
  isMaintenanceApproaching: boolean;
  maintenanceLabel?: string;
  hasExpired: boolean;
  isExpiringSoon: boolean;
  expirationLabel?: string;
  isLent: boolean;
  lentToName?: string;
  needsWearCheck: boolean;
  wearLabel?: string;
  totalAlertsCount: number;
}

export function evaluateGearAlerts(item: UserEquipmentItem): GearAnticipationAlerts {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  let hasMaintenanceDue = false;
  let isMaintenanceApproaching = false;
  let maintenanceLabel: string | undefined;

  if (item.next_maintenance_date) {
    const maintDate = new Date(item.next_maintenance_date);
    if (maintDate < now) {
      hasMaintenanceDue = true;
      maintenanceLabel = 'Entretien dépassé';
    } else if (maintDate <= thirtyDaysFromNow) {
      isMaintenanceApproaching = true;
      maintenanceLabel = 'Entretien à prévoir';
    }
  }

  let hasExpired = false;
  let isExpiringSoon = false;
  let expirationLabel: string | undefined;

  if (item.expiry_date) {
    const expDate = new Date(item.expiry_date);
    if (expDate < now) {
      hasExpired = true;
      expirationLabel = 'Expiré (à remplacer)';
    } else if (expDate <= thirtyDaysFromNow) {
      isExpiringSoon = true;
      expirationLabel = 'Expiration proche';
    }
  }

  const isLent = Boolean(
    (item.loan_status && item.loan_status.toLowerCase().includes('prêt')) ||
    (item.loan_to_name && item.loan_to_name.trim().length > 0)
  );
  const lentToName = item.loan_to_name || undefined;

  const needsWearCheck =
    item.condition === 'à_réparer' ||
    item.condition === 'à_remplacer' ||
    item.condition === 'usé' ||
    (item.usage_count !== undefined && item.usage_count > 50);

  let wearLabel: string | undefined;
  if (item.condition === 'à_réparer') wearLabel = 'À réparer';
  else if (item.condition === 'à_remplacer') wearLabel = 'À remplacer';
  else if (item.condition === 'usé') wearLabel = 'Usure avancée';
  else if (item.usage_count && item.usage_count > 50) wearLabel = 'Vérifier état';

  let totalAlertsCount = 0;
  if (hasMaintenanceDue || isMaintenanceApproaching) totalAlertsCount++;
  if (hasExpired || isExpiringSoon) totalAlertsCount++;
  if (isLent) totalAlertsCount++;
  if (needsWearCheck) totalAlertsCount++;

  return {
    hasMaintenanceDue,
    isMaintenanceApproaching,
    maintenanceLabel,
    hasExpired,
    isExpiringSoon,
    expirationLabel,
    isLent,
    lentToName,
    needsWearCheck,
    wearLabel,
    totalAlertsCount,
  };
}
