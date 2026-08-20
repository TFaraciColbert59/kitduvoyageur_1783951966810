'use client';

/**
 * LKDV — Mon Matériel : service exports.
 * Génération de CSV côté client (checklist de départ, inventaire) sans dépendance
 * externe, plus traçabilité Supabase (tables inventory_exports / kit_export_logs,
 * migrations M8/M9). Aucun mock : les lignes proviennent des données réelles.
 */

import { createClient } from '@/lib/supabase/client';
import type { UserEquipmentItem } from '@/hooks/useEquipment';
import type { DepartureChecklistItem } from '../domain/departure-readiness';
import { formatWeight } from '../domain/gear-format';

export interface ExportResult {
  ok: boolean;
  fileName?: string;
  error?: string;
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join('\r\n');
}

function downloadBlob(fileName: string, content: string, mime = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export class ExportService {
  private supabase = createClient();

  /** Export CSV de la checklist de préparation. */
  exportChecklistCsv(
    checklist: DepartureChecklistItem[],
    checkedIds: Set<string>,
    hikeName?: string
  ): ExportResult {
    if (checklist.length === 0) {
      return { ok: false, error: 'Checklist vide — rien à exporter.' };
    }
    const rows = checklist.map((c) => [
      checkedIds.has(c.id) ? 'X' : '',
      c.label,
      c.category,
      c.level,
      c.source,
      c.reason,
    ]);
    const csv = toCsv(
      ['Cocher', 'Élément', 'Catégorie', 'Niveau', 'Source', 'Raison'],
      rows
    );
    const fileBase = (hikeName || 'preparation').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fileName = `lkdv-checklist-${fileBase}.csv`;
    downloadBlob(fileName, csv);
    return { ok: true, fileName };
  }

  /** Export CSV de l'inventaire complet. */
  exportInventoryCsv(equipment: UserEquipmentItem[]): ExportResult {
    if (equipment.length === 0) {
      return { ok: false, error: 'Inventaire vide — rien à exporter.' };
    }
    const rows = equipment.map((e) => [
      e.name,
      e.brand || '',
      e.category || '',
      e.quantity || 1,
      formatWeight((e.weight_g || 0) * (e.quantity || 1)),
      e.purchase_price != null ? `${Number(e.purchase_price).toFixed(2)}` : '',
      e.condition || '',
      e.is_favorite ? 'Oui' : 'Non',
      e.loan_status === 'prêté' || e.loan_to_name ? `Prêté à ${e.loan_to_name || ''}` : 'Disponible',
      e.serial_number || '',
      e.notes || '',
    ]);
    const csv = toCsv(
      ['Nom', 'Marque', 'Catégorie', 'Qté', 'Poids', 'Prix (€)', 'État', 'Favori', 'Disponibilité', 'N° série', 'Notes'],
      rows
    );
    const fileName = `lkdv-inventaire-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadBlob(fileName, csv);
    return { ok: true, fileName };
  }

  /** Trace l'export d'inventaire (table inventory_exports — M8, best-effort). */
  async logInventoryExport(userId: string, type: 'csv' | 'pdf' = 'csv'): Promise<void> {
    if (!userId) return;
    const { error } = await this.supabase.from('inventory_exports').insert({
      user_id: userId,
      type,
    });
    if (error) console.warn('[ExportService] logInventoryExport:', error.message);
  }

  /** Trace l'export de kit (table kit_export_logs — M9, best-effort). */
  async logKitExport(userId: string, kitId: string, format: 'pdf' | 'ics' | 'csv' = 'pdf'): Promise<void> {
    if (!userId || !kitId) return;
    const { error } = await this.supabase.from('kit_export_logs').insert({
      user_id: userId,
      kit_id: kitId,
      format,
    });
    if (error) console.warn('[ExportService] logKitExport:', error.message);
  }
}