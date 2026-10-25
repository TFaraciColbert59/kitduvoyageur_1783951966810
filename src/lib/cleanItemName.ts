/**
 * Nettoyeur de noms d'équipement (pur, idempotent).
 *
 * Les noms issus du catalogue portent du bruit de seed : segment de catégorie
 * final (`—Catégorie-Vêtements`) et marque entre parenthèses (` (Marmot)`).
 * cleanItemName les retire, remplace les tirets consécutifs par des espaces et
 * compacte les espaces — sans toucher aux tirets simples légitimes
 * (« Anti-moustiques », « T-shirt ») ni aux parenthèses techniques
 * (« Sac de couchage (0°C) »). Idempotent : un nom propre reste inchangé.
 */

/**
 * Segment final « (Marque) » — parenthèses sans chiffre ni degré (pas « (0°C) »).
 * Bruit catalogue uniquement : BigBuy / Outdoor / Catégorie / suffixe hash.
 * Les descripteurs légitimes (« (Grand) ») sont préservés.
 */
const BRAND_NOISE = /BigBuy|Outdoor|Cat[ée]gorie/i;
const PAREN_TAIL = /\s*\((?:(?!\d)[^()])*\)\s*$/;

function isNoiseParen(content: string): boolean {
  return BRAND_NOISE.test(content) || content.length <= 3;
}

/** Segment final « —Catégorie-… » (dashes répétés avant et après « Catégorie »). */
const CATEGORY_TAIL = /\s*[-–—]{1,2}\s*Cat[ée]gorie\s*[:\-–—]?\s*\S.*$/i;

export function cleanItemName(raw: string): string {
  if (!raw) return '';
  let name = raw;

  // Boucle bornée : plusieurs segments de bruit peuvent se suivre en fin de nom.
  for (let i = 0; i < 3; i += 1) {
    const parenMatch = name.match(PAREN_TAIL);
    const cleaned =
      parenMatch && isNoiseParen(parenMatch[0])
        ? name.replace(PAREN_TAIL, '').replace(CATEGORY_TAIL, '')
        : name.replace(CATEGORY_TAIL, '');
    if (cleaned === name) break;
    name = cleaned;
  }

  return name
    .replace(/-{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
