import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(p))) files.push(p);
  }
}
walk('src');

const urls = new Set();
for (const f of files) {
  const content = readFileSync(f, 'utf8');
  for (const m of content.matchAll(/https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+[^"'`\s)]*/g)) {
    urls.add(m[0]);
  }
}

const list = [...urls];
const results = [];
async function check(u) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(u, { method: 'HEAD', signal: controller.signal });
    clearTimeout(t);
    results.push([res.status, u]);
  } catch (e) {
    results.push([`ERR ${e.name}`, u]);
  }
}
const CONC = 8;
for (let i = 0; i < list.length; i += CONC) {
  await Promise.all(list.slice(i, i + CONC).map(check));
}
results.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
for (const [status, u] of results) console.log(`${status} ${u}`);
console.log(`TOTAL ${list.length}`);
