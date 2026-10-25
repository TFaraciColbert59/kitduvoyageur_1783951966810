// Compas — console de test visuelle. Zéro dépendance.
//
//   npm run compas:console        puis ouvrir http://localhost:4747 (s'ouvre tout seul sous Windows)
//
// Gros boutons, une barre de progression par épreuve, un journal en direct, un bouton Stop.
// Le jeton de l'aperçu Vercel reste en mémoire : il n'est jamais écrit dans un fichier.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.COMPAS_CONSOLE_PORT ?? 4747);
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const countLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0);
const phrasesOf = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).length;

const JOBS = {
  unit: {
    emoji: '🧪',
    title: 'Tests rapides',
    sub: 'Typage + 4 500 tests du moteur. 2 minutes, aucun réseau.',
    needsUrl: false,
  },
  fe: {
    emoji: '🇫🇷',
    title: 'Jeu France / Europe',
    sub: '50 demandes de vrais voyageurs, lues sur l’aperçu.',
    needsUrl: true,
    file: 'docs/compas/phase7/demandes-france-europe.json',
  },
  monde: {
    emoji: '🌍',
    title: 'Jeu monde',
    sub: '50 demandes partout sur la planète, toutes langues.',
    needsUrl: true,
    file: 'docs/compas/phase7/demandes-monde.json',
  },
  banc: {
    emoji: '📱',
    title: 'Banc d’écran',
    sub: 'Les 303 contrôles : chaque bouton, chaque étape, sur téléphone.',
    needsUrl: true,
  },
};

/** @type {{job:string|null, child:any, log:string[], progress:number, label:string, startedAt:number, result:string|null, dir:string|null, total:number}} */
const run = { job: null, child: null, log: [], progress: 0, label: '', startedAt: 0, result: null, dir: null, total: 0 };
const clients = new Set();
const push = (type, data) => {
  const msg = `data: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const c of clients) c.write(msg);
};
const line = (s) => {
  for (const l of String(s).split(/\r?\n/)) {
    const t = l.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trimEnd();
    if (!t) continue;
    run.log.push(t);
    if (run.log.length > 400) run.log.shift();
    push('log', { line: t });
    const pw = /\[(\d+)\/(\d+)\]|^\s*(\d+) of (\d+)|(\d+)\/(\d+)\s*(?:\(|—|$)/.exec(t);
    if (run.job === 'banc' && pw) {
      const done = Number(pw[1] ?? pw[3] ?? pw[5]);
      const tot = Number(pw[2] ?? pw[4] ?? pw[6]);
      if (tot > 0) setProgress(done / tot, `${done} / ${tot} contrôles`);
    }
  }
};
function setProgress(p, label) {
  run.progress = Math.max(0, Math.min(1, p));
  run.label = label;
  push('progress', { progress: run.progress, label });
}
const state = () => ({
  job: run.job,
  running: !!run.child,
  progress: run.progress,
  label: run.label,
  result: run.result,
  startedAt: run.startedAt,
  log: run.log.slice(-120),
});

function start(job, url, share) {
  if (run.child) return { error: 'Une épreuve tourne déjà.' };
  const def = JOBS[job];
  if (!def) return { error: 'Épreuve inconnue.' };
  if (def.needsUrl && !/^https?:\/\//.test(url ?? '')) return { error: 'Colle d’abord l’adresse de l’aperçu à tester.' };
  Object.assign(run, { job, log: [], progress: 0, label: 'Démarrage…', result: null, startedAt: Date.now(), dir: null, total: 0 });
  const env = { ...process.env };
  if (share) env.VERCEL_SHARE = share;
  let cmd;
  let args;
  let watch = null;
  if (job === 'unit') {
    cmd = 'npx';
    args = ['vitest', 'run', 'src/features/compas', '--reporter=dot'];
  } else if (job === 'banc') {
    env.COMPAS_BASE_URL = url;
    env.COMPAS_WORKERS = '1';
    env.COMPAS_RUN_DIR = path.join(ROOT, 'proof/compas-full', `console-${stamp()}`);
    run.dir = env.COMPAS_RUN_DIR;
    cmd = process.execPath;
    args = ['scripts/compas/run-bench.mjs', '--reporter=line'];
  } else {
    run.dir = path.join(ROOT, 'proof/compas', `console-${job}-${stamp()}`);
    run.total = phrasesOf(def.file);
    cmd = process.execPath;
    args = ['scripts/compas/validate-online.mjs', url, def.file, run.dir];
    watch = setInterval(() => {
      const n = countLines(path.join(run.dir, 'results.jsonl'));
      setProgress(n / run.total, `${n} / ${run.total} demandes`);
    }, 3000);
  }
  line(`▶ ${def.title}`);
  const child = spawn(cmd, args, { cwd: ROOT, env, shell: cmd === 'npx' && process.platform === 'win32' });
  run.child = child;
  push('state', state());
  child.stdout.on('data', line);
  child.stderr.on('data', line);
  child.on('close', (code) => {
    if (watch) clearInterval(watch);
    run.child = null;
    const stopped = run.result === 'stop';
    let summary = code === 0 ? 'Terminé' : `Terminé avec des échecs (code ${code})`;
    if (job === 'unit') {
      const m = run.log.join('\n').match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed/);
      if (m) summary = m[1] ? `❌ ${m[1]} test(s) en échec, ${m[2]} réussis` : `✅ ${m[2]} tests réussis`;
    } else if (run.dir) {
      const n = countLines(path.join(run.dir, 'results.jsonl'));
      if (n) summary += ` · ${n} résultat(s) dans ${path.relative(ROOT, run.dir)}`;
    }
    run.result = stopped ? 'Arrêté' : summary;
    if (!stopped && code === 0) setProgress(1, 'Fini');
    line(`■ ${run.result}`);
    push('state', state());
  });
  return { ok: true };
}

function stop() {
  if (!run.child) return;
  run.result = 'stop';
  if (process.platform === 'win32') exec(`taskkill /pid ${run.child.pid} /T /F`);
  else run.child.kill('SIGTERM');
}

/** Dernier score connu de chaque épreuve, lu dans proof/ (le plus récent dossier). */
function history() {
  const latest = (base, test) => {
    const d = path.join(ROOT, base);
    if (!fs.existsSync(d)) return null;
    const dirs = fs.readdirSync(d).map((n) => path.join(d, n)).filter((p) => fs.statSync(p).isDirectory() && test(p));
    dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return dirs[0] ?? null;
  };
  const out = {};
  const phrases = (job, re) => {
    const d = latest('proof/compas', (p) => re.test(path.basename(p)) && fs.existsSync(path.join(p, 'results.jsonl')));
    if (!d) return;
    const rows = fs.readFileSync(path.join(d, 'results.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const ok = rows.filter((r) => /Ton aventure est prête/.test(r.head ?? '')).length;
    out[job] = { text: `${ok} / ${rows.length} prêtes`, good: ok === rows.length, when: fs.statSync(d).mtimeMs };
  };
  phrases('fe', /-fe$|france/i);
  phrases('monde', /monde/i);
  const b = latest('proof/compas-full', (p) => fs.existsSync(path.join(p, 'coverage-report.json')));
  if (b) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(b, 'coverage-report.json'), 'utf8'));
      const v = j.global?.verifies, n = j.global?.total;
      if (v != null && n) out.banc = { text: `${v} / ${n} contrôles vérifiés`, good: v === n, when: fs.statSync(b).mtimeMs };
    } catch {}
  }
  return out;
}

const PAGE = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'console.html'), 'utf8');

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(PAGE.replace('__JOBS__', JSON.stringify(JOBS)));
    }
    if (u.pathname === '/history') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(history()));
    }
    if (u.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      clients.add(res);
      res.write(`data: ${JSON.stringify({ type: 'state', ...state() })}\n\n`);
      return req.on('close', () => clients.delete(res));
    }
    if (u.pathname === '/run' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => (body += d));
      return req.on('end', () => {
        let b = {};
        try {
          b = JSON.parse(body || '{}');
        } catch {}
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(start(b.job, b.url, b.share)));
      });
    }
    if (u.pathname === '/stop' && req.method === 'POST') {
      stop();
      res.writeHead(200);
      return res.end('{}');
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Console de test du Compas : ${url}`);
    if (process.platform === 'win32' && !process.env.CI) exec(`start "" ${url}`);
  });
