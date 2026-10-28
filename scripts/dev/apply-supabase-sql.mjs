#!/usr/bin/env node
/**
 * Applique un fichier SQL sur le projet Supabase LKDV via la Management API.
 * Usage : node scripts/dev/apply-supabase-sql.mjs supabase/migrations/xxx.sql
 *
 * Le jeton n'est jamais commité : il vient de SUPABASE_ACCESS_TOKEN, sinon
 * du cache d'authentification MCP local. Le script teste chaque jeton et
 * garde celui qui répond sur l'API Management.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'icxyvwzfjbflcbqukpfz';
const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error('usage: node scripts/dev/apply-supabase-sql.mjs <file.sql>');
  process.exit(2);
}

function candidateTokens() {
  const tokens = [];
  if (process.env.SUPABASE_ACCESS_TOKEN) tokens.push(process.env.SUPABASE_ACCESS_TOKEN);
  const dir = join(homedir(), '.dsh', 'mcp', 'auth', 'mcp-remote-v1');
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('_tokens.json')) continue;
      try {
        const token = JSON.parse(readFileSync(join(dir, file), 'utf8')).access_token;
        if (token) tokens.push(token);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return [...new Set(tokens)];
}

async function pickToken() {
  for (const token of candidateTokens()) {
    try {
      const res = await fetch('https://api.supabase.com/v1/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return token;
    } catch {
      /* ignore */
    }
  }
  throw new Error('Aucun jeton Management API Supabase valide trouvé.');
}

const token = await pickToken();
const query = readFileSync(sqlPath, 'utf8');

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text.slice(0, 2000));
  process.exit(1);
}
console.log(`OK ${sqlPath} (HTTP ${res.status})`);
if (text.trim()) console.log(text.slice(0, 1000));
