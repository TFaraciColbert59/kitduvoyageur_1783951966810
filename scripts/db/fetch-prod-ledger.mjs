import { Client } from 'pg';
import { writeFileSync } from 'node:fs';

const url = process.env.PROD_DB_URL;
if (!url) { console.error('PROD_DB_URL manquant'); process.exit(2); }
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
const { rows } = await client.query(
  `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`
);
const versions = rows.map((r) => r.version);
writeFileSync(process.argv[2], versions.join('\n') + '\n', 'utf8');
console.log(`LEDGER_ROWS=${versions.length} LAST=${versions[versions.length - 1]}`);
await client.end();
