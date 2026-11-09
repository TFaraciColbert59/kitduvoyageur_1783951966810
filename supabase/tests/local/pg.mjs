// Résolution souple du pilote Postgres : `pg` du projet, sinon PG_MODULE, sinon
// l'installation locale de validation. Aucune dépendance ajoutée au dépôt.
let mod;
try {
  mod = await import('pg');
} catch {
  mod = await import(process.env.PG_MODULE ?? '/tmp/pgtest/node_modules/pg/lib/index.js');
}
export default mod.default ?? mod;
