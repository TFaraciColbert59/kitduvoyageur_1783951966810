/**
 * Sources reelles des donnees externes affichees a l utilisateur.
 *
 * Une seule source de verite, voluntarily : si l interface doit afficher
 * « MET Norway » a cote d une temperature, elle lit cette declaration. Elle
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
 * Prevision journaliere : MET Norway (CC BY 4.0, usage commercial permis),
 * lue au format Open-Meteo par `src/lib/weather/metnoCompat.ts`.
 */
const MET_NORWAY: DataProvider = Object.freeze({
  id: 'met-norway',
  name: 'MET Norway',
  url: 'https://api.met.no/',
});

/** Altitudes : Terrain Tiles (Mapzen / AWS Open Data), sans cle ni quota. */
const TERRAIN_TILES: DataProvider = Object.freeze({
  id: 'terrain-tiles',
  name: 'Terrain Tiles (Mapzen / AWS Open Data)',
  url: 'https://registry.opendata.aws/terrain-tiles/',
});

/** Source de la meteo par jour de l aventure. */
export const METEO_PROVIDER: DataProvider = MET_NORWAY;

/** Source des altitudes reelles le long du trace. */
export const ELEVATION_PROVIDER: DataProvider = TERRAIN_TILES;
