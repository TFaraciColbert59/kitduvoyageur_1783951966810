// Préflight : aucune écriture avant d'avoir vérifié que chaque colonne lue
// existe réellement. Évite les insertions à l'aveugle sur un schéma qui a bougé.
import { db } from './client.mjs';

const cache = new Map();

export async function assertColumns(table, columns) {
  const key = `${table}:${columns.join(',')}`;
  if (cache.has(key)) return;
  const { error } = await db.from(table).select(columns.join(',')).limit(0);
  if (error) {
    throw new Error(
      `Préflight ${table} — colonne manquante ou table absente.\n  colonnes: ${columns.join(', ')}\n  erreur: ${error.message}`
    );
  }
  cache.set(key, true);
}

export async function assertTables(registry) {
  const entries = Object.entries(registry);
  for (const [table, columns] of entries) {
    await assertColumns(table, columns);
  }
  return entries.length;
}

export function registerColumns(registry, table, columns) {
  registry[table] = [...new Set([...(registry[table] || []), ...columns])];
}
