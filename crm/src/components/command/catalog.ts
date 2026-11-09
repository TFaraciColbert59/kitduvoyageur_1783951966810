'use client';

import { supabaseBrowser } from '../../lib/supabase/browser';
import type { PoleCode, Role } from '../../lib/rpc';
import {
  LOCAL_CATALOG as LOCAL_CATALOG_VALUE,
  POLE_LABELS as POLE_LABELS_VALUE,
  commandDefinition,
  type CatalogCommand
} from '../../lib/catalog-local';

export type { CatalogCommand };
export const POLE_LABELS = POLE_LABELS_VALUE;
export const LOCAL_CATALOG = LOCAL_CATALOG_VALUE;
export { commandDefinition };

type CatalogRow = {
  id: string;
  command: string;
  label: string;
  pole: string;
  roleMin: string;
  needsValidation: boolean;
  reasonRequired: boolean;
  undoable: boolean;
  agent: string;
  realtime: string;
  domain?: string;
};

/**
 * Catalogue des actions autorisées. Source : `admin.commands_catalog()` (registre en
 * base). Si la base ne répond pas, on retombe sur le registre généré
 * (`src/lib/catalog.ts`) — même contenu, aucune action inventée.
 */
export async function loadCatalog(): Promise<{ commands: CatalogCommand[]; source: 'base' | 'registre' }> {
  try {
    const client = supabaseBrowser();
    const { data, error } = await client.schema('admin').rpc('commands_catalog' as never, {} as never);
    if (!error && data) {
      const payload = data as { commands?: CatalogRow[] };
      const rows = payload.commands ?? [];
      if (rows.length > 0) {
        return {
          source: 'base',
          commands: rows.map((row) => ({
            id: row.id,
            command: row.command,
            label: row.label,
            pole: row.pole as PoleCode,
            roleMin: row.roleMin as Role,
            needsValidation: Boolean(row.needsValidation),
            reasonRequired: Boolean(row.reasonRequired),
            undoable: Boolean(row.undoable),
            agent: (row.agent as 'propose' | 'read' | 'never') ?? 'never',
            realtime: row.realtime ?? 'P3',
            domain: row.domain ?? ''
          }))
        };
      }
    }
  } catch {
    /* base indisponible : registre généré */
  }
  return { source: 'registre', commands: LOCAL_CATALOG };
}

/** Normalise pour la recherche (accents, casse, tirets). */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
}

export function matches(command: CatalogCommand, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = normalize(`${command.label} ${command.command} ${command.id} ${POLE_LABELS[command.pole] ?? ''} ${command.domain}`);
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(normalize(word)));
}

/** Libellé affichable : le registre porte parfois du balisage Markdown (`**…**`). */
export function displayLabel(label: string): string {
  return label.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
}

export type CommandVisual = { glyph: string; bg: string; fg: string };

/** Tuiles sémantiques de la maquette : € commerce, ! confiance, CV membre, ≡ commande… */
const POLE_VISUALS: Record<string, CommandVisual> = {
  CONF: { glyph: '!', bg: 'var(--lkv-warning-bg)', fg: 'var(--lkv-warning-dark)' },
  MEMB: { glyph: 'M', bg: 'var(--lkv-sage-100)', fg: 'var(--lkv-sage-800)' },
  COMM: { glyph: '€', bg: 'var(--lkv-action-soft)', fg: 'var(--lkv-primary)' },
  CONT: { glyph: 'C', bg: 'var(--lkv-info-bg)', fg: 'var(--lkv-text-primary)' },
  PRIA: { glyph: 'IA', bg: 'var(--lkv-surface-muted)', fg: 'var(--lkv-text-secondary)' },
  CROI: { glyph: '↗', bg: 'var(--lkv-success-bg)', fg: 'var(--lkv-text-primary)' },
  TECH: { glyph: 'T', bg: 'var(--lkv-surface-muted)', fg: 'var(--lkv-text-secondary)' }
};

const ORDER_VISUAL: CommandVisual = {
  glyph: '≡',
  bg: 'var(--lkv-surface-muted)',
  fg: 'var(--lkv-text-secondary)'
};

export function commandVisual(command: CatalogCommand): CommandVisual {
  if (command.domain === 'D11') return ORDER_VISUAL;
  return POLE_VISUALS[command.pole] ?? POLE_VISUALS.TECH;
}
