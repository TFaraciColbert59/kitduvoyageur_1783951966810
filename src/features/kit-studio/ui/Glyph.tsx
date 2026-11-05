import { createElement } from 'react';
import type { ReactElement } from 'react';
import { CATEGORY_GLYPHS, GLYPHS } from './glyphs.generated';
import type { GlyphEl } from './glyphs.generated';

export interface GlyphProps {
  readonly name: string;
  readonly size?: number;
  readonly title?: string;
}

const FALLBACK = 'box';

/** Résout un glyphe par nom (pictogrammes d'objets puis catégories), repli sur `box`. */
export function resolveGlyph(name: string): readonly GlyphEl[] {
  return GLYPHS[name] ?? CATEGORY_GLYPHS[name] ?? GLYPHS[FALLBACK] ?? Object.values(GLYPHS)[0] ?? [];
}

export function Glyph({ name, size = 24, title }: GlyphProps): ReactElement {
  const children: ReactElement[] = resolveGlyph(name).map((el, i) => createElement(el.tag, { key: i, ...el.attrs }));
  if (title) children.unshift(createElement('title', { key: 'title' }, title));
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': title ? undefined : true,
      role: title ? 'img' : undefined,
      focusable: 'false',
    },
    ...children,
  );
}
