import type { Page } from '@playwright/test';

import type { Rect } from './diff';

/**
 * Fond neutre du banc (X1 de ECARTS-TRANSVERSES.md).
 *
 * Le tiroir est en verre translucide : ses pixels dépendent de ce qu'il y a
 * derrière. Dans l'app c'est la photo réelle de `/communaute` et le contenu de
 * la page ; dans la maquette, une illustration verte. Ces fonds ne sont pas
 * comparables et noyaient l'écart du tiroir (34 à 85 % de pixels). Le banc
 * impose donc, dans les DEUX captures et dans le banc seulement, le même fond
 * uni : tout ce qui n'appartient pas au tiroir (ni à ses éléments « gardés »,
 * comme le dialogue d'aperçu) est rendu invisible, et la racine est peinte d'un
 * aplat neutre. Le verre du tiroir (dégradé, flou, saturation) se compose alors
 * sur le même aplat des deux côtés. L'app réelle n'est jamais modifiée.
 *
 * `FIDELITY_RAW_BG=1` désactive la neutralisation (fond réel des deux côtés).
 */

/** Aplat neutre (gris moyen clair, sans teinte) : il ne favorise ni le vert ni l'olive. */
export const NEUTRAL_BACKGROUND = 'rgb(200, 200, 200)';

export const NEUTRAL_ENABLED = process.env.FIDELITY_RAW_BG !== '1';

export interface NeutralSpec {
  /** Sélecteur du tiroir : ce qui est conservé, et zone comparée. */
  sheet: string;
  /** Éléments supplémentaires à conserver (dialogue d'aperçu, île…), avec leurs ancêtres. */
  keep?: string[];
  /** Cadre (le téléphone, la couche de l'app) peint de l'aplat. */
  root: string;
}

/**
 * Rend invisible tout sauf le tiroir (et `keep`) et peint le fond uni.
 * Renvoie la boîte du tiroir, relative à la fenêtre, ou null s'il est absent.
 */
export async function neutralizeBackground(page: Page, spec: NeutralSpec): Promise<Rect | null> {
  return page.evaluate(
    ({ sheet, keep, root, color }) => {
      const sheetEl = document.querySelector<HTMLElement>(sheet);
      if (!sheetEl) return null;
      const keepEls = [sheetEl, ...(keep ?? []).flatMap((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)))];
      const protectedEls = new Set<Element>();
      for (const el of keepEls) {
        let node: Element | null = el;
        while (node) {
          protectedEls.add(node);
          node = node.parentElement;
        }
      }
      // À chaque niveau, les frères qui ne mènent pas à un élément gardé disparaissent.
      for (const el of protectedEls) {
        const parent = el.parentElement;
        if (!parent) continue;
        for (const sibling of Array.from(parent.children)) {
          if (!protectedEls.has(sibling)) (sibling as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        }
      }
      // Les ancêtres du tiroir ne portent plus de fond ni d'ombre propres.
      for (const el of protectedEls) {
        if (keepEls.includes(el as HTMLElement)) continue;
        const style = (el as HTMLElement).style;
        style.setProperty('background', 'none', 'important');
        style.setProperty('box-shadow', 'none', 'important');
        style.setProperty('backdrop-filter', 'none', 'important');
        style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      }
      const rootEl = document.querySelector<HTMLElement>(root);
      document.documentElement.style.setProperty('background', color, 'important');
      document.body.style.setProperty('background', color, 'important');
      if (rootEl) rootEl.style.setProperty('background', color, 'important');
      // Pseudo-éléments décoratifs de la racine (halo, voile) : retirés.
      const sheetStyle = document.createElement('style');
      sheetStyle.textContent = `${root}::before,${root}::after{display:none!important}`;
      document.head.appendChild(sheetStyle);
      const r = sheetEl.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    },
    { sheet: spec.sheet, keep: spec.keep, root: spec.root, color: NEUTRAL_BACKGROUND },
  );
}

/** Quatre rectangles qui couvrent tout le cadre sauf `zone` (coordonnées du cadre). */
export function outsideRects(frame: { w: number; h: number }, zone: Rect): Rect[] {
  const x0 = Math.max(0, Math.floor(zone.x));
  const y0 = Math.max(0, Math.floor(zone.y));
  const x1 = Math.min(frame.w, Math.ceil(zone.x + zone.w));
  const y1 = Math.min(frame.h, Math.ceil(zone.y + zone.h));
  return [
    { x: 0, y: 0, w: frame.w, h: y0 },
    { x: 0, y: y1, w: frame.w, h: frame.h - y1 },
    { x: 0, y: y0, w: x0, h: y1 - y0 },
    { x: x1, y: y0, w: frame.w - x1, h: y1 - y0 },
  ].filter((r) => r.w > 0 && r.h > 0);
}

/** Union de deux rectangles. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
