/**
 * Clés de comparaison des noms de lieux, toutes écritures (PLAN-100 6.4). Fonctions pures.
 *
 * La clé latine du Compas (`plainName`, `plain`) retire accents et casse puis change tout ce qui
 * n'est pas `a-z0-9` en espace : un nom en cyrillique, arabe, chinois, grec ou devanagari y devient
 * « », si bien que deux noms non latins quelconques passaient pour égaux (ou qu'aucun ne se
 * retrouvait). `matchKey` garde cette clé latine À L'IDENTIQUE dès qu'elle n'est pas vide (aucun
 * nom qui a une lettre latine ne change de clé) ; sinon, la clé de l'écriture d'origine
 * (`scriptKey`). Aucune translittération : « Москва » ne vaut jamais « Moskva », on compare
 * seulement le nom à lui-même écrit autrement (casse, signes diacritiques).
 */

const COMBINING = /[̀-ͯ]/g;
/**
 * Signes qui ne changent pas le nom : marques héritées (voyelles courtes et hamza arabes,
 * dakuten séparés par la décomposition, antiliant), et le tatweel arabe (allongement).
 */
const SOFT_MARKS = /[\p{Script=Inherited}ـ]/gu;
/** Une lettre, une marque ou un chiffre d'une écriture autre que latine. */
const OTHER_SCRIPT_CHAR = /[\p{L}\p{M}\p{N}]/u;
const LATIN_OR_COMMON = /[\p{Script=Latin}\p{Script=Common}]/u;

/** La clé latine d'avant, inchangée (la même que `plainName` de `places.ts`). */
function latinKey(v: string): string {
  return v.normalize('NFD').replace(COMBINING, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * La clé d'un nom dans son écriture : minuscules, signes diacritiques retirés, ponctuation en
 * espaces ; les lettres non latines restent (`a-z0-9` aussi). Latin hors `a-z` (« ø », « ł ») :
 * espace, comme la clé latine.
 */
export function scriptKey(v: string): string {
  const s = v.normalize('NFD').replace(COMBINING, '').replace(SOFT_MARKS, '').toLowerCase();
  let out = '';
  for (const ch of s) {
    const keep = /[a-z0-9]/.test(ch) || (OTHER_SCRIPT_CHAR.test(ch) && !LATIN_OR_COMMON.test(ch));
    out += keep ? ch : ' ';
  }
  return out.replace(/ +/g, ' ').trim();
}

/** Clé de comparaison : la clé latine d'avant si elle existe, sinon celle de l'écriture d'origine. */
export function matchKey(v: string): string {
  return latinKey(v) || scriptKey(v);
}
