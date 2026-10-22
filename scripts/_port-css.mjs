import fs from 'node:fs';
const html = fs.readFileSync('docs/compas/maquette-simplifiee.html', 'utf8');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
// 1) retire les commentaires d'ouverture et les @media spécifiques à la page
let out = css.replace(/\/\*[\s\S]*?\*\//g, '');
// 2) hex -> rgb()
const hex2rgb = (h) => { let x = h.slice(1); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); const n = parseInt(x, 16); return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255})`; };
out = out.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) => hex2rgb(m));
// 3) préfixe des classes dans les sélecteurs (texte avant « { »)
const prefixSel = (sel) => sel.replace(/\.([a-zA-Z_][\w-]*)/g, (m, c) => `.v5-${c}`);
let res = '';
let i = 0;
const depthStack = [];
while (i < out.length) {
  const open = out.indexOf('{', i);
  if (open < 0) { res += out.slice(i); break; }
  const head = out.slice(i, open);
  const trimmed = head.trim();
  if (trimmed.startsWith('@')) { res += head + '{'; i = open + 1; depthStack.push('at'); continue; }
  // trouve la fermeture
  let d = 1, j = open + 1;
  while (j < out.length && d > 0) { if (out[j] === '{') d++; else if (out[j] === '}') d--; j++; }
  const body = out.slice(open + 1, j - 1);
  // en-tête de règle : on est soit dans une at-rule (head se termine par des espaces/fermetures) soit au niveau racine
  const headFixed = head.replace(/^[\s}]+/, (m) => m);
  res += prefixSel(head) + '{' + body + '}';
  i = j;
}
fs.writeFileSync('docs/compas/_v5-port.css', res);
console.log(res.length);
