/**
 * E8 — l image d etape, ou son absence assumee.
 *
 * Une photo de lieu est une AFFIRMATION : « voici ce que vous allez voir ».
 * Le preparateur fait partout le contraire d affirmer ce qu il ne sait pas
 * (« a verifier » plutot qu un chiffre, « aucune alternative » plutot qu un
 * exemple). Une image trouvee par recherche approximative, sans auteur ni
 * licence, serait exactement le mensonge que le reste du produit refuse de
 * faire — en plus gros, et sur la tuile qui donne envie de partir.
 *
 * D ou la source, et pourquoi :
 *
 *   1. Wikimedia Commons, et rien d autre. C est une base de medias libres ou
 *      chaque fichier porte son auteur et sa licence, donc une image y est
 *      attribuable. Une source sans ces deux champs serait refusee, meme si
 *      elle rendait une URL d image parfaite.
 *   2. Un nom de lieu, jamais une latitude. Une recherche par coordonnees
 *      ramene le batiment d a cote ; une recherche par nom ramene le lieu, et
 *      reste lisible a la source.
 *   3. HTTPS obligatoire. Une URL en clair sur une tuile de preparation
 *      laisserait un tiers injecter ce qu il veut dans la page.
 *
 * Ce que ce module ne fait PAS, volontairement :
 *
 *   - il ne choisit pas une image «jolie » parmi plusieurs : il prend la
 *     premiere que la source rend, et dit laquelle. Tricher sur la pertinence
 *     serait inventer ;
 *   - il ne retient pas d image dont l auteur ou la licence manque : le
 *     credits est ce qui rend l image licitement affichable.
 *
 * L absence se dit par `null`. Elle ne se comble jamais par une image de
 * substitution, une icone, ni une URL de banque d images : ce serait une
 * photographie qui ne montre pas le lieu, donc une autre forme de mensonge.
 */

/**
 * Le type lui-meme vit dans `types.ts` : une image est une donnee de domaine,
 * pas une particularite de ce moteur. Il est re-exporte ici parce que c est
 * depuis ce module qu on l obtient — un import par un seul chemin, pas deux
 * conventions cohabitant.
 */
export type { StepImage } from '../types';
import type { StepImage } from '../types';

/** Les options d une recherche. Injectables, sinon aucun test n est hermetique. */
export interface StepImageOptions {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
}

const API_COMMONS = 'https://commons.wikimedia.org/w/api.php';
const LARGEUR = 640;

/**
 * Le cache, module et par nom normalise.
 *
 * Un programme de trois jours interroge trois fois le meme lieu — la tuile, le
 * tiroir, la page de detail. Sans cache, la source voit trois requetes pour la
 * meme question, et sur un reseau lent la tuile attend trois fois.
 */
const CACHE = new Map<string, Promise<StepImage | null>>();

/** Un test qui substitue la source la remet ensuite, sinon il herite du cache. */
export function __resetStepImageCache(): void {
  CACHE.clear();
}

/** Le HTML de Commons est du balisage ; un credit est du texte. */
function texteBrut(html: unknown): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** La cle de cache : le nom normalise, insensible a la casse et aux espaces. */
function cleDe(nom: string): string {
  return nom.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * L URL de recherche, en pieces lisibles.
 *
 * Exposee pour etre verifiee telle quelle : une requete qu on ne peut pas
 * controler depuis un test est une requete dont personne ne controle rien.
 */
export function stepImageQuery(nom: string): string {
  return (
    `${API_COMMONS}?action=query&format=json&origin=*` +
    `&generator=search&gsrnamespace=6&gsrlimit=1` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${LARGEUR}` +
    `&gsrsearch=${encodeURIComponent(nom)}`
  );
}

/** La forme qu on accepte de la source. Tout le reste vaut `null`. */
interface CommonsResponse {
  readonly query?: {
    readonly pages?: Record<string, CommonsPage | undefined>;
  };
}

interface CommonsPage {
  readonly pageid?: number | undefined;
  readonly imageinfo?: readonly CommonsImageInfo[] | undefined;
}

interface CommonsImageInfo {
  readonly thumburl?: unknown;
  readonly descriptionurl?: unknown;
  readonly extmetadata?: Record<string, { readonly value?: unknown } | undefined> | undefined;
}

/**
 * Accepte une page seulement si elle porte TOUT ce qui rend une image
 * affichable de facon licite : HTTPS, auteur, licence, page de source.
 *
 * Quatre filtres, dont aucun n est negociable. Une image qui en manque un seul
 * ne se montre pas : c est moins grave qu une image qui n est pas ce qu elle
 * dit etre.
 */
function lireImage(page: CommonsPage | undefined): StepImage | null {
  const info = page?.imageinfo?.[0];
  if (!info) return null;

  const url = typeof info.thumburl === 'string' ? info.thumburl : '';
  if (!url.startsWith('https://')) return null;

  const meta = info.extmetadata ?? {};
  const credit = texteBrut(meta.Artist?.value);
  const license = texteBrut(meta.LicenseShortName?.value);
  if (credit === '' || license === '') return null;

  const sourceUrl = typeof info.descriptionurl === 'string' ? info.descriptionurl : '';
  if (!sourceUrl.startsWith('https://')) return null;

  return { url, credit, license, sourceUrl };
}

/**
 * Cherche une image pour un lieu, ou `null`.
 *
 * Une source muete, une reponse vide, une image sans attribution : trois
 * entrees, une seule sortie. `null` signifie « on ne sait pas », jamais
 * « il n y en a pas » — les deux se distinguent ailleurs, et l.ui doit dire
 * lequel des deux elle montre.
 *
 * Le resultat est memorise, y compris quand il vaut `null` : un lieu sans photo
 * ne doit pas etre redemande a chaque rendu de la tuile.
 */
export function fetchStepImage(
  nom: string,
  options: StepImageOptions = {},
): Promise<StepImage | null> {
  const cle = cleDe(nom);
  // Un nom vide ne part jamais sur le reseau : la source ne rendrait qu un
  // resultat arbitraire, et le memoriser contaminerait le cache.
  if (cle === '') return Promise.resolve(null);

  const dejaVu = CACHE.get(cle);
  if (dejaVu !== undefined) return dejaVu;

  const requete = (async (): Promise<StepImage | null> => {
    const faire = options.fetchImpl ?? fetch;
    if (options.signal?.aborted === true) return null;

    try {
      const reponse = await faire(stepImageQuery(nom), {
        signal: options.signal,
        headers: { accept: 'application/json' },
      });
      if (!reponse.ok) return null;
      const corps = (await reponse.json()) as CommonsResponse;
      const pages = corps.query?.pages;
      if (pages === undefined) return null;

      // La source ne garantit aucun ordre : on prend la page de plus petit
      // identifiant, qui est celle que `generator=search` classe en premier.
      const premiere = Object.values(pages)
        .filter((page): page is CommonsPage => page !== undefined)
        .sort((a, b) => (a.pageid ?? 0) - (b.pageid ?? 0))[0];

      return lireImage(premiere);
    } catch {
      // Une source qui ne repond pas n est pas une source qui ment : elle est
      // muette. On rend `null` et on laisse l ecran dire l incertitude.
      return null;
    }
  })();

  CACHE.set(cle, requete);
  return requete;
}