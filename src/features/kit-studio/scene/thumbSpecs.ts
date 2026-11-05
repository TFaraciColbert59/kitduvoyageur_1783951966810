// Clés de cache et descriptions des vignettes, construites depuis le catalogue (maquette l.1255-1256 et l.1267, 1673-1675).
// Les clés portent des noms de matériau (stables, sans couleur littérale) ; la description porte la couleur résolue
// par domain/palette.ts. Si les tokens changent (thème), appeler engine.revokeAll() pour refaire les vignettes.
import { BAGS } from '../domain/catalog';
import type { BagId, Colorway, MaterialKey, Swatch } from '../domain/catalog';
import { resolveMaterial } from '../domain/palette';
import type { BagThumbSpec, BallThumbSpec, ItemThumbSpec, ThumbSpec } from './thumbnails';

export type ReadVar = (name: string) => string | undefined;

export interface ThumbRef<S extends ThumbSpec = ThumbSpec> {
  readonly key: string;
  readonly spec: S;
}

/** Ce que la vignette d'un objet exige de l'entrée du catalogue (Item, Alternative, Ghost enrichi d'une couleur). */
export interface ThumbItemLike {
  readonly id: string;
  readonly sh: string;
  readonly gl: string;
  readonly color: MaterialKey;
  readonly L?: number;
}

/** Échelle d'un sac miniature : reste dans la zone objet (SPEC-3D). */
export const bagThumbScale = (liters: number): number => Math.min(0.8, (0.8 * liters) / 42);
/** Échelle des préréglages sans volume propre. */
export const PRESET_THUMB_SCALE = 0.8;

/** `i:<id>:<forme>:<couleur>` (suffixe `:plan` pour un objet prévu mais pas encore possédé). */
export function itemThumb(it: ThumbItemLike, readVar?: ReadVar, planned = false): ThumbRef<ItemThumbSpec> {
  const key = `i:${it.id}:${it.sh}:${it.color}${planned ? ':plan' : ''}`;
  return {
    key,
    spec: { kind: 'i', id: it.id, shape: it.sh, glyph: it.gl, color: resolveMaterial(it.color, readVar), liters: it.L ?? 0, planned },
  };
}

interface BagColors { readonly body: MaterialKey; readonly pocket: MaterialKey; readonly trim: MaterialKey }

/** `b:<sac>:<corps>:<poche>:<liseré>` ; `bag` null = préréglage (échelle fixe). */
export function bagThumb(bag: BagId | null, colors: BagColors, readVar?: ReadVar): ThumbRef<BagThumbSpec> {
  const scale = bag === null ? PRESET_THUMB_SCALE : bagThumbScale(BAGS[bag].L);
  return {
    key: `b:${bag ?? 'preset'}:${colors.body}:${colors.pocket}:${colors.trim}`,
    spec: {
      kind: 'b',
      body: resolveMaterial(colors.body, readVar),
      pocket: resolveMaterial(colors.pocket, readVar),
      trim: resolveMaterial(colors.trim, readVar),
      scale,
    },
  };
}

/** Sac miniature d'un coloris du catalogue. */
export const colorwayThumb = (cw: Colorway, bag: BagId | null = null, readVar?: ReadVar): ThumbRef<BagThumbSpec> => bagThumb(bag, cw, readVar);

/** `c:<couleur>` : boule de couleur. */
export function ballThumb(color: MaterialKey, readVar?: ReadVar): ThumbRef<BallThumbSpec> {
  return { key: `c:${color}`, spec: { kind: 'c', color: resolveMaterial(color, readVar) } };
}

/** Pastille de la palette (SWATCHES : [nom, matériau]). */
export const swatchThumb = (sw: Swatch, readVar?: ReadVar): ThumbRef<BallThumbSpec> => ballThumb(sw[1], readVar);
