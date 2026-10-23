import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, RUN_DIR, VERCEL_SHARE } from './_lib/env';

/** Prépare le dossier du passage et note ce qui est testé (sans jamais écrire le jeton). */
export default async function globalSetup() {
  fs.mkdirSync(path.join(RUN_DIR, 'coverage'), { recursive: true });
  fs.writeFileSync(
    path.join(RUN_DIR, 'passage.json'),
    JSON.stringify(
      {
        base: BASE_URL,
        apercu_protege: Boolean(VERCEL_SHARE),
        debut: new Date().toISOString(),
        workers: Number(process.env.COMPAS_WORKERS ?? 2),
      },
      null,
      2
    ) + '\n'
  );
  console.info(`[compas-full] passage → ${path.relative(process.cwd(), RUN_DIR)}`);
}
