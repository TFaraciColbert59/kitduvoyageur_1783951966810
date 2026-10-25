#!/usr/bin/env node
/**
 * CODEMOD — lucide-react → canonical <Icon>
 * =========================================
 * Rewrites JSX usages of Lucide icons to the canonical `Icon` primitive:
 *
 *   import { MapPin } from 'lucide-react';
 *   <MapPin size={16} className="x" />
 *   →
 *   import Icon from '@/components/ui/Icon';
 *   <Icon name="map-pin" size={16} className="x" />
 *
 * Only icons present in `scripts/icons/icon-set.json` are migrated. Icons used
 * as values (not JSX), type imports (`LucideIcon`) and icons without an SF-style
 * glyph are left untouched, so the file keeps compiling.
 *
 * Usage:
 *   node scripts/icons/codemod-lucide-to-icon.mjs --dry --file src/x.tsx
 *   node scripts/icons/codemod-lucide-to-icon.mjs            # all files
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const iconSetPath = path.join(root, 'scripts', 'icons', 'icon-set.json');
const ICON_MODULE = '@/components/ui/Icon';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const fileArgIdx = args.indexOf('--file');
const onlyFile = fileArgIdx >= 0 ? args[fileArgIdx + 1] : null;

const iconSet = JSON.parse(fs.readFileSync(iconSetPath, 'utf8'));
const nameByLucide = new Map(iconSet.map((e) => [e.lucide, e.name]));

const SVG_ONLY_PROPS = new Set([
  'absoluteStrokeWidth',
  'stroke',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'strokeDasharray',
  'strokeDashoffset',
  'fill',
  'fillRule',
  'clipRule',
  'vectorEffect',
  'paintOrder',
  'shapeRendering',
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

function scriptKind(file) {
  return file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function isBoundAsIcon(sf) {
  let bound = false;
  sf.forEachChild((n) => {
    if (ts.isImportDeclaration(n) && n.importClause) {
      const c = n.importClause;
      if (c.name && c.name.text === 'Icon') bound = true;
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const el of c.namedBindings.elements) if (el.name.text === 'Icon') bound = true;
      }
      if (c.namedBindings && ts.isNamespaceImport(c.namedBindings) && c.namedBindings.name.text === 'Icon') {
        bound = true;
      }
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === 'Icon') bound = true;
      }
    }
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name && n.name.text === 'Icon') {
      bound = true;
    }
  });
  return bound;
}

function attrName(attr) {
  const n = attr.name;
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isStringLiteral(n)) return n.text;
  return '';
}

function processSource(text, fileName) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));

  const lucideImports = [];
  sf.forEachChild((n) => {
    if (
      ts.isImportDeclaration(n) &&
      ts.isStringLiteral(n.moduleSpecifier) &&
      n.moduleSpecifier.text === 'lucide-react'
    ) {
      lucideImports.push(n);
    }
  });

  if (lucideImports.length === 0) return { changed: false, text };

  const localToLucide = new Map();
  for (const imp of lucideImports) {
    if (imp.importClause?.isTypeOnly) continue;
    const nb = imp.importClause?.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        if (el.isTypeOnly) continue;
        const imported = (el.propertyName ?? el.name).text;
        localToLucide.set(el.name.text, imported);
      }
    }
  }

  const edits = [];
  const convertedLocals = new Map(); // local -> count
  const usedNonJsx = new Set();

  const targetTag = isBoundAsIcon(sf) ? 'LkvIconSf' : 'Icon';

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) {
        const local = tag.text;
        const lucide = localToLucide.get(local);
        const canonical = lucide ? nameByLucide.get(lucide) : undefined;
        if (canonical) {
          const props = node.attributes.properties;
          const attrs = [];
          let hasSize = false;
          for (const p of props) if (ts.isJsxAttribute(p) && attrName(p) === 'size') hasSize = true;

          let sizeFromDim = null;
          for (const p of props) {
            if (ts.isJsxAttribute(p)) {
              const an = attrName(p);
              if (an === 'absoluteStrokeWidth') continue;
              if (SVG_ONLY_PROPS.has(an)) continue;
              if (an === 'width' || an === 'height') {
                if (sizeFromDim === null) sizeFromDim = p;
                continue;
              }
              attrs.push(text.slice(p.getStart(sf), p.getEnd()));
            } else {
              attrs.push(text.slice(p.getStart(sf), p.getEnd()));
            }
          }
          if (!hasSize && sizeFromDim) {
            const val = sizeFromDim.initializer;
            attrs.push(`size=${val ? text.slice(val.getStart(sf), val.getEnd()) : '{20}'}`);
          }

          const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
          if (ts.isJsxSelfClosingElement(node)) {
            edits.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              text: `<${targetTag} name="${canonical}"${attrText} />`,
            });
          } else {
            edits.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              text: `<${targetTag} name="${canonical}"${attrText}>`,
            });
            const close = node.parent.closingElement;
            if (close) {
              edits.push({ start: close.getStart(sf), end: close.getEnd(), text: `</${targetTag}>` });
            }
          }
          convertedLocals.set(local, (convertedLocals.get(local) ?? 0) + 1);
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (edits.length === 0) return { changed: false, text };

  // Detect non-JSX usages of converted locals (value references) → keep import.
  function collectOtherRefs(node) {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const insideImport =
        parent &&
        (ts.isImportSpecifier(parent) ||
          ts.isImportClause(parent) ||
          ts.isNamespaceImport(parent) ||
          ts.isImportDeclaration(parent));
      const insideJsxTag =
        parent &&
        (ts.isJsxSelfClosingElement(parent) ||
          ts.isJsxOpeningElement(parent) ||
          ts.isJsxClosingElement(parent));
      const local = node.text;
      if (!insideImport && !insideJsxTag && localToLucide.has(local) && nameByLucide.has(localToLucide.get(local))) {
        usedNonJsx.add(local);
      }
    }
    ts.forEachChild(node, collectOtherRefs);
  }
  collectOtherRefs(sf);

  // Rewrite / remove lucide import declarations.
  for (const imp of lucideImports) {
    if (imp.importClause?.isTypeOnly) continue;
    const nb = imp.importClause?.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    const remaining = [];
    for (const el of nb.elements) {
      const imported = (el.propertyName ?? el.name).text;
      const local = el.name.text;
      const migratable = nameByLucide.has(imported);
      const stillUsed = usedNonJsx.has(local) || el.isTypeOnly || !migratable;
      if (stillUsed) {
        remaining.push(el.getText(sf));
      }
    }
    if (remaining.length === 0) {
      // remove whole import line (include trailing newline if present)
      let end = imp.getEnd();
      if (text[end] === '\n') end += 1;
      else if (text[end] === '\r' && text[end + 1] === '\n') end += 2;
      edits.push({ start: imp.getStart(sf), end, text: '' });
    } else {
      const clause = imp.importClause;
      let prefix = 'import ';
      if (clause?.isTypeOnly) prefix += 'type ';
      edits.push({
        start: imp.getStart(sf),
        end: imp.getEnd(),
        text: `${prefix}{ ${remaining.join(', ')} } from 'lucide-react';`,
      });
    }
  }

  // Ensure canonical Icon import exists.
  const hasIconImport = new RegExp(`from\\s+['"]${ICON_MODULE.replace(/[/@]/g, (m) => '\\' + m)}['"]`).test(text);
  if (!hasIconImport) {
    let insertAt = 0;
    sf.forEachChild((n) => {
      if (ts.isImportDeclaration(n) && insertAt === 0) insertAt = n.getStart(sf);
    });
    if (insertAt === 0) {
      // after shebang / use client directive
      const m = text.match(/^(['"]use (client|server)['"];?\s*\r?\n|#![^\n]*\r?\n)/);
      insertAt = m ? m[0].length : 0;
    }
    edits.push({ start: insertAt, end: insertAt, text: `import ${targetTag} from '${ICON_MODULE}';\n` });
  }

  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { changed: out !== text, text: out };
}

const files = onlyFile ? [path.resolve(root, onlyFile)] : walk(srcDir);
let changedFiles = 0;
const changedPaths = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const { changed, text: out } = processSource(text, file);
  if (!changed) continue;
  changedFiles++;
  changedPaths.push(path.relative(root, file));
  if (dry) {
    console.log(`--- ${path.relative(root, file)} ---`);
    const before = text.split(/\r?\n/);
    const after = out.split(/\r?\n/);
    console.log(`  lines before=${before.length} after=${after.length}`);
    console.log(out);
  } else {
    fs.writeFileSync(file, out);
    console.log(path.relative(root, file));
  }
}

console.log(`\n${dry ? '[dry-run] ' : ''}${changedFiles} fichier(s) modifié(s).`);
if (!dry && changedPaths.length) {
  fs.writeFileSync(path.join(root, 'scripts', 'icons', '.codemod-changed.txt'), changedPaths.join('\n') + '\n');
}
