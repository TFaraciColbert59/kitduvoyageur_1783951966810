/**
 * LKDV — Mon Matériel storage versioning & migration
 *
 * La migration est exécutée UNE SEULE FOIS au montage de l'application via
 * `useMonMaterielMigration` (voir `src/hooks/useMonMaterielMigration.ts`).
 * Cette fonction doit rester pure côté données : aucune écriture destructive
 * au-delà des clés explicitement obsolètes, et chaque étape est isolée dans un
 * try/catch pour qu'une erreur sur une clé ne bloque jamais les autres.
 */

export const MON_MATERIEL_STORAGE_VERSION = 'v3';

/** Ordre par défaut des 6 cartes du cockpit v3 (validé lors des migrations widget). */
const DEFAULT_WIDGET_ORDER = ['forget', 'alerts', 'kits', 'departure', 'inventory', 'availability'];

const VERSION_KEY = 'lkdv_mon_materiel_storage_version';

/** @internal — exposé pour les tests */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @internal — exposé pour les tests */
export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota / privé — on ignore
  }
}

/** @internal — exposé pour les tests */
export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** @internal — normalise l'ordre des widgets : valide, sinon ordre par défaut. */
export function normalizeWidgetOrder(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_WIDGET_ORDER.length &&
      DEFAULT_WIDGET_ORDER.every((id) => parsed.includes(id))
    ) {
      // Nettoie tout identifiant étranger (ex. ancien « copilot ») sans casser l'ordre utilisateur.
      return parsed.filter((id: unknown) => DEFAULT_WIDGET_ORDER.includes(id as string));
    }
  } catch {
    // JSON malformé → on retournera null (ordre par défaut)
  }
  return null;
}

/** @internal — normalise l'état coché de la checklist en tableau de strings. */
export function normalizeForgetChecked(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    return null;
  }
  return null;
}

/** @internal — normalise l'équipement invité : garantit des articles bien formés. */
function normalizeEquipmentList(parsed: unknown): unknown[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      ...item,
      // Colonnes introduites en v3 conservées si présentes, sinon valeurs sûres.
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      is_favorite: !!item.is_favorite,
      loan_status: item.loan_status || 'disponible',
      migratedAt: new Date().toISOString(),
      version: MON_MATERIEL_STORAGE_VERSION,
    }));
}

/** Clés durablement obsolètes (layouts v1, filtres v1, files v1/v2 migrées). */
const OBSOLETE_KEYS: string[] = [
  'lkdv_mon_materiel_layout_v1',
  'lkdv_mon_materiel_layout_v2',
  'lkdv_inventory_filters_v1',
  'lkdv_inventory_filters_v2',
  'lkdv_cockpit_widget_order_v1',
  'lkdv_cockpit_widget_order_v2',
  'lkdv_mon_materiel_equipment_v1',
  'lkdv_mon_materiel_equipment_v2',
];

/** Migration vers v3 : transforms + nettoyage. Idempotente et isolée par clé. */
export function migrateMonMaterielStorage(): void {
  if (typeof window === 'undefined') return;

  const storedVersion = safeGet(VERSION_KEY);
  if (storedVersion === MON_MATERIEL_STORAGE_VERSION) return;

  const log = (msg: string) => {
    if (process.env.NODE_ENV !== 'production') console.info(`[Storage] ${msg}`);
  };

  log(`migration mon-materiel ${storedVersion ?? 'aucune'} → ${MON_MATERIEL_STORAGE_VERSION}`);

  // ── 1. Équipement invité v1/v2 → forme v3 ─────────────────────────────────
  for (const legacyKey of ['lkdv_mon_materiel_equipment_v1', 'lkdv_mon_materiel_equipment_v2']) {
    try {
      const raw = safeGet(legacyKey);
      if (!raw) continue;
      const normalized = normalizeEquipmentList(JSON.parse(raw));
      if (normalized.length === 0) continue;
      safeSet('lkdv_guest_equipment', JSON.stringify(normalized));
      log(`${legacyKey} → lkdv_guest_equipment (${normalized.length} articles normalisés)`);
    } catch (err) {
      console.warn(`[Storage] Migration ignorée ${legacyKey}:`, err);
    }
  }

  // ── 2. Ordre des widgets : valide l'existant, réinitialise si obsolète ────
  try {
    const widgetOrder = normalizeWidgetOrder(safeGet('lkdv_cockpit_widget_order'));
    if (widgetOrder) {
      safeSet('lkdv_cockpit_widget_order', JSON.stringify(widgetOrder));
    } else {
      // Exemple : anciens ids (weight, condition, copilot…) vs nouvelles cartes v3.
      safeRemove('lkdv_cockpit_widget_order');
      safeSet('lkdv_cockpit_widget_order', JSON.stringify(DEFAULT_WIDGET_ORDER));
      log('ordre des widgets réinitialisé aux 6 cartes v3');
    }
  } catch (err) {
    console.warn('[Storage] Migration widget order ignorée:', err);
  }

  // ── 3. Checklist « À ne pas oublier » : normalisation ─────────────────────
  try {
    const checked = normalizeForgetChecked(safeGet('lkdv_forget_checked'));
    if (checked) {
      safeSet('lkdv_forget_checked', JSON.stringify(checked));
    }
  } catch (err) {
    console.warn('[Storage] Migration forget_checked ignorée:', err);
  }

  // ── 4. Nettoyage des clés obsolètes ───────────────────────────────────────
  for (const key of OBSOLETE_KEYS) {
    try {
      if (safeGet(key) !== null) {
        safeRemove(key);
        log(`clé obsolète supprimée : ${key}`);
      }
    } catch {
      // ignore
    }
  }

  // ── 5. Marqueur de version ────────────────────────────────────────────────
  safeSet(VERSION_KEY, MON_MATERIEL_STORAGE_VERSION);
  log(`migration mon-materiel terminée → ${MON_MATERIEL_STORAGE_VERSION}`);
}

/** Nettoyage ciblé déclenchable à la demande (ex. « ↺ Réinitialiser la disposition »). */
export function resetMonMaterielLayout(): void {
  if (typeof window === 'undefined') return;
  safeRemove('lkdv_cockpit_widget_order');
  safeSet('lkdv_cockpit_widget_order', JSON.stringify(DEFAULT_WIDGET_ORDER));
  safeSet(VERSION_KEY, MON_MATERIEL_STORAGE_VERSION);
}