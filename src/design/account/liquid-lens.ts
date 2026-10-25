// src/design/account/liquid-lens.ts
//
// Lentille réfractive « Liquid Glass » — extraite telle quelle du runtime
// `src/components/compte/compte-liquid-glass-v8-runtime.js` (lensMap /
// lensFilter / lensAll), sans changer une seule valeur. C'est la matière de la
// grammaire Compte : sept filtres SVG générés à la volée, un par couple
// taille/rayon (`lf84x34r17`, `lf38x38r19`, `lf88x30r15`, `lf402x48r24`…).
//
// Utilisation : `initLiquidLenses()` une fois monté, puis `refreshLiquidLenses()`
// après un changement de contenu ou de viewport.

const NS = 'http://www.w3.org/2000/svg';

/** La référence n'active la lentille que sur Chromium (coût GPU). */
const LENS_ON = typeof navigator !== 'undefined' && /Chrome\//.test(navigator.userAgent);
const made: Record<string, 1> = {};

/** Sélecteurs exacts de la référence, restreints au cadre passé en argument. */
export const LENS_SELECTOR = [
  '.tb',
  '.ig-handle',
  '.acc',
  '.gbtn',
  '.mctl',
  '.callout',
  '.ig-tabs',
  '.map-scale-selector',
  '.sheet .flow',
  '.sheet .segc',
  '.sheet .reseau-toggle',
  '.sheet .ig-sub',
]
  .map((s) => `:scope ${s}`)
  .join(',');

function lensMap(w: number, h: number, r: number, bz: number): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  const im = x.createImageData(w, h);
  const D = im.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = i + 0.5 - w / 2;
      const py = j + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r);
      const qy = Math.abs(py) - (h / 2 - r);
      const d = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
      let nx = 0;
      let ny = 0;
      let m = 0;
      if (d >= 0 && d < bz) {
        if (qx > 0 && qy > 0) {
          const L = Math.hypot(qx, qy) || 1;
          nx = (Math.sign(px) * qx) / L;
          ny = (Math.sign(py) * qy) / L;
        } else if (qx > qy) nx = Math.sign(px);
        else ny = Math.sign(py);
        const t = 1 - d / bz;
        m = t * t * (3 - 2 * t);
      }
      const k = (j * w + i) * 4;
      D[k] = 128 - nx * m * 127;
      D[k + 1] = 128 - ny * m * 127;
      D[k + 2] = 128;
      D[k + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0);
  return c.toDataURL();
}

function lensFilter(w: number, h: number, r: number, bz: number, sc: number): string {
  const id = `lf${w}x${h}r${r}`;
  if (made[id]) return id;
  let defs = document.getElementById('lensdefs') as unknown as SVGDefsElement | null;
  if (!defs) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.innerHTML = '<defs id="lensdefs"></defs>';
    document.body.appendChild(s);
    defs = document.getElementById('lensdefs') as unknown as SVGDefsElement;
  }
  const f = document.createElementNS(NS, 'filter');
  f.id = id;
  f.setAttribute('x', '0');
  f.setAttribute('y', '0');
  f.setAttribute('width', String(w));
  f.setAttribute('height', String(h));
  f.setAttribute('filterUnits', 'userSpaceOnUse');
  f.setAttribute('color-interpolation-filters', 'sRGB');
  f.innerHTML = `<feImage href="${lensMap(w, h, r, bz)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/>`;
  defs.appendChild(f);
  made[id] = 1;
  return id;
}

/**
 * Applique la lentille à toutes les surfaces de verre du cadre.
 * Idempotent : rappelable après un resize, un changement d'onglet ou de drawer.
 */
export function refreshLiquidLenses(frame: HTMLElement | null): void {
  if (!LENS_ON || !frame) return;
  const gb = parseFloat(getComputedStyle(frame).getPropertyValue('--gb')) || 7.2;
  frame.querySelectorAll<HTMLElement>(LENS_SELECTOR).forEach((el) => {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h || w > 420) {
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('-webkit-backdrop-filter');
      el.classList.remove('lens-on');
      return;
    }
    const r = Math.round(Math.min(h / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2));
    const id = lensFilter(w, h, r, Math.max(6, Math.min(16, Math.round(h * 0.34))), Math.round(Math.min(30, h * 0.55)));
    const lensValue = `url(#${id}) blur(${(gb * 0.55 || 3).toFixed(1)}px) saturate(1.9) brightness(1.07)`;
    el.style.setProperty('backdrop-filter', lensValue, 'important');
    el.style.setProperty('-webkit-backdrop-filter', lensValue, 'important');
    el.classList.add('lens-on');
  });
}

/** Réessaie une fois la mise en page stabilisée (images, polices, safe areas). */
export function initLiquidLenses(frame: HTMLElement | null): () => void {
  if (!LENS_ON || !frame) return () => {};
  let raf = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => refreshLiquidLenses(frame));
  };
  run();
  const t1 = window.setTimeout(run, 220);
  const t2 = window.setTimeout(run, 900);
  window.addEventListener('resize', run);
  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.removeEventListener('resize', run);
  };
}
