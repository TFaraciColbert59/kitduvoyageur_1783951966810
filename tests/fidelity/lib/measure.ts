import type { Page } from '@playwright/test';

import type { MeasureResult, MeasureSpec, MeasureValue } from './types';

/** Lit rect (relatif au cadre) et styles calculés du premier élément visible. */
export async function readMeasure(
  page: Page,
  selector: string,
  frame: string | null,
  props: string[],
): Promise<MeasureValue | null> {
  return page.evaluate(
    ({ selector: sel, frame: frameSel, props: names }) => {
      const nodes = Array.from(document.querySelectorAll(sel));
      const el =
        nodes.find((node) => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) ?? null;
      if (!el) return null;
      const frameEl = frameSel ? document.querySelector(frameSel) : null;
      const origin = frameEl ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const style: Record<string, string> = {};
      for (const name of names) style[name] = cs.getPropertyValue(name).trim();
      return {
        rect: { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height },
        style,
      };
    },
    { selector, frame, props },
  );
}

const PX = /^(-?\d+(?:\.\d+)?)px$/;

/** Compare deux valeurs calculées : longueurs à ±1 px, tout le reste à l'identique (rayons ≥ 200 px équivalents). */
export function compareValues(a: string, b: string, prop = ''): { ok: boolean; delta?: number } {
  if (a === b) return { ok: true, delta: 0 };
  const ta = a.split(/\s+/);
  const tb = b.split(/\s+/);
  if (ta.length !== tb.length) return { ok: false };
  let worst = 0;
  for (let i = 0; i < ta.length; i += 1) {
    if (ta[i] === tb[i]) continue;
    const ma = PX.exec(ta[i]);
    const mb = PX.exec(tb[i]);
    if (!ma || !mb) return { ok: false };
    // Rayons saturés (999 px, 9999 px) : même pilule, aucune différence visible.
    if (prop.includes('radius') && Number(ma[1]) >= 200 && Number(mb[1]) >= 200) continue;
    const d = Math.abs(Number(ma[1]) - Number(mb[1]));
    if (d > 1) return { ok: false, delta: d };
    worst = Math.max(worst, d);
  }
  return { ok: true, delta: worst };
}

function num(n: number): string {
  return `${Math.round(n * 10) / 10}px`;
}

/** Mesures comparées ; un élément manquant d'un côté est un écart. */
export function compareMeasures(
  spec: MeasureSpec,
  app: MeasureValue | null,
  maquette: MeasureValue | null,
): MeasureResult[] {
  const out: MeasureResult[] = [];
  if (!app || !maquette) {
    const note = !app && !maquette ? 'absent des deux côtés' : !app ? 'absent de l’app' : 'absent de la maquette';
    // Absent des deux côtés (ex. mini-capsule retirée pendant le chargement) : même état, conforme.
    out.push({ id: spec.id, prop: '(présence)', app: app ? 'présent' : null, maquette: maquette ? 'présent' : null, ok: !app && !maquette, note });
    return out;
  }
  if (spec.rect) {
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      const a = app.rect![key];
      const m = maquette.rect![key];
      const delta = Math.abs(a - m);
      out.push({ id: spec.id, prop: key === 'w' ? 'largeur' : key === 'h' ? 'hauteur' : key, app: num(a), maquette: num(m), ok: delta <= 1, delta: Math.round(delta * 10) / 10 });
    }
  }
  for (const prop of spec.props ?? []) {
    const a = app.style[prop] ?? '';
    const m = maquette.style[prop] ?? '';
    const cmp = compareValues(a, m, prop);
    out.push({ id: spec.id, prop, app: a, maquette: m, ok: cmp.ok, delta: cmp.delta });
  }
  return out;
}
