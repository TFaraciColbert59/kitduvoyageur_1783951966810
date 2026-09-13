#!/usr/bin/env node
/**
 * Import du catalogue kit (CSV « Produits - Kit du Voyageur – 80 Produits B »)
 * vers `shop_products` (service-role, `.env.local`).
 *
 * - Parse pur via `src/features/trips/domain/kitCatalogImport.ts` (type stripping Node).
 * - Dédup par SKU : priorité la plus forte puis `#` le plus bas (67 produits uniques).
 * - Upsert par `slug` : les slugs existants sont PRÉSERVÉS (les règles de
 *   `contextualKitEngine.preferredProductSlug` matchent ces slugs canoniques) ;
 *   la formule kebab(nom)+'-'+SKU ne sert qu'aux insertions nouvelles.
 * - `cost_price_eur` reste en base (interne) : jamais renvoyé au client.
 *
 * Usage :
 *   node scripts/catalogue/import-kit-products.mjs [--dry-run] [--csv=<path>] [--report=<path>]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  parseKitCsv,
  kitProductBaseSlug,
  stripCatalogDiacritics,
} from '../../src/features/trips/domain/kitCatalogImport.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_CSV = 'Produits - Kit du Voyageur – 80 Produits B.csv';
const DEFAULT_REPORT = 'docs/catalogue/import-rapport.md';

const ESSENTIALITY = {
  indispensable: 'Indispensable',
  recommande: 'Recommandé',
  optionnel: 'Optionnel',
};

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function loadEnvLocal() {
  const env = {};
  const text = readFileSync(resolve(REPO_ROOT, '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_0-9]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

/** Lecteur CSV minimal (guillemets doublés, champs multi-lignes, BOM). */
function parseCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

function normalizedName(value) {
  return stripCatalogDiacritics(String(value ?? '')).trim().toLowerCase();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const csvPath = resolve(REPO_ROOT, argValue('csv', DEFAULT_CSV));
  const reportPath = resolve(REPO_ROOT, argValue('report', DEFAULT_REPORT));

  const rows = parseCsvText(readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''));
  const { products, report } = parseKitCsv(rows);

  const env = loadEnvLocal();
  const require = createRequire(`${REPO_ROOT}/package.json`);
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const countRows = async () => {
    const { count } = await supabase
      .from('shop_products')
      .select('id', { count: 'exact', head: true });
    return count ?? 0;
  };

  const beforeCount = await countRows();
  const { data: existingRows, error: existingError } = await supabase
    .from('shop_products')
    .select('id, slug, product_id, name');
  if (existingError) throw new Error(`Lecture shop_products impossible: ${existingError.message}`);

  const byProductId = new Map();
  const bySlug = new Map();
  const byName = new Map();
  for (const row of existingRows ?? []) {
    if (row.product_id != null) byProductId.set(String(row.product_id), row);
    bySlug.set(String(row.slug), row);
    byName.set(normalizedName(row.name), row);
  }

  const now = new Date().toISOString();
  let updated = 0;
  let inserted = 0;
  const preservedSlugs = [];

  const payloads = products.map((product) => {
    const numericSku = /^\d+$/.test(product.sku);
    const matched =
      (numericSku ? byProductId.get(product.sku) : null) ??
      bySlug.get(kitProductBaseSlug(product.name)) ??
      byName.get(normalizedName(product.name)) ??
      null;

    if (matched) {
      updated++;
      if (matched.slug !== product.slug) {
        preservedSlugs.push({ sku: product.sku, keep: matched.slug, computed: product.slug });
      }
    } else {
      inserted++;
    }

    return {
      product_id: numericSku ? product.sku : matched?.product_id ?? null,
      slug: matched?.slug ?? product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category,
      category_main: product.category,
      category_sub: product.subcategory,
      weight_g: product.weightGrams ?? 0,
      weight_grams: product.weightGrams ?? 0,
      price_eur: product.sellPriceEur ?? 0,
      cost_price_eur: product.costPriceEur ?? 0,
      supplier: 'BigBuy',
      ean: '',
      essentiality: ESSENTIALITY[product.priority] ?? 'Recommandé',
      available: true,
      is_active: true,
      import_date: now,
      updated_at: now,
    };
  });

  if (!dryRun) {
    const { error: upsertError } = await supabase
      .from('shop_products')
      .upsert(payloads, { onConflict: 'slug' });
    if (upsertError) throw new Error(`Upsert shop_products impossible: ${upsertError.message}`);
  }

  const afterCount = dryRun ? beforeCount : await countRows();
  const { data: samples } = await supabase
    .from('shop_products')
    .select('slug, name, category, weight_g, price_eur, cost_price_eur, essentiality, product_id, supplier')
    .in('slug', [
      payloads[0]?.slug,
      'baton-trekking-aktive-telescopique-135-cm',
      'trousse-de-premiers-secours-kerbl-80929',
      'lanterne-led-pour-la-tete-tm-electron',
      'poncho-impermeable-pluie-categorie-bigbuy',
    ].filter(Boolean));

  const summary = {
    csvRows: rows.length - 1,
    uniqueProducts: products.length,
    duplicates: report.duplicates,
    nonNumericWeights: report.nonNumericWeights,
    categoryFixes: report.categoryFixes,
    beforeCount,
    afterCount,
    updated,
    inserted,
    dryRun,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log('Échantillons:');
  for (const sample of samples ?? []) console.log(JSON.stringify(sample));

  if (!dryRun) {
    const lines = [
      '# Import catalogue kit — rapport brut',
      '',
      `- Source : \`${argValue('csv', DEFAULT_CSV)}\``,
      `- Date d'exécution : ${now}`,
      `- Lignes CSV (hors en-tête) : ${summary.csvRows}`,
      `- Produits uniques après dédup SKU : ${summary.uniqueProducts}`,
      `- \`shop_products\` avant : ${beforeCount} — après : ${afterCount}`,
      '',
      '> ⚠️ Ce rapport contient des prix d’achat (`cost_price_eur`) internes.',
      '> Ne jamais les exposer dans du code client (les loaders ne sélectionnent',
      '> que les colonnes publiques : slug, name, brand, price_eur, weight_g, …).',
      '',
      '## Dédup (11 groupes SKU)',
      '',
      `- SKU dédupliqués : ${report.duplicates.join(', ') || 'aucun'}`,
      '- Règle : priorité la plus forte (Indispensable > Recommandé > Optionnel)',
      '  puis `#` le plus bas ; aucun autre champ fusionné (URL du gagnant seule).',
      '',
      '## Poids non numériques → NULL (reportés)',
      '',
      `- Valeurs : ${report.nonNumericWeights.join(', ') || 'aucune'}`,
      `- Total : ${report.nonNumericWeights.length}`,
      '',
      '## Corrections de catégorie',
      '',
      `- ${report.categoryFixes.join(' ; ') || 'aucune'}`,
      '',
      '## Mapping upsert',
      '',
      `- Lignes existantes mises à jour (slug préservé) : ${updated}`,
      `- Insertions nouvelles (slug = kebab(nom)-SKU) : ${inserted}`,
      `- Upsert \`onConflict: slug\` — slugs préservés pour continuer de matcher`,
      '  `contextualKitEngine.preferredProductSlug` (design §3).',
      '',
      '## Échantillons (preuve brute)',
      '',
      '```json',
      JSON.stringify(samples ?? [], null, 2),
      '```',
      '',
    ];

    if (preservedSlugs.length > 0) {
      lines.push('## Slugs préservés (existant ≠ formule)', '', '```json',
        JSON.stringify(preservedSlugs, null, 2), '```', '');
    }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.log(`Rapport écrit : ${reportPath}`);
  }
}

main().catch((error) => {
  console.error('[import-kit-products] échec:', error.message);
  process.exitCode = 1;
});
