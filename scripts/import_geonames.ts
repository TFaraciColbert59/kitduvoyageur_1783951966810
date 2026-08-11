// scripts/import_geonames.ts — Import des fichiers officiels GeoNames
// dans Supabase (pays, admin1, admin2, lieux, noms alternatifs).
//
// Usage :
//   npx tsx scripts/import_geonames.ts --countries countryInfo.txt
//   npx tsx scripts/import_geonames.ts --admin1 admin1CodesASCII.txt
//   npx tsx scripts/import_geonames.ts --admin2 admin2Codes.txt
//   npx tsx scripts/import_geonames.ts --places allCountries.txt
//   npx tsx scripts/import_geonames.ts --altnames alternateNamesV2.txt
//
// Politique : ZÉRO MOCK. Les champs absents restent NULL ; les colonnes
// avec DEFAULT conservent leur valeur par défaut.
// Idempotent : upsert sur geoname_id (et iso_a2 pour les pays).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as readline from "readline";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Identifiants Supabase manquants. Définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (ex: .env.local)."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 500;

/** Parse une ligne TSV GeoNames (tabulations, champs vides possibles). */
function parseCsvLine(line: string): string[] {
  return line.split("\t");
}

/**
 * Upsert d'un lot de lignes (idempotent via ON CONFLICT).
 * @param table Table cible
 * @param rows Lignes à écrire
 * @param onConflict Colonnes de conflit (ex: "geoname_id")
 */
async function upsertBatch(table: string, rows: Record<string, unknown>[], onConflict: string) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`Erreur upsert ${table} (${rows.length} lignes) :`, error.message);
    return false;
  }
  console.log(`Upsert OK : ${rows.length} lignes dans ${table}`);
  return true;
}

/** Récupère les ids des pays existants (évite le N+1). */
async function fetchCountryIdsByIso(isoCodes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(isoCodes)];
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data, error } = await supabase
      .from("countries_geo")
      .select("id, iso_a2")
      .in("iso_a2", chunk);
    if (error) throw error;
    (data ?? []).forEach((row) => map.set(row.iso_a2, row.id));
  }
  return map;
}

/**
 * Import des pays — countryInfo.txt
 * https://download.geonames.org/export/dump/countryInfo.txt
 */
async function importCountries(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const batch: Record<string, unknown>[] = [];
  for await (const line of rl) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [iso, iso3, isoNumeric, fips, country, capital, area, population, continent, tld, currencyCode, currencyName, phone, postalCodeFormat, postalCodeRegex, languages, geonameId, neighbours] = parseCsvLine(line);
    if (!iso || !country) continue;
    batch.push({
      iso_a2: iso,
      name: country,
      name_ascii: country,
      capital: capital || null,
      continent: continent || null,
      population: parseInt(population, 10) || null,
      area_km2: parseFloat(area) || null,
      iso_a3: iso3 || null,
      iso_numeric: isoNumeric || null,
      fips_code: fips || null,
      tld: tld || null,
      phone_code: phone || null,
      currency_code: currencyCode || null,
      currency_name: currencyName || null,
      postal_code_format: postalCodeFormat || null,
      postal_code_regex: postalCodeRegex || null,
      languages: languages ? languages.split(",") : [],
      geoname_id: parseInt(geonameId, 10) || null,
      neighbours: neighbours ? neighbours.split(",") : [],
    });
    if (batch.length >= BATCH_SIZE) {
      if (!(await upsertBatch("countries_geo", batch, "iso_a2"))) return;
      batch.length = 0;
    }
  }
  if (batch.length) await upsertBatch("countries_geo", batch, "iso_a2");
}

/**
 * Import des régions admin niveau 1 — admin1CodesASCII.txt
 * https://download.geonames.org/export/dump/admin1CodesASCII.txt
 * Format : adminCode1 (XX.01) \t name \t nameAscii \t geonameId
 */
async function importAdminRegions(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const rows: Record<string, unknown>[] = [];
  const isoCodes: string[] = [];
  for await (const line of rl) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [code, name, nameAscii, geonameId] = parseCsvLine(line);
    const [countryCode, adminCode] = code.split(".");
    if (!countryCode || !adminCode || !name) continue;
    rows.push({
      country_iso_a2: countryCode,
      admin_code: adminCode,
      admin_code_full: code,
      name,
      name_ascii: nameAscii || null,
      level: 1,
      geoname_id: parseInt(geonameId, 10) || null,
    });
    isoCodes.push(countryCode);
    if (rows.length >= BATCH_SIZE) {
      await flushAdminRegions(rows, isoCodes);
    }
  }
  if (rows.length) await flushAdminRegions(rows, isoCodes);
}

/**
 * Import des régions admin niveau 2 — admin2Codes.txt
 * https://download.geonames.org/export/dump/admin2Codes.txt
 * Format : adminCode2 (XX.01.02) \t name \t nameAscii \t geonameId
 * Le parent (admin1) est retrouvable via le préfixe XX.01.
 */
async function importAdmin2Regions(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const rows: Record<string, unknown>[] = [];
  const isoCodes: string[] = [];
  for await (const line of rl) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [code, name, nameAscii, geonameId] = parseCsvLine(line);
    const parts = code.split(".");
    const [countryCode, admin1Code, admin2Code] = parts;
    if (!countryCode || !admin2Code || !name) continue;
    rows.push({
      country_iso_a2: countryCode,
      admin_code: admin2Code,
      admin_code_full: code,
      admin1_code_full: parts.slice(0, 2).join("."),
      name,
      name_ascii: nameAscii || null,
      level: 2,
      geoname_id: parseInt(geonameId, 10) || null,
    });
    isoCodes.push(countryCode);
    if (rows.length >= BATCH_SIZE) {
      await flushAdminRegions(rows, isoCodes);
    }
  }
  if (rows.length) await flushAdminRegions(rows, isoCodes);
}

/** Écrit un lot de régions admin en résolvant country_id par lot (pas de N+1). */
async function flushAdminRegions(rows: Record<string, unknown>[], isoCodes: string[]) {
  const countryIds = await fetchCountryIdsByIso(isoCodes);
  const enriched = rows.map((row) => ({
    ...row,
    country_id: countryIds.get(row.country_iso_a2 as string) ?? null,
  }));
  await upsertBatch("admin_regions_geo", enriched, "geoname_id");
  rows.length = 0;
  isoCodes.length = 0;
}

/** Flag "grande ville" : seuil raisonnable pour le globe (150 000 hab). */
const MAJOR_CITY_POPULATION = 150000;

/**
 * Import des lieux (villes, capitales…) — allCountries.txt
 * https://download.geonames.org/export/dump/allCountries.zip
 * Colonnes : geonameId, name, asciiname, alternatenames, latitude,
 * longitude, feature class, feature code, country code, cc2,
 * admin1 code, admin2 code, admin3 code, admin4 code, population,
 * elevation, dem, timezone, modification date.
 */
async function importPlaces(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const batch: Record<string, unknown>[] = [];
  let skipped = 0;
  for await (const line of rl) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const f = parseCsvLine(line);
    const [geonameId, name, nameAscii, , latitude, longitude, featureClass, featureCode, countryCode, , admin1Code, admin2Code, admin3Code, admin4Code, population, elevation, , timezone] = f;
    if (!geonameId || !name) continue;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    // Filtre : lieux habités uniquement (classe P), hors lignes sans coordonnées valides.
    if (featureClass !== "P" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      skipped++;
      continue;
    }
    const pop = parseInt(population, 10) || 0;
    batch.push({
      geoname_id: parseInt(geonameId, 10),
      name,
      name_ascii: nameAscii || null,
      feature_class: featureClass || null,
      feature_code: featureCode || null,
      country_iso_a2: countryCode || null,
      admin1_code: admin1Code || null,
      admin2_code: admin2Code || null,
      admin3_code: admin3Code || null,
      admin4_code: admin4Code || null,
      latitude: lat,
      longitude: lng,
      population: pop || null,
      population_rank: pop > 0 ? Math.max(1, Math.round(Math.log10(pop))) : null,
      is_capital: featureCode === "PPLC",
      is_major_city: pop >= MAJOR_CITY_POPULATION,
      elevation: elevation ? parseInt(elevation, 10) || null : null,
      timezone: timezone || null,
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
    if (batch.length >= BATCH_SIZE) {
      if (!(await upsertBatch("places_geo", batch, "geoname_id"))) return;
      batch.length = 0;
    }
  }
  if (batch.length) await upsertBatch("places_geo", batch, "geoname_id");
  console.log(`Lieux ignorés (hors classe P / coordonnées invalides) : ${skipped}`);
}

/** Langues conservées pour les noms alternatifs (recherche multilingue). */
const KEPT_LANGS = new Set([
  "fr", "en", "es", "de", "it", "pt", "nl", "ru", "zh", "ar", "ja", "ko",
  "pl", "tr", "vi", "th", "el", "sv", "no", "da", "fi", "cs", "hu", "ro",
  "uk", "hi", "id", "fa",
]);

/**
 * Import des noms alternatifs — alternateNamesV2.txt
 * https://download.geonames.org/export/dump/alternateNamesV2.zip
 * Colonnes : alternateNameId, geonameId, isolanguage, alternate name,
 * isPreferredName, isShortName, isColloquial, isHistoric, from, to
 * Filtre : langues conservées + noms préférés/courts (volume maîtrisé).
 */
async function importAltNames(filePath: string) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const batch: Record<string, unknown>[] = [];
  let skipped = 0;
  for await (const line of rl) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const [altNameId, geonameId, lang, altName, isPreferred, isShort, isColloquial, isHistoric] = parseCsvLine(line);
    if (!altNameId || !altName) {
      skipped++;
      continue;
    }
    const keepLang = lang === "" || KEPT_LANGS.has(lang);
    const keepFlag = isPreferred === "1" || isShort === "1";
    if (!keepLang && !keepFlag) {
      skipped++;
      continue;
    }
    batch.push({
      alternate_name_id: parseInt(altNameId, 10),
      geoname_id: parseInt(geonameId, 10) || null,
      lang: lang || null,
      name: altName,
      is_preferred: isPreferred === "1",
      is_short_name: isShort === "1",
      is_colloquial: isColloquial === "1",
      is_historic: isHistoric === "1",
    });
    if (batch.length >= BATCH_SIZE) {
      if (!(await upsertBatch("place_names_geo", batch, "alternate_name_id"))) return;
      batch.length = 0;
    }
  }
  if (batch.length) await upsertBatch("place_names_geo", batch, "alternate_name_id");
  console.log(`Noms alternatifs ignorés (langue/flag hors filtre) : ${skipped}`);
}

/** Point d'entrée : sélection du sous-ensemble via --flag <fichier>. */
async function main() {
  const args = process.argv.slice(2);
  const jobs: { flag: string; label: string; fn: (p: string) => Promise<void> }[] = [
    { flag: "--countries", label: "pays", fn: importCountries },
    { flag: "--admin1", label: "régions admin 1", fn: importAdminRegions },
    { flag: "--admin2", label: "régions admin 2", fn: importAdmin2Regions },
    { flag: "--places", label: "lieux", fn: importPlaces },
    { flag: "--altnames", label: "noms alternatifs", fn: importAltNames },
  ];

  let ran = false;
  for (const job of jobs) {
    const idx = args.indexOf(job.flag);
    if (idx >= 0 && args[idx + 1]) {
      ran = true;
      console.log(`Import ${job.label} : ${args[idx + 1]}`);
      await job.fn(args[idx + 1]);
    }
  }
  if (!ran) {
    console.error(
      "Usage : tsx scripts/import_geonames.ts --countries <fichier> [--admin1 <fichier>] [--admin2 <fichier>] [--places <fichier>] [--altnames <fichier>]"
    );
    process.exit(1);
  }
  console.log("Import terminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});