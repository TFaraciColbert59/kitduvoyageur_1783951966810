/**
 * Import du catalogue kit « 80 Produits » (CSV BigBuy) — parseur PUR.
 *
 * Aucune I/O : reçoit les lignes brutes du CSV (en-tête BOM tolérée), déduplique
 * les groupes de SKU (priorité la plus forte puis `#` le plus bas, sans fusionner
 * d'autre champ), normalise les poids en grammes et corrige les catégories
 * connues. Le rapport liste les doublons, poids non numériques et corrections.
 */

export type KitCatalogPriority = 'indispensable' | 'recommande' | 'optionnel';

export interface ParsedKitProduct {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  priority: KitCatalogPriority;
  weightGrams: number | null;
  sellPriceEur: number | null;
  costPriceEur: number | null;
  marginPct: number | null;
  url: string | null;
}

export interface KitCatalogImportReport {
  duplicates: string[];
  nonNumericWeights: string[];
  categoryFixes: string[];
}

export interface ParsedKitCsv {
  products: ParsedKitProduct[];
  report: KitCatalogImportReport;
}

/** Corrections de catégorie actées (typo source → libellé canonique). */
const CATEGORY_FIXES: Record<string, string> = {
  'Randonée Famille': 'Randonnée Famille',
};

const PRIORITY_RANK: Record<KitCatalogPriority, number> = {
  indispensable: 3,
  recommande: 2,
  optionnel: 1,
};

interface ColumnMap {
  name: number;
  margin: number;
  category: number;
  brand: number;
  priority: number;
  sell: number;
  cost: number;
  sku: number;
  num: number;
  subcategory: number;
  url: number;
  weight: number;
}

const DEFAULT_COLUMNS: ColumnMap = {
  name: 0,
  margin: 1,
  category: 3,
  brand: 5,
  priority: 6,
  sell: 8,
  cost: 9,
  sku: 10,
  num: 14,
  subcategory: 15,
  url: 16,
  weight: 17,
};

/** Diacritiques retirés + apostrophes/° supprimés (ascii-safe). */
export function stripCatalogDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function slugifyCatalogValue(value: string): string {
  return stripCatalogDiacritics(value)
    .toLowerCase()
    .replace(/[’'°]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug de base (nom seul) — sert au rapprochement avec l'existant. */
export function kitProductBaseSlug(name: string): string {
  return slugifyCatalogValue(name);
}

/** Slug catalogue : kebab(lower(name)) suffixé par le SKU. */
export function buildKitProductSlug(name: string, sku: string): string {
  const base = slugifyCatalogValue(name);
  const suffix = slugifyCatalogValue(sku);
  return suffix ? `${base}-${suffix}` : base;
}

function normalizedHeaderCell(value: string): string {
  return stripCatalogDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function isHeaderRow(row: string[] | undefined): boolean {
  if (!row) return false;
  const cells = row.map((cell) => normalizedHeaderCell(String(cell ?? '')));
  return cells.includes('produit') && cells.some((cell) => cell.startsWith('sku'));
}

function columnsFromHeader(header: string[]): ColumnMap {
  const cells = header.map((cell) => normalizedHeaderCell(String(cell ?? '')));
  const find = (predicate: (cell: string) => boolean, fallback: number): number => {
    const index = cells.findIndex(predicate);
    return index >= 0 ? index : fallback;
  };
  return {
    name: find((cell) => cell === 'produit', DEFAULT_COLUMNS.name),
    margin: find((cell) => cell.startsWith('marge'), DEFAULT_COLUMNS.margin),
    category: find((cell) => cell === 'categorie', DEFAULT_COLUMNS.category),
    brand: find((cell) => cell === 'marque', DEFAULT_COLUMNS.brand),
    priority: find((cell) => cell.startsWith('priorite'), DEFAULT_COLUMNS.priority),
    sell: find((cell) => cell.startsWith('prix vente'), DEFAULT_COLUMNS.sell),
    cost: find((cell) => cell.startsWith('prix achat'), DEFAULT_COLUMNS.cost),
    sku: find((cell) => cell.startsWith('sku'), DEFAULT_COLUMNS.sku),
    num: find((cell) => cell === '#', DEFAULT_COLUMNS.num),
    subcategory: find((cell) => cell.startsWith('sous-categorie'), DEFAULT_COLUMNS.subcategory),
    url: find((cell) => cell.startsWith('url'), DEFAULT_COLUMNS.url),
    weight: find((cell) => cell.startsWith('poids'), DEFAULT_COLUMNS.weight),
  };
}

function cellAt(cells: string[], index: number): string {
  const value = cells[index];
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCatalogPriority(raw: string): KitCatalogPriority {
  const value = stripCatalogDiacritics(raw).toLowerCase();
  if (value.includes('indispensable')) return 'indispensable';
  if (value.includes('recommand')) return 'recommande';
  if (value.includes('optionnel')) return 'optionnel';
  return 'optionnel';
}

function parseCatalogNumber(raw: string): number | null {
  const value = raw.replace(/\s+/g, '').replace(/[%€]/g, '').replace(',', '.');
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** « 90 g », « 1.2 kg », « 250 g/unité », « 500 g/paire » → grammes. */
export function parseWeightGrams(raw: string): number | null {
  const value = stripCatalogDiacritics(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (value === '') return null;
  const kg = value.match(/^(\d+(?:[.,]\d+)?) ?kg$/);
  if (kg) return Math.round(Number(kg[1].replace(',', '.')) * 1000);
  const grams = value.match(/^(\d+(?:[.,]\d+)?) ?g(?:\/(?:unite|paire))?$/);
  if (grams) return Math.round(Number(grams[1].replace(',', '.')));
  return null;
}

interface Candidate {
  product: ParsedKitProduct;
  rank: number;
  num: number;
}

/**
 * Parse les lignes CSV (avec ou sans en-tête) et déduplique par SKU.
 * Règle de dédup : priorité la plus forte puis `#` le plus bas ; rien d'autre
 * n'est fusionné (l'URL du gagnant est conservée telle quelle).
 */
export function parseKitCsv(rows: string[][]): ParsedKitCsv {
  const report: KitCatalogImportReport = {
    duplicates: [],
    nonNumericWeights: [],
    categoryFixes: [],
  };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { products: [], report };
  }

  const hasHeader = isHeaderRow(rows[0]);
  const columns = hasHeader ? columnsFromHeader(rows[0]) : DEFAULT_COLUMNS;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const groups = new Map<string, Candidate>();
  const groupCounts = new Map<string, number>();

  for (const raw of dataRows) {
    if (!Array.isArray(raw)) continue;
    const cells = raw.map((cell) => String(cell ?? ''));
    const sku = cellAt(cells, columns.sku);
    if (sku === '') continue;

    const rawWeight = cellAt(cells, columns.weight);
    const weightGrams = parseWeightGrams(rawWeight);
    if (rawWeight !== '' && weightGrams === null) {
      report.nonNumericWeights.push(rawWeight);
    }

    let category = cellAt(cells, columns.category) || 'Autre';
    const fix = CATEGORY_FIXES[category];
    if (fix && fix !== category) {
      const entry = `${category} → ${fix}`;
      if (!report.categoryFixes.includes(entry)) report.categoryFixes.push(entry);
      category = fix;
    }

    const name = cellAt(cells, columns.name);
    const product: ParsedKitProduct = {
      sku,
      slug: buildKitProductSlug(name, sku),
      name,
      brand: cellAt(cells, columns.brand),
      category,
      subcategory: cellAt(cells, columns.subcategory),
      priority: parseCatalogPriority(cellAt(cells, columns.priority)),
      weightGrams,
      sellPriceEur: parseCatalogNumber(cellAt(cells, columns.sell)),
      costPriceEur: parseCatalogNumber(cellAt(cells, columns.cost)),
      marginPct: parseCatalogNumber(cellAt(cells, columns.margin)),
      url: cellAt(cells, columns.url) || null,
    };

    const rank = PRIORITY_RANK[product.priority];
    const parsedNum = Number(cellAt(cells, columns.num));
    const num = Number.isFinite(parsedNum) ? parsedNum : Number.POSITIVE_INFINITY;
    groupCounts.set(sku, (groupCounts.get(sku) ?? 0) + 1);

    const current = groups.get(sku);
    if (!current) {
      groups.set(sku, { product, rank, num });
    } else if (rank > current.rank || (rank === current.rank && num < current.num)) {
      groups.set(sku, { product, rank, num });
    }
  }

  for (const [sku, count] of groupCounts) {
    if (count > 1) report.duplicates.push(sku);
  }

  return {
    products: [...groups.values()].map((candidate) => candidate.product),
    report,
  };
}
