// Calcul pur des écritures serveur à partir de deux états du studio.
// Utilisé par la sauvegarde différée (600 ms) : on ne pousse que ce qui a changé, jamais l'état
// complet. Les écritures sont décrites en gestes du contrat `spec/data-model.md`.
import { RAW_MATERIALS } from './palette';
import type { ConfigSet, MaterialKey } from './catalog';
import { currentConfig, currentKit } from './state';
import type { KitState } from './types';

export type StudioWrite =
  | {
      readonly kind: 'bagConfig';
      readonly corpsId: string;
      readonly modules: readonly string[];
      readonly colors: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: 'placement';
      readonly itemId: string;
      readonly zone: string | null;
      readonly slot: string | null;
      readonly loadOrder: number | null;
    }
  | {
      readonly kind: 'preorder';
      readonly items: readonly { readonly pieceId: string; readonly colorwayId: string }[];
    };

/** Matières à pousser : les clés de matière de la maquette sont converties en hexadécimal. */
function hexOf(col: MaterialKey | undefined): string | undefined {
  if (!col) return undefined;
  return RAW_MATERIALS[col];
}

/** Modules actifs déduits d'une configuration d'apparence (inverse de `parts.modOn`). */
export function modulesOf(cfg: ConfigSet): string[] {
  const mods: string[] = [];
  if (cfg.lid.shape !== 'none') mods.push('lid');
  if (cfg.front.shape !== 'none') mods.push('front');
  if (cfg.sides.shape !== 'none') mods.push('sides');
  if (cfg.hip.shape === 'wide') mods.push('hipp');
  if (cfg.acc.includes('axe')) mods.push('tool');
  if (cfg.acc.includes('sbottle')) mods.push('flask');
  return mods;
}

/** Couleurs d'une configuration, au format `one_bag_configs.colors`. */
export function colorsOf(cfg: ConfigSet): Record<string, string> {
  const out: Record<string, string> = {};
  const push = (key: string, col: MaterialKey | undefined): void => {
    const hex = hexOf(col);
    if (hex) out[key] = hex;
  };
  push('body', cfg.body.col);
  push('lid', cfg.lid.col);
  push('front', cfg.front.col);
  push('sides', cfg.sides.col);
  push('hip', cfg.hip.col);
  push('harness', cfg.harness.col);
  push('webbing', cfg.webbing.col);
  push('accent', cfg.accent);
  return out;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Placements courants : id d'objet → { zone, index, slot }. */
function placements(s: KitState): Map<string, { zone: string; index: number; slot: string | null }> {
  const k = currentKit(s);
  const out = new Map<string, { zone: string; index: number; slot: string | null }>();
  for (const zone of Object.keys(k.packed)) {
    const ids = k.packed[zone as keyof typeof k.packed] ?? [];
    ids.forEach((id, index) => {
      out.set(id, { zone, index, slot: k.slots?.[id] ?? null });
    });
  }
  return out;
}

/**
 * Diffère deux états et renvoie les écritures serveur à appliquer dans l'ordre.
 * Aucune écriture si rien n'a changé (le règlement différé est regroupé).
 */
export function diffStudioWrites(prev: KitState, next: KitState): readonly StudioWrite[] {
  const writes: StudioWrite[] = [];

  // Un changement de kit n'est PAS une modification de contenu : diffuser les placements d'un
  // kit vers l'autre écrirait les objets du kit A dans le kit B. Seule la précommande (compte)
  // est indépendante du kit courant.
  const kitChanged = prev.kitId !== next.kitId;
  if (!kitChanged) {
    // 1) Configuration d'apparence du kit courant (corps, modules, couleurs).
    const prevKit = currentKit(prev);
    const nextKit = currentKit(next);
    const prevCfg = currentConfig(prev);
    const nextCfg = currentConfig(next);
    if (prevKit.bag !== nextKit.bag || !same(prevCfg, nextCfg)) {
      writes.push({
        kind: 'bagConfig',
        corpsId: `corps:${nextKit.bag}`,
        modules: modulesOf(nextCfg),
        colors: colorsOf(nextCfg),
      });
    }

    // 2) Placements : zone, emplacement fin et ordre de chargement.
    const before = placements(prev);
    const after = placements(next);
    for (const [itemId, p] of after) {
      const old = before.get(itemId);
      if (!old || old.zone !== p.zone || old.index !== p.index || old.slot !== p.slot) {
        writes.push({
          kind: 'placement',
          itemId,
          zone: p.zone,
          slot: p.slot,
          loadOrder: p.index,
        });
      }
    }
    for (const [itemId] of before) {
      if (!after.has(itemId)) {
        writes.push({ kind: 'placement', itemId, zone: null, slot: null, loadOrder: null });
      }
    }
  }

  // 3) Précommandes : seules les pièces nouvellement commandées sont envoyées.
  const preorder = Object.entries(next.order)
    .filter(([pieceId, cw]) => prev.order[pieceId as keyof typeof prev.order] !== cw)
    .map(([pieceId, colorwayId]) => ({ pieceId, colorwayId: String(colorwayId) }));
  if (preorder.length > 0) writes.push({ kind: 'preorder', items: preorder });

  return writes;
}
