// Micro-grammaire francaise pour les titres d etapes.
//
// Un seul besoin reel :.concatener un article avec un nom propre sans ecrire
// « Retour de Argentiere ». Le module ne fait QUE de la typographie, il ne
// touche ni a la donnee, ni au sens, ni au nom lui-meme.

// Voyelles francaises, accentuees ou non. Le y compte aussi. Les accents sont
// ecrits en echappement Unicode pour que la regle ne depende pas de
// l encodage du fichier.
const VOYELLE = /^[\u0061\u0065\u0069\u006f\u0075\u0079\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u00ff]/i;

// Le h muet se reconnait a sa position : suivi d une voyelle, il disparait
// (l homme, d hotel). Suivi d une consonne, il s entend et ne s elide pas.
const H_MUET = /^h[\u0061\u0065\u0069\u006f\u0075\u0079\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u00ff]/i;

// Exceptions ou le h est ASPPIRE : il s entend et garde l article plein.
//
// Cette liste est lexicale par nature, donc volontairement explicite. Elle
// est amorcee avec les mots de la TOPIQUE du produit (geographie francaise :
// Haute-Savoie, Hautes-Alpes, Haut-Béarn...) parce que ce sont ceux que la
// preparation rencontre reellement. Ajouter un mot aspiré revient a ajouter
// une entree ici, pas a modifier la regle generale.
//
// Les cles sont des PREFIXES de trois lettres : un seul « hau » couvre Haut,
// Haute, Hautes et Hautbois, la ou quatre entrees distinctes seraient
// fragiles a maintenir.
const H_ASPIRE = new Set([
  'hai',
  'hal',
  'ham',
  'har',
  'hau',
  'hoc',
]);

// Retire quotes et espaces de bord pour n analyser que la forme du nom.
function premiereForme(nom: string): string {
  return nom.trim().replace(/^[\s\u0027\u2019-]+/, '');
}

// de(Argentiere) renvoie d Argentiere, de(Chamonix) renvoie de Chamonix.
// Un nom deja elide n est pas re-elide (de L Argentiere). Un nom vide ne
// laisse pas d article traignant.
export function de(nom: string): string {
  const propre = premiereForme(nom);
  if (propre.length === 0) return 'de';

  const aspire = H_ASPIRE.has(propre.slice(0, 3).toLowerCase());
  const elide = !aspire && (VOYELLE.test(propre) || H_MUET.test(propre));

  return elide ? `d'${propre}` : `de ${propre}`;
}
