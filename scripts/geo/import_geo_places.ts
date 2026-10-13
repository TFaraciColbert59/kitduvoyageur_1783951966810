// scripts/geo/import_geo_places.ts — Remplit public.geo_places (plan 3.2).
//
// Étape reproductible pour une base neuve (ou le réimport mensuel) :
//   1. Télécharger depuis https://download.geonames.org/export/dump/ :
//      cities500.zip, FR.zip, CH.zip, IT.zip, AT.zip ; les dézipper dans un dossier.
//   2. python3 -I scripts/geo/prep_geo_places.py <dossier> geo_places.tsv
//   3. npx tsx scripts/geo/import_geo_places.ts geo_places.tsv
//      (NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement)
//
// Upsert idempotent sur geoname_id, par lots de 1 000. Licence GeoNames
// CC BY 4.0 (créditée dans les mentions légales). Rien n'est supprimé : un lieu
// retiré de GeoNames reste jusqu'à un nettoyage décidé à part.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as readline from "readline";

const KINDS = new Set(["city", "town", "village", "hamlet"]);
const BATCH = 1000;

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!file || !url || !key) {
    console.error("Usage : npx tsx scripts/geo/import_geo_places.ts <geo_places.tsv> (URL et clé de service dans l'environnement)");
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const lines = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  let batch: Record<string, unknown>[] = [];
  let total = 0;
  let skipped = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await supabase.from("geo_places").upsert(batch, { onConflict: "geoname_id" });
    if (error) throw new Error(`lot refusé après ${total} lieux : ${error.message}`);
    total += batch.length;
    batch = [];
    if (total % 20_000 === 0) console.info(`${total} lieux`);
  };

  for await (const line of lines) {
    if (!line) continue;
    const c = line.split("\t");
    const id = num(c[0]);
    const lat = num(c[5]);
    const lon = num(c[6]);
    if (id === null || lat === null || lon === null || !c[1] || !KINDS.has(c[2]) || (c[3] ?? "").length !== 2) {
      skipped += 1;
      continue;
    }
    const ele = num(c[7]);
    batch.push({
      geoname_id: id,
      name: c[1],
      kind: c[2],
      country_code: c[3],
      admin1: c[4] || null,
      lat,
      lon,
      ele_m: ele !== null && ele > -500 && ele < 9000 ? Math.round(ele) : null,
      population: Math.max(0, Math.round(num(c[8]) ?? 0)),
      timezone: c[9] || null,
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  console.info(`Fini : ${total} lieux écrits, ${skipped} lignes écartées.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
