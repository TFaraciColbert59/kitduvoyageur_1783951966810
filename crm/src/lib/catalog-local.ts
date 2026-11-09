/**
 * Catalogue local, utilisable côté serveur ET côté client.
 * (Un module `'use client'` importé par un Server Component ne livre pas ses valeurs :
 * d'où ce module neutre, seule source de `LOCAL_CATALOG` et `POLE_LABELS`.)
 */
import { COMMANDS, POLES, type CommandDef } from './catalog';
import type { PoleCode, Role } from './rpc';

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

export function commandDefinition(command: string): CatalogCommand | undefined {
  return LOCAL_CATALOG.find((candidate) => candidate.command === command);
}
