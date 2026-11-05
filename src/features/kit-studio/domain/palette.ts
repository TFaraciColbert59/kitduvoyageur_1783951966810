// Couleurs brutes de la maquette : seul fichier du domaine autorisé à contenir de l'hexadécimal.
// <generated>
// généré par scripts/port-catalog.mjs : ne pas éditer ce bloc
export type MaterialKey = 'm-2d482a' | 'm-3d6038' | 'm-1e301c' | 'm-9bbda7' | 'm-789972' | 'm-96b391' | 'm-f0f5ee' | 'm-b5aba0' | 'm-d4ccc0' | 'm-5b554a' | 'm-1f4251' | 'm-2a5a6e' | 'm-10222b' | 'm-a8c8d4' | 'm-365233' | 'm-5b7f55' | 'm-4c7746' | 'm-3e6b7a' | 'm-b8ad8a' | 'm-c9c0a3' | 'm-17402c' | 'm-968c81' | 'm-2c3530' | 'm-7a7365' | 'm-b08a4e' | 'm-998f70' | 'm-7aaab8' | 'm-141916' | 'm-3f3b34' | 'm-e8e2d9' | 'm-a8443a' | 'm-c9a86a' | 'm-5a8a9a' | 'm-e4c695' | 'm-4b6b7c' | 'm-e8e6df';
export const RAW_MATERIALS: Readonly<Record<MaterialKey, string>> = {
  'm-2d482a': '#2D482A',
  'm-3d6038': '#3D6038',
  'm-1e301c': '#1E301C',
  'm-9bbda7': '#9BBDA7',
  'm-789972': '#789972',
  'm-96b391': '#96B391',
  'm-f0f5ee': '#F0F5EE',
  'm-b5aba0': '#B5ABA0',
  'm-d4ccc0': '#D4CCC0',
  'm-5b554a': '#5B554A',
  'm-1f4251': '#1F4251',
  'm-2a5a6e': '#2A5A6E',
  'm-10222b': '#10222B',
  'm-a8c8d4': '#A8C8D4',
  'm-365233': '#365233',
  'm-5b7f55': '#5B7F55',
  'm-4c7746': '#4C7746',
  'm-3e6b7a': '#3E6B7A',
  'm-b8ad8a': '#B8AD8A',
  'm-c9c0a3': '#C9C0A3',
  'm-17402c': '#17402C',
  'm-968c81': '#968C81',
  'm-2c3530': '#2C3530',
  'm-7a7365': '#7A7365',
  'm-b08a4e': '#B08A4E',
  'm-998f70': '#998F70',
  'm-7aaab8': '#7AAAB8',
  'm-141916': '#141916',
  'm-3f3b34': '#3F3B34',
  'm-e8e2d9': '#E8E2D9',
  'm-a8443a': '#A8443A',
  'm-c9a86a': '#C9A86A',
  'm-5a8a9a': '#5A8A9A',
  'm-e4c695': '#E4C695',
  'm-4b6b7c': '#4B6B7C',
  'm-e8e6df': '#E8E6DF',
};
// </generated>

import type { Colorway } from './catalog';

/**
 * Matière → token `--lkv-*` du dépôt dont la teinte correspond à ±3 % près (par canal).
 * Absentes : 'm-4b6b7c' et 'm-c9a86a' (aucune teinte proche dans tokens.css) → valeur brute.
 */
export const MATERIAL_TOKENS: Partial<Record<MaterialKey, string>> = {
  'm-2d482a': '--lkv-sage-800',
  'm-3d6038': '--lkv-sage-700',
  'm-1e301c': '--lkv-sage-900',
  'm-9bbda7': '--lkv-forest-200',
  'm-789972': '--lkv-sage-400',
  'm-96b391': '--lkv-sage-300',
  'm-f0f5ee': '--lkv-sage-50',
  'm-b5aba0': '--lkv-stone-400',
  'm-d4ccc0': '--lkv-stone-300',
  'm-5b554a': '--lkv-stone-700',
  'm-1f4251': '--lkv-sky-700',
  'm-2a5a6e': '--lkv-sky-600',
  'm-10222b': '--lkv-sky-900',
  'm-a8c8d4': '--lkv-sky-200',
  'm-365233': '--lkv-forest-600',
  'm-5b7f55': '--lkv-sage-500',
  'm-4c7746': '--lkv-sage-600',
  'm-3e6b7a': '--lkv-sky-500',
  'm-b8ad8a': '--lkv-sand-500',
  'm-c9c0a3': '--lkv-sand-400',
  'm-17402c': '--lkv-forest-900',
  'm-968c81': '--lkv-stone-500',
  'm-2c3530': '--lkv-ink-700',
  'm-7a7365': '--lkv-stone-600',
  'm-b08a4e': '--lkv-warm-700',
  'm-998f70': '--lkv-sand-600',
  'm-7aaab8': '--lkv-sky-300',
  'm-141916': '--lkv-ink-900',
  'm-3f3b34': '--lkv-stone-800',
  'm-e8e2d9': '--lkv-stone-200',
  'm-a8443a': '--lkv-brick-600',
  'm-5a8a9a': '--lkv-sky-400',
  'm-e4c695': '--lkv-warm-500',
  'm-e8e6df': '--lkv-stone-200', // écart 6/255
};

/** Résout une matière : token lu via `readVar` (injecté par l'UI) s'il est non vide, sinon valeur brute. */
export function resolveMaterial(key: MaterialKey, readVar?: (name: string) => string | undefined): string {
  const token = MATERIAL_TOKENS[key];
  if (token && readVar) {
    const v = readVar(token)?.trim();
    if (v) return v;
  }
  return RAW_MATERIALS[key];
}

export interface ColorwaySwatch { readonly body: string; readonly pocket: string; readonly trim: string; readonly accent: string }

/** Pastilles résolues d'un coloris. */
export function colorwaySwatch(cw: Colorway, readVar?: (name: string) => string | undefined): ColorwaySwatch {
  return {
    body: resolveMaterial(cw.body, readVar),
    pocket: resolveMaterial(cw.pocket, readVar),
    trim: resolveMaterial(cw.trim, readVar),
    accent: resolveMaterial(cw.accent, readVar),
  };
}
