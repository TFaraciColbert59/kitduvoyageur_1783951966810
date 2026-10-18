// Compas — phase 7 : cœur PUR de l'inventaire statique des contrôles.
//
// Une source TSX entre, la liste de ses contrôles interactifs sort : bouton,
// lien, champ, zone de texte, liste, case, curseur, interrupteur, onglet,
// résumé, zone cliquable et gestes (glisser, appui long, double-touche).
// Aucun accès disque ici : le script `inventory-controls.mjs` lit les fichiers,
// le dictionnaire français et les tables (étapes, parcours de tiroir).
//
// Le nom accessible est calculé comme le navigateur le ferait, au plus près :
// aria-label, sinon le texte des enfants, sinon le <label> du champ, sinon
// title, sinon placeholder. Les clés i18n sont résolues en français ; ce qui
// dépend des données devient « … » (et `.*?` dans le motif de reconnaissance).
//
// L'identifiant d'un contrôle est STABLE : fichier, composant, balise et clé
// i18n (ou texte littéral), jamais le numéro de ligne. Deux homonymes du même
// composant sont départagés par leur rang (#2, #3…).
import ts from 'typescript';

export const WILD = Object.freeze({ wild: true });
const isWild = (p) => typeof p === 'object' && p !== null && p.wild === true;
const MAX_VARIANTS = 24;

/* ---------- Texte à variantes : [[partie, partie…], …] ---------- */

const EMPTY = () => [[]];
const WILD_V = () => [[WILD]];

function concat(a, b) {
  const out = [];
  for (const x of a) for (const y of b) out.push([...x, ...y]);
  return out.length > MAX_VARIANTS ? WILD_V() : out;
}
function alt(a, b) {
  const out = [...a, ...b];
  return out.length > MAX_VARIANTS ? WILD_V() : out;
}

/** Fusionne les chaînes voisines, resserre les espaces, retire les jokers doublés. */
function tidy(variant) {
  const out = [];
  for (const p of variant) {
    const last = out[out.length - 1];
    if (isWild(p)) {
      if (!isWild(last)) out.push(WILD);
    } else if (typeof last === 'string') out[out.length - 1] = last + p;
    else out.push(p);
  }
  const cleaned = out
    .map((p) => (isWild(p) ? p : p.replace(/\s+/g, ' ')))
    .filter((p) => isWild(p) || p.length > 0);
  if (typeof cleaned[0] === 'string') cleaned[0] = cleaned[0].replace(/^\s+/, '');
  const n = cleaned.length - 1;
  if (typeof cleaned[n] === 'string') cleaned[n] = cleaned[n].replace(/\s+$/, '');
  return cleaned.filter((p) => isWild(p) || p.length > 0);
}

function dedupe(variants) {
  const seen = new Set();
  const out = [];
  for (const v of variants.map(tidy)) {
    const k = JSON.stringify(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

const display = (variant) =>
  variant.map((p) => (isWild(p) ? '…' : p)).join('').replace(/\s+/g, ' ').trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Motif (source d'expression régulière) qui reconnaît le nom accessible réel :
 * espaces souples, « … » pour ce qui dépend des données, ancré aux deux bouts.
 */
export function nameMatcher(variants) {
  const alts = variants.map((v) =>
    tidy(v)
      .map((p) => (isWild(p) ? '.*?' : escapeRe(p.trim()).replace(/\s+/g, '\\s+')))
      .join('\\s*')
  );
  return `^\\s*(?:${alts.join('|')})\\s*$`;
}

/* ---------- Lecture de l'arbre TSX ---------- */

const INTERACTIVE_ROLES = {
  button: 'bouton',
  link: 'lien',
  tab: 'onglet',
  switch: 'interrupteur',
  slider: 'curseur',
  checkbox: 'case',
  radio: 'bouton radio',
  menuitem: 'entrée de menu',
  option: 'option',
  combobox: 'liste',
  textbox: 'champ',
  spinbutton: 'champ',
};
const HANDLERS = /^on(Click|Change|Input|PointerDown|PointerUp|PointerMove|KeyDown|TouchStart|MouseDown|DoubleClick|Submit)$/;
const LINK_COMPONENTS = new Set(['Link', 'NextLink']);
const BUTTON_COMPONENTS = new Set(['Button', 'LkvButton']);
const SILENT_COMPONENTS = new Set(['Icon', 'LinesGlyph', 'svg']);

function tagName(el) {
  return el.tagName.getText();
}
function attrs(el) {
  return el.attributes.properties;
}
function getAttr(el, name) {
  for (const a of attrs(el)) {
    if (ts.isJsxAttribute(a) && a.name.getText() === name) {
      if (!a.initializer) return { kind: 'true' };
      if (ts.isStringLiteral(a.initializer)) return { kind: 'string', value: a.initializer.text, node: a.initializer };
      if (ts.isJsxExpression(a.initializer)) return { kind: 'expr', node: a.initializer.expression };
    }
  }
  return null;
}
function handlerNames(el) {
  const out = [];
  for (const a of attrs(el)) if (ts.isJsxAttribute(a) && HANDLERS.test(a.name.getText())) out.push(a.name.getText());
  return out;
}
function spreads(el) {
  return attrs(el)
    .filter((a) => ts.isJsxSpreadAttribute(a))
    .map((a) => a.expression.getText());
}
function openingOf(node) {
  if (ts.isJsxElement(node)) return node.openingElement;
  if (ts.isJsxSelfClosingElement(node)) return node;
  return null;
}

/** Fonction (composant) qui contient le nœud : la plus proche dont le nom commence par une majuscule. */
function enclosingComponent(node) {
  let fallback = null;
  for (let n = node.parent; n; n = n.parent) {
    let name = null;
    if (ts.isFunctionDeclaration(n) && n.name) name = n.name.text;
    else if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent))
      name = n.parent.name.getText();
    if (name) {
      if (/^[A-Z]/.test(name)) return { name, node: n };
      fallback ??= { name, node: n };
    }
  }
  return fallback ?? { name: '(module)', node: null };
}

/** Variables du composant initialisées par un crochet de geste (`const press = useLongPress(…)`). */
function gestureHooks(fnNode) {
  const out = new Map();
  if (!fnNode) return out;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)) {
      const callee = n.initializer.expression.getText();
      if (callee === 'useLongPress') out.set(n.name.getText(), 'appui long');
      if (callee === 'useDoubleTap') out.set(n.name.getText(), 'double-touche');
    }
    ts.forEachChild(n, visit);
  };
  visit(fnNode);
  return out;
}

function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return '';
}

function makeText(ctx) {
  const keyText = (keyNode, varsNode) => {
    if (!keyNode || !(ts.isStringLiteral(keyNode) || ts.isNoSubstitutionTemplateLiteral(keyNode))) return WILD_V();
    const key = keyNode.text;
    ctx.keys.push(key);
    const template = ctx.resolve(key);
    if (template == null) {
      ctx.missing.push(key);
      return [[`⟦${key}⟧`]];
    }
    const vars = new Map();
    if (varsNode && ts.isObjectLiteralExpression(varsNode)) {
      for (const p of varsNode.properties) {
        if (ts.isPropertyAssignment(p)) vars.set(p.name.getText(), expr(p.initializer));
        else if (ts.isShorthandPropertyAssignment(p)) vars.set(p.name.getText(), WILD_V());
      }
    }
    let acc = EMPTY();
    for (const part of template.split(/(\{[a-zA-Z0-9_]+\})/)) {
      const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(part);
      if (m) acc = concat(acc, vars.get(m[1]) ?? WILD_V());
      else if (part) acc = concat(acc, [[part]]);
    }
    return acc;
  };

  function expr(node) {
    if (!node) return EMPTY();
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [[node.text]];
    if (ts.isNumericLiteral(node)) return [[node.text]];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))
      return expr(node.expression);
    if (ts.isTemplateExpression(node)) {
      let acc = [[node.head.text]];
      for (const span of node.templateSpans) acc = concat(concat(acc, expr(span.expression)), [[span.literal.text]]);
      return acc;
    }
    if (ts.isConditionalExpression(node)) return alt(expr(node.whenTrue), expr(node.whenFalse));
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return alt(EMPTY(), expr(node.right));
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken)
        return alt(expr(node.left), expr(node.right));
      if (op === ts.SyntaxKind.PlusToken) return concat(expr(node.left), expr(node.right));
      return WILD_V();
    }
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      const a = node.arguments;
      if (name === 't') return keyText(a[0], a[1]);
      if (name === 'pl') return alt(keyText(a[1], a[3]), keyText(a[2], a[3]));
      if (name === 'countText') return alt(keyText(a[3], a[5]), keyText(a[4], a[5]));
      return WILD_V();
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return jsx(node);
    return WILD_V();
  }

  function jsxText(text) {
    if (!/\n/.test(text)) return text;
    // Règle de JSX : les lignes sont rognées et les lignes vides disparaissent.
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  }

  function children(list) {
    let acc = EMPTY();
    for (const c of list) {
      if (ts.isJsxText(c)) acc = concat(acc, [[jsxText(c.text)]]);
      else if (ts.isJsxExpression(c)) acc = concat(acc, c.expression ? expr(c.expression) : EMPTY());
      else acc = concat(acc, jsx(c));
    }
    return acc;
  }

  function jsx(node) {
    if (ts.isJsxFragment(node)) return children(node.children);
    const open = openingOf(node);
    if (!open) return EMPTY();
    const tag = tagName(open);
    if (SILENT_COMPONENTS.has(tag)) return EMPTY();
    const hidden = getAttr(open, 'aria-hidden');
    if (hidden && (hidden.kind === 'true' || hidden.value === 'true' || hidden.node?.getText() === 'true'))
      return EMPTY();
    if (getAttr(open, 'hidden')) return EMPTY();
    if (tag === 'img') {
      const altA = getAttr(open, 'alt');
      return altA ? attrText(altA) : EMPTY();
    }
    if (ts.isJsxSelfClosingElement(node)) return /^[A-Z]/.test(tag) ? WILD_V() : EMPTY();
    return children(node.children);
  }

  function attrText(a) {
    if (!a) return null;
    if (a.kind === 'string') return [[a.value]];
    if (a.kind === 'expr') return expr(a.node);
    return null;
  }

  return { expr, jsx, children, attrText };
}

const nonEmpty = (variants) => variants && variants.some((v) => tidy(v).length > 0);

/** Texte d'un <label> qui contient `inputNode` (sans le champ lui-même). */
function wrappingLabel(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isJsxElement(n) && tagName(n.openingElement) === 'label') return n;
    if (ts.isFunctionLike(n)) return null;
  }
  return null;
}

function labelsByFor(sourceFile) {
  const map = new Map();
  const visit = (n) => {
    if (ts.isJsxElement(n) && tagName(n.openingElement) === 'label') {
      const f = getAttr(n.openingElement, 'htmlFor');
      if (f?.kind === 'string') map.set(f.value, n);
    }
    ts.forEachChild(n, visit);
  };
  visit(sourceFile);
  return map;
}

/** Appel `.map(…)` englobant (et son receveur), pour les expansions de tables. */
function enclosingMap(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'map') {
      return n.expression.expression.getText();
    }
    if (ts.isFunctionDeclaration(n)) return null;
  }
  return null;
}

/**
 * Classes sûres des éléments HTML qui entourent le contrôle dans son composant
 * (`cp-sheet__h`, `cp-stepper`…) : elles départagent, à l'exécution, deux
 * contrôles au nom calculé (« … ») de la même étape.
 */
function ancestorClasses(node, stopAt) {
  const out = [];
  for (let n = node.parent; n && n !== stopAt; n = n.parent) {
    if (ts.isJsxElement(n) && /^[a-z]/.test(tagName(n.openingElement))) out.push(...classesOf(n.openingElement));
  }
  return [...new Set(out)];
}

function receiverMatches(receiverText, receiver) {
  const stripped = receiverText.replace(/^\(+|\)+$/g, '').trim();
  if (stripped === receiver) return true;
  return new RegExp(`(^|[^\\w.])${escapeRe(receiver)}([^\\w]|$)`).test(stripped);
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function kindOf(tag, el) {
  const role = getAttr(el, 'role');
  const roleV = role?.kind === 'string' ? role.value : null;
  if (roleV && INTERACTIVE_ROLES[roleV]) return { kind: INTERACTIVE_ROLES[roleV], role: roleV };
  if (tag === 'button' || BUTTON_COMPONENTS.has(tag)) return { kind: 'bouton', role: 'button' };
  if (tag === 'a' || LINK_COMPONENTS.has(tag)) return { kind: 'lien', role: 'link' };
  if (tag === 'textarea') return { kind: 'zone de texte', role: 'textbox' };
  if (tag === 'select') return { kind: 'liste', role: 'combobox' };
  if (tag === 'summary') return { kind: 'résumé', role: 'group' };
  if (tag === 'input') {
    const type = getAttr(el, 'type');
    const t = type?.kind === 'string' ? type.value : 'text';
    if (t === 'hidden') return null;
    if (t === 'checkbox') return { kind: 'case', role: 'checkbox', type: t };
    if (t === 'radio') return { kind: 'bouton radio', role: 'radio', type: t };
    if (t === 'range') return { kind: 'curseur', role: 'slider', type: t };
    if (t === 'submit' || t === 'button') return { kind: 'bouton', role: 'button', type: t };
    return { kind: 'champ', role: 'textbox', type: t };
  }
  return null;
}

function classesOf(el) {
  const c = getAttr(el, 'className');
  if (!c) return [];
  if (c.kind === 'string') return c.value.split(/\s+/).filter(Boolean);
  // Seules les classes TOUJOURS présentes comptent : la tête d'un gabarit
  // (`cp-thumb${…}` : « cp-thumb » n'est sûre que suivie d'un espace).
  const n = c.node;
  if (n && ts.isNoSubstitutionTemplateLiteral(n)) return n.text.split(/\s+/).filter(Boolean);
  if (n && ts.isTemplateExpression(n)) {
    const tokens = n.head.text.split(/\s+/);
    if (!/\s$/.test(n.head.text)) tokens.pop();
    return tokens.filter(Boolean);
  }
  return [];
}

/**
 * Extrait les contrôles d'une source TSX.
 * @param {string} source
 * @param {{ file: string, resolve: (key: string) => string | null,
 *   classify: (file: string, component: string) => ({ etape: string, ecran: string } | null),
 *   expansions?: Array<{ receiver: string, component?: string, items: Array<{ key: string, name: string, etape?: string, ecran?: string }> }>,
 *   delegating?: string[] }} opts
 */
export function extractControls(source, opts) {
  const { file, resolve, classify } = opts;
  const expansions = opts.expansions ?? [];
  const delegating = new Set(opts.delegating ?? ['Segments']);
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const forLabels = labelsByFor(sf);
  const out = [];
  const missing = [];
  const hooksCache = new Map();

  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const classifyOrThrow = (component) => {
    const c = classify(file, component);
    if (!c) throw new Error(`[inventaire] composant non classé : ${file} › ${component} (ajoute-le à la table des étapes)`);
    return c;
  };

  const push = (base, { variants, keys, extra = {} }) => {
    const v = dedupe(variants && nonEmpty(variants) ? variants : [[`[${base.classes[0] ?? base.tag}]`]]);
    const nameKey = extra.nameKey ?? keys[0] ?? (display(v[0]).includes('…') ? null : slug(display(v[0]))) ?? null;
    out.push({
      ...base,
      name: display(v[0]),
      variants: v.map(display),
      matcher: nameMatcher(v),
      nameKey: nameKey || (base.classes[0] ? `cls:${base.classes[0]}` : 'anonyme'),
      ...extra,
    });
  };

  const visit = (node) => {
    const el = openingOf(node);
    if (el) {
      const tag = tagName(el);
      const comp = enclosingComponent(node);
      const handlers = handlerNames(el);
      const sp = spreads(el);
      if (!hooksCache.has(comp.node)) hooksCache.set(comp.node, gestureHooks(comp.node));
      const hooks = hooksCache.get(comp.node);
      const gestureSpreads = sp.map((s) => hooks.get(s)).filter(Boolean);
      const ctx = { resolve, keys: [], missing };
      const text = makeText(ctx);

      const disabledA = getAttr(el, 'disabled');
      const disabled = disabledA ? (disabledA.kind === 'true' || disabledA.node?.getText() === 'true' ? 'toujours' : 'parfois') : undefined;

      const nameOf = (forInput) => {
        const label = text.attrText(getAttr(el, 'aria-label'));
        if (nonEmpty(label)) return label;
        if (forInput) {
          const idA = getAttr(el, 'id');
          const byFor = idA?.kind === 'string' ? forLabels.get(idA.value) : null;
          if (byFor) {
            const v = text.children(byFor.children);
            if (nonEmpty(v)) return v;
          }
          const wrap = wrappingLabel(node);
          if (wrap) {
            const v = text.children(wrap.children.filter((c) => c !== node));
            if (nonEmpty(v)) return v;
          }
        } else if (ts.isJsxElement(node)) {
          const v = text.children(node.children);
          if (nonEmpty(v)) return v;
        }
        const title = text.attrText(getAttr(el, 'title'));
        if (nonEmpty(title)) return title;
        const ph = text.attrText(getAttr(el, 'placeholder'));
        if (nonEmpty(ph)) return ph;
        return null;
      };

      const k = /^[a-z]/.test(tag) || LINK_COMPONENTS.has(tag) || BUTTON_COMPONENTS.has(tag) ? kindOf(tag, el) : null;
      const isInput = ['input', 'textarea', 'select'].includes(tag);
      const isDelegated = delegating.has(comp.name);
      const baseOf = (kind, role, extra = {}) => {
        const cls = classifyOrThrow(comp.name);
        return {
          file,
          line: lineOf(el),
          component: comp.name,
          etape: cls.etape,
          ecran: cls.ecran,
          kind,
          tag: LINK_COMPONENTS.has(tag) ? 'a' : BUTTON_COMPONENTS.has(tag) ? 'button' : tag,
          role,
          classes: classesOf(el),
          ancestors: ancestorClasses(node, comp.node),
          handlers,
          ...(disabled ? { disabled } : {}),
          ...(isDelegated ? { delegue: true } : {}),
          ...extra,
        };
      };

      // 1. Le contrôle lui-même (balise interactive, rôle, ou zone qui réagit au clic).
      let primary = null;
      if (k && (tag !== 'a' || getAttr(el, 'href') || handlers.length || LINK_COMPONENTS.has(tag))) {
        primary = { kind: k.kind, role: k.role, type: k.type };
      } else if (/^[a-z]/.test(tag) && (handlers.some((h) => /Click|KeyDown/.test(h)) || gestureSpreads.includes('appui long'))) {
        primary = { kind: 'zone cliquable', role: null };
      } else if (/^[a-z]/.test(tag) && handlers.some((h) => /Change|Input/.test(h))) {
        primary = { kind: 'champ', role: null };
      }

      const receiver = enclosingMap(node);
      const expansion =
        receiver &&
        expansions.find(
          (x) => receiverMatches(receiver, x.receiver) && (!x.component || x.component === comp.name) && (!x.file || x.file === file)
        );

      if (primary) {
        const variants = nameOf(isInput);
        const keys = [...ctx.keys];
        const base = baseOf(primary.kind, primary.role, primary.type ? { type: primary.type } : {});
        if (expansion) {
          for (const item of expansion.items) {
            push(
              { ...base, etape: item.etape ?? base.etape, ecran: item.ecran ?? base.ecran },
              { variants: [[item.name]], keys: [], extra: { nameKey: `${expansion.receiver}:${item.key}`, expansion: expansion.receiver } }
            );
          }
        } else push(base, { variants, keys });
      }

      // 2. Les gestes portés par l'élément.
      for (const g of gestureSpreads) {
        if (g === 'appui long' || g === 'double-touche') {
          const ctx2 = { resolve, keys: [], missing };
          const v = ts.isJsxElement(node) ? makeText(ctx2).children(node.children) : null;
          push(baseOf('geste', null, { gesture: g }), { variants: v, keys: ctx2.keys, extra: { nameKey: `geste:${g}:${ctx2.keys[0] ?? classesOf(el)[0] ?? 'ligne'}` } });
        }
      }
      if (/^[a-z]/.test(tag) && handlers.includes('onPointerMove')) {
        const lbl = text.attrText(getAttr(el, 'aria-label'));
        push(baseOf('geste', null, { gesture: 'glisser' }), {
          variants: nonEmpty(lbl) ? lbl : null,
          keys: [...ctx.keys],
          extra: { nameKey: `geste:glisser:${classesOf(el)[0] ?? 'zone'}` },
        });
      }
      if (tag === 'DoubleTapRow' && getAttr(el, 'onDouble')) {
        push(baseOf('geste', null, { gesture: 'double-touche' }), {
          variants: null,
          keys: [],
          extra: { nameKey: `geste:double-touche:${classesOf(el)[0] ?? 'ligne'}` },
        });
      }

      // 3. Les primitives qui multiplexent un même bouton (onglets <Segments>) : un contrôle par option.
      if (delegating.has(tag) && getAttr(el, 'onChange')) {
        const opt = getAttr(el, 'options');
        const groupCtx = { resolve, keys: [], missing };
        const group = makeText(groupCtx).attrText(getAttr(el, 'label'));
        const groupKey = groupCtx.keys[0] ?? 'groupe';
        const base = baseOf('onglet', 'button', { groupe: group ? display(dedupe(group)[0]) : null });
        const arr = opt?.kind === 'expr' ? opt.node : null;
        if (arr && ts.isArrayLiteralExpression(arr)) {
          for (const e of arr.elements) {
            if (!ts.isObjectLiteralExpression(e)) continue;
            const prop = (n) => e.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === n);
            const idP = prop('id');
            const labelP = prop('label');
            const c2 = { resolve, keys: [], missing };
            const v = labelP ? makeText(c2).expr(labelP.initializer) : null;
            const idText = idP ? idP.initializer.getText().replace(/['"`]/g, '').replace(/ as const$/, '') : String(out.length);
            push({ ...base, line: lineOf(e) }, { variants: v, keys: c2.keys, extra: { nameKey: `${groupKey}:${idText}` } });
          }
        } else {
          const recv = arr && ts.isCallExpression(arr) && ts.isPropertyAccessExpression(arr.expression) ? arr.expression.expression.getText() : null;
          const exp = recv && expansions.find((x) => receiverMatches(recv, x.receiver) && (!x.component || x.component === comp.name));
          if (exp) {
            for (const item of exp.items)
              push(
                { ...base, etape: item.etape ?? base.etape, ecran: item.ecran ?? base.ecran },
                { variants: [[item.name]], keys: [], extra: { nameKey: `${groupKey}:${item.key}`, expansion: exp.receiver } }
              );
          } else push(base, { variants: null, keys: [], extra: { nameKey: `${groupKey}:options` } });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // Identifiants stables : fichier::composant::balise::clé, rang si homonymes.
  const seen = new Map();
  for (const c of out) {
    const baseId = `${file}::${c.component}::${c.kind === 'geste' ? 'geste' : c.tag}::${c.nameKey}`;
    const n = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, n);
    c.id = n === 1 ? baseId : `${baseId}#${n}`;
  }
  if (opts.onMissingKeys && missing.length) opts.onMissingKeys([...new Set(missing)]);
  return out;
}
