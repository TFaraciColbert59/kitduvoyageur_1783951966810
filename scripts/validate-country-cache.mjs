#!/usr/bin/env node
/**
 * validate-country-cache.mjs
 *
 * Validates all .country-cache/*.json files for data integrity.
 * Implements Issue #8: Add data validation for country cache JSON files.
 *
 * Checks:
 * 1. Schema validation — required top-level fields present
 * 2. Temperature range checks — flag impossible values
 * 3. Precipitation vs temperature confusion — temp_max_c == precipitations_mm
 * 4. Duplicate FAQ questions within a country file
 *
 * Usage: node scripts/validate-country-cache.mjs
 * Exit code 0 = all valid, 1 = errors found
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(__dirname, '..', '.country-cache');

// Required top-level fields in a CountryDataV2 file
const REQUIRED_TOP_FIELDS = ['version', 'generated_at', 'valid_until', 'data'];

// Required fields inside data.pays
const REQUIRED_PAYS_FIELDS = ['nom', 'code_iso', 'continent'];

// Required fields inside data.meteo
const REQUIRED_METEO_FIELDS = ['calendar_12_mois', 'source'];

// Required fields inside each month entry
const REQUIRED_MONTH_FIELDS = ['mois', 'temp_min_c', 'temp_max_c', 'precipitations_mm', 'niveau', 'affluence'];

// Required fields inside data
const REQUIRED_DATA_SECTIONS = ['pays', 'meteo', 'securite', 'sante', 'connectivite', 'pratique', 'vols', 'carbone', 'evenements', 'lieux_incontournables', 'faq'];

// Temperature sanity thresholds
const TEMP_MAX_UPPER = 60;
const TEMP_MAX_LOWER = -50;
const TEMP_MIN_LOWER = -60;
const TEMP_MIN_UPPER = 40;

let hasErrors = false;
let errorCount = 0;
let warningCount = 0;

function error(file, msg) {
  console.error(`  ❌ ${file}: ${msg}`);
  hasErrors = true;
  errorCount++;
}

function warn(file, msg) {
  console.warn(`  ⚠️  ${file}: ${msg}`);
  warningCount++;
}

function validateFile(filePath, fileName) {
  console.log(`\n📋 Validating ${fileName}...`);

  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (e) {
    error(fileName, `Cannot read file: ${e.message}`);
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    error(fileName, `Invalid JSON: ${e.message}`);
    return;
  }

  // 1. Schema validation — top-level fields
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!(field in data)) {
      error(fileName, `Missing required top-level field: "${field}"`);
    }
  }

  if (!data.data) {
    error(fileName, '"data" section is missing entirely');
    return;
  }

  // Check required data sections
  for (const section of REQUIRED_DATA_SECTIONS) {
    if (!(section in data.data)) {
      error(fileName, `Missing required data section: "${section}"`);
    }
  }

  // Validate pays
  if (data.data.pays) {
    for (const field of REQUIRED_PAYS_FIELDS) {
      if (!(field in data.data.pays)) {
        error(fileName, `Missing pays.${field}`);
      }
    }
  }

  // 2. Temperature range checks + precipitation confusion
  if (data.data.meteo?.calendar_12_mois) {
    const months = data.data.meteo.calendar_12_mois;
    if (!Array.isArray(months)) {
      error(fileName, 'meteo.calendar_12_mois is not an array');
    } else {
      for (const month of months) {
        // Check required month fields
        for (const field of REQUIRED_MONTH_FIELDS) {
          if (!(field in month)) {
            error(fileName, `Month "${month.mois ?? '?'}" missing field: ${field}`);
          }
        }

        const tMax = month.temp_max_c;
        const tMin = month.temp_min_c;
        const precip = month.precipitations_mm;

        // Temperature range sanity
        if (typeof tMax === 'number') {
          if (tMax > TEMP_MAX_UPPER) {
            error(fileName, `${month.mois}: temp_max_c=${tMax} exceeds ${TEMP_MAX_UPPER}°C (likely data error)`);
          }
          if (tMax < TEMP_MAX_LOWER) {
            error(fileName, `${month.mois}: temp_max_c=${tMax} below ${TEMP_MAX_LOWER}°C (likely data error)`);
          }
        }

        if (typeof tMin === 'number') {
          if (tMin < TEMP_MIN_LOWER) {
            error(fileName, `${month.mois}: temp_min_c=${tMin} below ${TEMP_MIN_LOWER}°C (likely data error)`);
          }
          if (tMin > TEMP_MIN_UPPER) {
            error(fileName, `${month.mois}: temp_min_c=${tMin} above ${TEMP_MIN_UPPER}°C (likely data error)`);
          }
        }

        // temp_min should not be higher than temp_max
        if (typeof tMax === 'number' && typeof tMin === 'number' && tMin > tMax) {
          error(fileName, `${month.mois}: temp_min_c (${tMin}) > temp_max_c (${tMax})`);
        }

        // 3. Precipitation vs temperature confusion
        if (typeof tMax === 'number' && typeof precip === 'number' && tMax === precip) {
          error(fileName, `${month.mois}: temp_max_c (${tMax}) equals precipitations_mm (${precip}) — likely serialization error`);
        }
        if (typeof tMin === 'number' && typeof precip === 'number' && tMin === precip) {
          warn(fileName, `${month.mois}: temp_min_c (${tMin}) equals precipitations_mm (${precip}) — possible serialization error`);
        }
      }
    }
  }

  // 4. Duplicate FAQ questions
  if (data.data.faq && Array.isArray(data.data.faq)) {
    const seen = new Map();
    for (const entry of data.data.faq) {
      const q = entry.question?.toLowerCase().trim();
      if (!q) continue;
      if (seen.has(q)) {
        error(fileName, `Duplicate FAQ question: "${entry.question}"`);
      } else {
        seen.set(q, true);
      }
    }
  }

  // Validate lieux_incontournables has lat/lng
  if (data.data.lieux_incontournables && Array.isArray(data.data.lieux_incontournables)) {
    for (const lieu of data.data.lieux_incontournables) {
      if (!lieu.nom) warn(fileName, 'Un lieu incontournable sans nom');
      if (typeof lieu.lat !== 'number' || typeof lieu.lng !== 'number') {
        warn(fileName, `Lieu "${lieu.nom ?? '?'}" missing or invalid lat/lng`);
      }
    }
  }
}

// Main
console.log('🔍 Country Cache Validation');
console.log(`   Directory: ${cacheDir}`);

let files;
try {
  files = readdirSync(cacheDir).filter(f => f.endsWith('.json'));
} catch (e) {
  console.error(`\n❌ Cannot read .country-cache directory: ${e.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('\n⚠️  No .country-cache/*.json files found.');
  process.exit(0);
}

console.log(`   Found ${files.length} cache file(s)`);

for (const file of files) {
  validateFile(join(cacheDir, file), file);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${files.length} files checked, ${errorCount} error(s), ${warningCount} warning(s)`);

if (hasErrors) {
  console.log('\n❌ Validation FAILED');
  process.exit(1);
} else {
  console.log('\n✅ All country cache files are valid');
  process.exit(0);
}