'use client';

import { COMMANDS, POLES, type CommandDef } from '@/lib/catalog';
import type { PoleCode, Role } from '@/lib/rpc';
import { supabaseBrowser } from '@/lib/supabase/browser';

export type CatalogCommand = {
  id: string;
  command: string;
  label: string;
  pole: PoleCode;
  roleMin: Role;
  needsValidation: boolean;
  reasonRequired: boolean;
  undoable: boolean;
  agent: 'propose' | 'read' | 'never';
  realtime: string;
  domain: string;
};

export const POLE_LABELS: Record<string, string> = Object.fromEntries(POLES.map((p) => [p.code, p.label]));

function fromRegistry(def: CommandDef): CatalogCommand {
  return {
    id: def.id,
    command: def.command,
    label: def.label,
    pole: def.pole,
    roleMin: def.roleMin,
    needsValidation: def.needsValidation,
    reasonRequired: def.reasonRequired,
    undoable: def.undoable,
    agent: def.agent,
    realtime: def.realtime,
    domain: def.domain
  };
}

export const LOCAL_CATALOG: CatalogCommand[] = COMMANDS.map(fromRegistry);

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
