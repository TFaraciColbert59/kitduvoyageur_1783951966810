#!/usr/bin/env node
/**
 * Applique un fichier SQL sur la base Postgres LKDV via DATABASE_URL.
 * Usage : DATABASE_URL=postgresql://... node scripts/dev/apply-postgres-sql.mjs <file.sql>
 *
 * Le mot de passe n'est jamais affiché ni commité. SSL requis par Supabase.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
const sqlPath = process.argv[2];

if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(2);
}
if (!sqlPath) {
  console.error('usage: DATABASE_URL=... node scripts/dev/apply-postgres-sql.mjs <file.sql>');
  process.exit(2);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const query = readFileSync(sqlPath, 'utf8');

try {
  await client.connect();
  await client.query(query);
  console.log(`OK ${sqlPath}`);
} catch (error) {
  console.error(`FAIL ${sqlPath}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
