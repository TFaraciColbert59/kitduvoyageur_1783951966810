// Modèles de cartes (purs) : objets d'une zone (maquette v2 l.1258-1264) et options d'apparence (l.1639-1650).
import { BAGS, MODULE_IDS } from '../../domain/catalog';
import type { ColorwayId, ConfigSet, Item, MaterialKey, ModuleId, PartNameId, ZoneId } from '../../domain/catalog';
import { canAddModule, ptsUsed } from '../../domain/attach';
import { formatEuro, formatLitres, formatWeight } from '../../domain/format';
import { modOn } from '../../domain/parts';
import { studioData } from '../../domain/studioData';
import { candidates } from '../../domain/packing';
import { currentConfig, currentKit } from '../../domain/state';
import { effG, toCents } from '../../domain/totals';
import type { ExtraItem, KitState } from '../../domain/types';
import { bagThumb, colorwayThumb, itemThumb, moduleThumb, swatchThumb } from '../../scene/thumbSpecs';
import type { ReadVar, ThumbRef } from '../../scene/thumbSpecs';
import { S, tileLabel } from '../strings';
import { glbModelForBag } from '../../scene/bag/modelLayer';
import { AVAILABLE_3D_MODULE_MANIFESTS } from '../../scene/bag/moduleLoader';
import {
  calculateModuleOverflowNotice,
  filterCompatibleModulesForBag,
  LKDV_ONE_BAG_BBOXES,
} from '../../domain/bagAnchorsTable';
import { getScene } from '../../scene/sceneRef';
import { hasItemModel } from '../../scene/itemAssets';

export type OptionCat = 'shape' | 'mod' | 'col';
export type CardKind = 'item' | 'bag' | 'opt' | 'add';

export interface CardModel {
  readonly id: string;
  readonly kind: CardKind;
  readonly name: string;
  readonly sub: string;
  readonly label: string;
  readonly thumb: ThumbRef | null;
  /** Pictogramme de repli (nom de glyphe). */
  readonly glyph: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  /** Raison de l'indisponibilité (jamais affichée en toast). */
  readonly why?: string;
  /** Mention explicite de débordement pour les modules porteurs. */
  readonly overflowNotice?: string;
  readonly zones?: readonly ZoneId[];
}

/** Catégories d'options d'une pièce (maquette catsFor, l.1627). */
export function catsFor(part: PartNameId): readonly OptionCat[] {
  if (part === 'all') return ['shape', 'mod', 'col'];
  if (part === 'body') return ['shape', 'col'];
  if (part === 'webbing') return ['col'];
  return ['mod', 'col'];
}

/** Rôle de couleur d'une pièce dans un coloris (maquette mutate, l.1658). */
export const COLOR_ROLE: Readonly<Record<Exclude<PartNameId, 'all'>, 'body' | 'pocket' | 'trim'>> = {
  body: 'body', lid: 'body', front: 'pocket', sides: 'pocket', hip: 'trim', harness: 'trim', webbing: 'trim',
};

const planTag = (it: Item | ExtraItem): string => {
  const p = (it as ExtraItem).planned;
  return p === 'shop' ? S.item.shop : p === 'rent' ? S.item.rent : '';
};

/** Cartes du mode Contenu : objets non rangés de la zone (+ autres corps de sac pour la zone « bag »). */
export function contentCards(s: KitState, zone: ZoneId, family: string | null, readVar?: ReadVar): readonly CardModel[] {
  const out: CardModel[] = candidates(s, zone, family).map((it) => {
    const tag = planTag(it);
    const w = formatWeight(effG(s, it));
    return {
      id: it.id,
      kind: 'item',
      name: it.n,
      sub: tag ? `${w} · ${tag}` : w,
      label: tileLabel(it.n, w, tag || undefined),
      // Pas de vignette 3D sans maillage réel publié : la carte affiche son pictogramme 2D (glyph).
      thumb: hasItemModel(it.id) ? itemThumb(it, readVar, !!(it as ExtraItem).planned) : null,
      glyph: it.gl,
      selected: false,
      disabled: it.state === 'lent',
      zones: it.zones,
    };
  });
  if (zone === 'bag' && !family) {
    const k = currentKit(s);
    const c = currentConfig(s);
    const cw = studioData().colorways[k.cw];
    const colors = { body: c.body.col ?? cw.body, pocket: c.front.col ?? cw.pocket, trim: c.harness.col ?? cw.trim };
    for (const b of Object.values(BAGS)) {
      if (b.id === k.bag) continue;
      if (b.id === 'b42' || b.id === 'b28') continue;
      const w = b.g != null ? formatWeight(b.g) : 'non renseigné';
      out.push({
        id: b.id, kind: 'bag', name: b.n, sub: `${formatLitres(b.L)} · ${w}`, label: tileLabel(b.n, w),
        thumb: bagThumb(b.id, colors, readVar), glyph: 'bag', selected: false, disabled: false,
      });
    }
  }
  return out;
}

/** Carte « Ajouter » (liste vide, maquette addTile). */
export const addCard = (): CardModel => ({
  id: 'add', kind: 'add', name: 'Ajouter', sub: '', label: S.cards.addToBag, thumb: null, glyph: 'plus', selected: false, disabled: false,
});

const colOf = (c: ConfigSet, part: PartNameId): MaterialKey | undefined =>
  part === 'all' ? c.body.col : part === 'webbing' ? c.webbing.col : c[part].col;

/** Cartes du mode Apparence (maquette optList + ctile, l.1639-1650). */
export function optionCards(s: KitState, part: PartNameId, cat: OptionCat, readVar?: ReadVar): readonly CardModel[] {
  const k = currentKit(s);
  const c = currentConfig(s);
  const cw = studioData().colorways[k.cw];
  if (cat === 'shape') {
    const colors = { body: c.body.col ?? cw.body, pocket: c.front.col ?? cw.pocket, trim: c.harness.col ?? cw.trim };
    return Object.values(BAGS)
      .filter((b) => !['b42', 'b28'].includes(b.id) || b.id === k.bag)
      .map((b) => {
        const cur = k.bag === b.id;
        const cap = studioData().one.corps[b.id]?.pts;
        const need = ptsUsed(s, 'corps');
        const off = !cur && cap != null && need > cap;
        const sub = cur ? 'Actuel' : off ? 'Plus de place' : formatLitres(b.L);
        return {
          id: b.id, kind: 'opt', name: b.n, sub, label: `${b.n}${cur ? ', actuel' : ''}${off ? ', indisponible' : ''}`,
          thumb: bagThumb(b.id, colors, readVar), glyph: 'bag', selected: cur, disabled: off,
          why: off ? `${b.n} : ${cap} points d’attache, tes modules en utilisent ${need}.` : undefined,
        };
      });
  }
  if (cat === 'mod') {
    const out: CardModel[] = [];
    const glbModel = glbModelForBag(k.bag);
    if (glbModel && LKDV_ONE_BAG_BBOXES[glbModel]) {
      const bagBbox = LKDV_ONE_BAG_BBOXES[glbModel];
      const bagStub = {
        modelId: glbModel,
        boundingBoxM: bagBbox,
      };
      const compatible = filterCompatibleModulesForBag(AVAILABLE_3D_MODULE_MANIFESTS, bagStub);
      const ctrl = getScene()?.getAttachments?.() ?? null;
      for (const m of compatible) {
        const on = ctrl
          ? ctrl.listAnchors().some((a) => ctrl.getMountedModule(a.id)?.moduleId === m.moduleId)
          : false;
        const overflow = calculateModuleOverflowNotice(m, bagStub);
        // Règle produit : le Studio n'affiche que des maillages réels. Un module dont le `.glb`
        // n'est pas publié ne peut donc pas être montré — on le dit sur la carte plutôt que de
        // laisser l'utilisateur appuyer sur quelque chose qui ne se passera jamais.
        const sansMaillage = m.origin === 'procedural';
        const sub = sansMaillage
          ? 'Visuel à venir'
          : on
            ? 'Monté'
            : (overflow ?? m.code ?? 'Disponible');
        out.push({
          id: m.moduleId,
          kind: 'opt',
          name: m.label,
          sub,
          label: `${m.code ? `${m.code} · ` : ''}${m.label}${sansMaillage ? ', visuel à venir' : ''}${overflow && !sansMaillage ? ` (${overflow})` : ''}${on ? ', monté' : ''}`,
          thumb: moduleThumb(m.moduleId, m.code),
          glyph: 'cube',
          selected: on,
          disabled: sansMaillage,
          why: sansMaillage
            ? `${m.label} : le maillage 3D n’est pas encore publié.`
            : (overflow ?? undefined),
          overflowNotice: overflow ?? undefined,
        });
      }
    }

    const mods = studioData().one.mods;
    const legacyCards: CardModel[] = MODULE_IDS.filter((m) => part === 'all' || mods[m].part === part).map((m: ModuleId): CardModel => {
      const M = mods[m];
      const on = modOn(s, m);
      const off = !on && !canAddModule(s, m);
      const owned = !!(s.own[`mod:${m}`] || s.order[`mod:${m}`]);
      const sub = on ? 'Monté' : off ? 'Plus de place' : owned ? 'À toi' : `+${formatEuro(toCents(M.eur))}`;
      return {
        id: m, kind: 'opt', name: M.n, sub, label: `${M.n}${on ? ', monté' : ''}${off ? ', indisponible' : ''}`,
        thumb: moduleThumb(m), glyph: M.gl, selected: on, disabled: off,
        why: off ? 'Plus de points d’attache libres. Retire un module.' : undefined,
      };
    });
    out.push(...legacyCards);
    return out;
  }
  const colorways = studioData().colorways;
  const ids = Object.keys(colorways) as ColorwayId[];
  const cur = colOf(c, part);
  return ids.map((id) => {
    const w = colorways[id];
    if (part === 'all') {
      const sel = c.body.col === w.body && c.harness.col === w.trim;
      return { id, kind: 'opt', name: w.n, sub: '', label: `${w.n}${sel ? ', actuel' : ''}`, thumb: colorwayThumb(w, k.bag, readVar), glyph: 'bag', selected: sel, disabled: false };
    }
    const mat = w[COLOR_ROLE[part]];
    const sel = cur === mat;
    return { id, kind: 'opt', name: w.n, sub: '', label: `${w.n}${sel ? ', actuel' : ''}`, thumb: swatchThumb([w.n, mat], readVar), glyph: 'col', selected: sel, disabled: false };
  });
}

/** Valeur transmise à setPartOption pour une option de coloris. */
export function colorValue(part: PartNameId, id: string): string {
  if (part === 'all') return id;
  return studioData().colorways[id as ColorwayId][COLOR_ROLE[part]];
}
