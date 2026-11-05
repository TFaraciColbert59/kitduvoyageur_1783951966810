// Généré par scripts/port-glyphs.mjs depuis kit-studio-bundle/reference/Kit_Studio_v2.html. Ne pas éditer à la main.
// Fragments SVG (viewBox 0 0 24 24, trait) ; aucune couleur : les icônes héritent de currentColor.

export type GlyphTag = 'rect' | 'path' | 'circle' | 'line' | 'polyline' | 'polygon' | 'ellipse';

export interface GlyphEl {
  readonly tag: GlyphTag;
  readonly attrs: Readonly<Record<string, string>>;
}

export const GLYPHS: Readonly<Record<string, readonly GlyphEl[]>> = {
  roll: [
    { tag: 'rect', attrs: { x: '3', y: '7.5', width: '18', height: '9', rx: '4.5' } },
    { tag: 'path', attrs: { d: 'M7.5 7.5v9M16.5 7.5v9' } },
  ],
  sack: [
    { tag: 'path', attrs: { d: 'M6.5 9.5h11l1.5 3.5v4.5a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V13z' } },
    { tag: 'path', attrs: { d: 'M8.5 9.5c.5-3 6.5-3 7 0' } },
  ],
  box: [
    { tag: 'rect', attrs: { x: '3.5', y: '6.5', width: '17', height: '12', rx: '3' } },
    { tag: 'path', attrs: { d: 'M3.5 11h17' } },
  ],
  aid: [
    { tag: 'rect', attrs: { x: '3.5', y: '6.5', width: '17', height: '12', rx: '3' } },
    { tag: 'path', attrs: { d: 'M12 9.5v6M9 12.5h6' } },
  ],
  bottle: [
    { tag: 'path', attrs: { d: 'M10 3h4v3l2 3v11a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V9l2-3z' } },
    { tag: 'path', attrs: { d: 'M8 13h8' } },
  ],
  bladder: [
    { tag: 'path', attrs: { d: 'M7 3.5h8a3 3 0 0 1 3 3V17a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V6.5a3 3 0 0 1 1-3z' } },
    { tag: 'path', attrs: { d: 'M15 3.5c3 0 4.5 2 4.5 5.5' } },
  ],
  lamp: [
    { tag: 'path', attrs: { d: 'M3 14c2.5-4.5 15.5-4.5 18 0' } },
    { tag: 'rect', attrs: { x: '8.5', y: '9', width: '7', height: '6', rx: '2' } },
    { tag: 'path', attrs: { d: 'M12 11.2v1.6' } },
  ],
  poles: [
    { tag: 'path', attrs: { d: 'M8.5 3 6 21M15.5 3 18 21' } },
    { tag: 'path', attrs: { d: 'M6.5 7.5h3.5M14 7.5h3.5' } },
  ],
  map: [
    { tag: 'path', attrs: { d: 'M3 6.5l6-2 6 2 6-2V18l-6 2-6-2-6 2z' } },
    { tag: 'path', attrs: { d: 'M9 4.5V18M15 6.5V20' } },
  ],
  jacket: [
    { tag: 'path', attrs: { d: 'M8.5 4 12 6l3.5-2 4.5 4-3 3v9H7v-9L4 8z' } },
    { tag: 'path', attrs: { d: 'M12 6v14' } },
  ],
  shoe: [
    { tag: 'path', attrs: { d: 'M3 16.5c0-3.5 2-8.5 4-8.5h3l1.2 4 6.8 2c2 .6 3 2 3 3.5v1H3z' } },
    { tag: 'path', attrs: { d: 'M3 15.5h18' } },
  ],
  phone: [
    { tag: 'rect', attrs: { x: '7', y: '2.5', width: '10', height: '19', rx: '2.5' } },
    { tag: 'path', attrs: { d: 'M11 18.5h2' } },
  ],
  knife: [
    { tag: 'path', attrs: { d: 'M4 18 15 7c2.2 2.2 2.2 5 0 7l-3.5 3.5' } },
    { tag: 'path', attrs: { d: 'M4 18l2 2' } },
  ],
  tube: [
    { tag: 'path', attrs: { d: 'M8.5 3h7L14.5 17h-5z' } },
    { tag: 'rect', attrs: { x: '10', y: '17', width: '4', height: '4', rx: '1' } },
  ],
  stove: [
    { tag: 'path', attrs: { d: 'M5 11h14v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5z' } },
    { tag: 'path', attrs: { d: 'M3 11h18M9 7.5c0-1.5 1.2-2 1.2-3.5M14 7.5c0-1.5 1.2-2 1.2-3.5' } },
  ],
  hat: [
    { tag: 'path', attrs: { d: 'M2.5 16.5h19' } },
    { tag: 'path', attrs: { d: 'M6 16.5c0-6.5 12-6.5 12 0' } },
  ],
  glasses: [
    { tag: 'circle', attrs: { cx: '7', cy: '13', r: '3.5' } },
    { tag: 'circle', attrs: { cx: '17', cy: '13', r: '3.5' } },
    { tag: 'path', attrs: { d: 'M10.5 12.5h3M3.5 12 2.5 9M20.5 12l1-3' } },
  ],
  blanket: [
    { tag: 'rect', attrs: { x: '4', y: '5.5', width: '16', height: '13', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M4 12.5l4.5-3 4 3.5 3.5-2.5 4 2.5' } },
  ],
  watch: [
    { tag: 'rect', attrs: { x: '7', y: '7', width: '10', height: '10', rx: '3' } },
    { tag: 'path', attrs: { d: 'M9 7V3h6v4M9 17v4h6v-4M12 10v2.5l1.5 1' } },
  ],
  battery: [
    { tag: 'rect', attrs: { x: '3', y: '7.5', width: '16', height: '9', rx: '2.2' } },
    { tag: 'path', attrs: { d: 'M21 10.5v3M7 12h6' } },
  ],
  laptop: [
    { tag: 'rect', attrs: { x: '5', y: '5', width: '14', height: '10', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M2.5 18.5h19' } },
  ],
  filter: [
    { tag: 'path', attrs: { d: 'M9 3h6v4l1.5 2v11A1.5 1.5 0 0 1 15 21.5H9A1.5 1.5 0 0 1 7.5 20V9L9 7z' } },
    { tag: 'path', attrs: { d: 'M12 11.5c1.2 1.4 1.8 2.3 1.8 3a1.8 1.8 0 0 1-3.6 0c0-.7.6-1.6 1.8-3z' } },
  ],
  bag: [
    { tag: 'path', attrs: { d: 'M7 8a5 5 0 0 1 10 0v11.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z' } },
    { tag: 'path', attrs: { d: 'M9 13.5h6M10 4.5V3h4v1.5' } },
  ],
  plus: [
    { tag: 'path', attrs: { d: 'M12 6v12M6 12h12' } },
  ],
  tent: [
    { tag: 'path', attrs: { d: 'M3 19.5 12 5l9 14.5z' } },
    { tag: 'path', attrs: { d: 'M12 5v14.5M9.5 19.5 12 15l2.5 4.5' } },
  ],
  gloves: [
    { tag: 'path', attrs: { d: 'M7 21v-6l-2-3V7a1.5 1.5 0 0 1 3 0v3V5a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V10V6a1.5 1.5 0 0 1 3 0v8l-2 3v4z' } },
  ],
};

export const CATEGORY_GLYPHS: Readonly<Record<string, readonly GlyphEl[]>> = {
  shape: [
    { tag: 'rect', attrs: { x: '3.5', y: '10', width: '10', height: '10', rx: '2' } },
    { tag: 'circle', attrs: { cx: '15', cy: '9', r: '5.5' } },
  ],
  mat: [
    { tag: 'rect', attrs: { x: '4', y: '4', width: '16', height: '16', rx: '3.5' } },
    { tag: 'path', attrs: { d: 'M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16' } },
  ],
  col: [
    { tag: 'path', attrs: { d: 'M12 3.5c3.6 4 6 7 6 10.2a6 6 0 0 1-12 0C6 10.5 8.4 7.5 12 3.5z' } },
  ],
  fin: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '8' } },
    { tag: 'path', attrs: { d: 'M8.2 10.2A4.4 4.4 0 0 1 11 7.4' } },
  ],
  acc: [
    { tag: 'rect', attrs: { x: '4', y: '9', width: '11', height: '11', rx: '2.5' } },
    { tag: 'path', attrs: { d: 'M17.5 3.5v7M14 7h7' } },
  ],
};
