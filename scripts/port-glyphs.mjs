// Porte les pictogrammes de la maquette Kit Studio (fragments SVG, viewBox 0 0 24 24, trait)
// en données TypeScript. Usage : node scripts/port-glyphs.mjs
// Aucune couleur n'est conservée : les icônes héritent de currentColor.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'kit-studio-bundle/reference/Kit_Studio_v2.html');
const TARGET = resolve(root, 'src/features/kit-studio/ui/glyphs.generated.ts');

const SUPPORTED_TAGS = new Set(['rect', 'path', 'circle', 'line', 'polyline', 'polygon', 'ellipse']);
const COLOR_ATTRS = new Set(['fill', 'stroke', 'color', 'stop-color', 'flood-color']);
const NEUTRAL_VALUES = new Set(['none', 'currentColor']);

const text = readFileSync(SOURCE, 'utf8');
const glMatch = text.match(/const GL=\{[\s\S]*?\n\};/);
const catMatch = text.match(/const CATIC=\{[^\n]*\};/);
if (!glMatch || !catMatch) {
  throw new Error(`Blocs GL ou CATIC introuvables dans ${SOURCE}`);
}

const { GL, CATIC } = vm.runInNewContext(`${glMatch[0]}\n${catMatch[0]}\n({ GL, CATIC })`, Object.create(null), {
  timeout: 1000,
});

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function parseFragment(key, fragment) {
  const els = [];
  const elRe = /<([a-zA-Z]+)\b([^>]*?)\/?>/g;
  let m;
  while ((m = elRe.exec(fragment)) !== null) {
    const tag = m[1];
    if (!SUPPORTED_TAGS.has(tag)) {
      throw new Error(`Balise non supportée "${tag}" dans le glyphe "${key}"`);
    }
    const attrs = {};
    const attrRe = /([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[2])) !== null) {
      const name = a[1];
      const value = a[2];
      if (COLOR_ATTRS.has(name) && !NEUTRAL_VALUES.has(value)) continue;
      if (/#|rgba?\(|hsla?\(/.test(value)) continue;
      attrs[camel(name)] = value;
    }
    els.push({ tag, attrs });
  }
  if (els.length === 0) {
    throw new Error(`Aucun élément SVG dans le glyphe "${key}"`);
  }
  return els;
}

const quoteKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const str = (v) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function serializeList(list, indent) {
  const pad = ' '.repeat(indent);
  const lines = list.map((el) => {
    const attrs = Object.entries(el.attrs)
      .map(([k, v]) => `${quoteKey(k)}: ${str(v)}`)
      .join(', ');
    return `${pad}  { tag: '${el.tag}', attrs: { ${attrs} } },`;
  });
  return `[\n${lines.join('\n')}\n${pad}]`;
}

function serializeMap(map) {
  return Object.entries(map)
    .map(([k, list]) => `  ${quoteKey(k)}: ${serializeList(list, 2)},`)
    .join('\n');
}

const glyphs = {};
for (const [key, fragment] of Object.entries(GL)) {
  glyphs[key] = parseFragment(key, fragment);
}
const categories = {};
for (const [key, fragment] of Object.entries(CATIC)) {
  categories[key] = parseFragment(`cat:${key}`, fragment);
}

const out = `// Généré par scripts/port-glyphs.mjs depuis kit-studio-bundle/reference/Kit_Studio_v2.html. Ne pas éditer à la main.
// Fragments SVG (viewBox 0 0 24 24, trait) ; aucune couleur : les icônes héritent de currentColor.

export type GlyphTag = 'rect' | 'path' | 'circle' | 'line' | 'polyline' | 'polygon' | 'ellipse';

export interface GlyphEl {
  readonly tag: GlyphTag;
  readonly attrs: Readonly<Record<string, string>>;
}

export const GLYPHS: Readonly<Record<string, readonly GlyphEl[]>> = {
${serializeMap(glyphs)}
};

export const CATEGORY_GLYPHS: Readonly<Record<string, readonly GlyphEl[]>> = {
${serializeMap(categories)}
};
`;

writeFileSync(TARGET, out, 'utf8');
process.stdout.write(
  `glyphes: ${Object.keys(glyphs).length}, catégories: ${Object.keys(categories).length} -> ${TARGET}\n`,
);
