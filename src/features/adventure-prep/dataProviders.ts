/**
 * Sources reelles des donnees externes affichees a l utilisateur.
 *
 * Une seule source de verite, voluntarily : si l interface doit afficher
 * « Open-Meteo » a cote d une temperature, elle lit cette declaration. Elle
 * n invente pas un credit, et elle ne peut pas en afficher un qui ne
 * correspond pas a l appel reellement fait.
 *
 * Le credit ne se declare que sur des donnees reelles : une reponse en echec
 * ne cite personne, puisque personne n a produit de donnee.
 */

export type DataProvider = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
};

/**
 * Open-Meteo sert les deux series : la prevision journaliere
 * (`api.open-meteo.com/v1/forecast`) et l altitude du trace
 * (`api.open-meteo.com/v1/elevation`). Un seul objet, donc un seul credit
 * coherent a l ecran.
 */
const OPEN_METEO: DataProvider = Object.freeze({
  id: 'open-meteo',
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
});

/** Source de la meteo par jour de l aventure. */
export const METEO_PROVIDER: DataProvider = OPEN_METEO;

/** Source des altitudes reelles le long du trace. */
export const ELEVATION_PROVIDER: DataProvider = OPEN_METEO;