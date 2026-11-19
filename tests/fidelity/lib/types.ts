/**
 * Banc de fidélité — types partagés (scénarios, étapes, mesures, résultats).
 *
 * Les étapes sont déclaratives (sérialisables) : le rapport JSON recopie la
 * recette exacte jouée dans l'app et dans la maquette.
 */

export type Locate =
  | { css: string; nth?: number }
  | { role: string; name: string; exact?: boolean; within?: string; nth?: number }
  | { text: string; within?: string; nth?: number };

export type Step =
  | { click: Locate }
  | { longPress: Locate }
  | { fill: Locate; value: string }
  | { press: string }
  | { wait: number }
  | { waitFor: Locate }
  | { eval: string };

export type FidelityRole = 'participant' | 'visiteur' | 'membre' | 'invite';
export type FidelitySurface = 'communaute' | 'carnet';

export interface MeasureSpec {
  /** Libellé lisible de l'élément mesuré. */
  id: string;
  /** Sélecteur CSS dans l'app. */
  app: string;
  /** Sélecteur CSS dans la maquette. */
  maquette: string;
  /** Propriétés CSS calculées à comparer (px ±1, couleurs exactes). */
  props?: string[];
  /** Compare aussi x / y / largeur / hauteur, relatifs au cadre. */
  rect?: boolean;
}

export interface MockOptions {
  state?: 'ok' | 'empty' | 'error';
  failRpcs?: string[];
  latencyMs?: number;
}

export interface Scenario {
  id: string;
  surface: FidelitySurface;
  /** Écran (ex. « Explorer · carnets »). */
  ecran: string;
  /** État (ex. « chargé », « vide », « erreur »). */
  etat: string;
  role: FidelityRole;
  app: {
    url: string;
    /** Session synthétique : `member` (propriétaire / participant) ou `anonymous`. */
    session: 'member' | 'anonymous';
    mock?: MockOptions;
    /**
     * Réponses de RPC remplacées pour ce scénario (données d'exemple alignées sur celles de la
     * maquette : le banc compare une structure, pas des jeux de données différents).
     */
    rpc?: Record<string, unknown>;
    /**
     * Prévision `/api/weather` par latitude (4 décimales) : la météo des tuiles de sorties de la
     * maquette est une donnée par sortie (`tmin`, `tmax`, état), pas celle, unique, du mock.
     */
    weather?: Record<string, { label: string; code: number; tMaxC: number; tMinC: number }>;
    /**
     * Brouillons de création posés avant le chargement (`lkdv.cv2-draft:<type>:v1`) : l'étape
     * restaurée est l'étape ouverte, sans valider les précédentes (valeurs vides, comme la maquette).
     */
    drafts?: Record<string, number>;
    /** Élément dont l'hydratation React conditionne les étapes (sélecteur CSS). */
    hydrate?: string;
    /** Horloge figée de la page (ISO) ; sinon l'horloge du banc Communauté. */
    now?: string;
    /** Ne pas attendre l'hydratation : capture d'un état de chargement. */
    noHydrate?: boolean;
    steps: Step[];
    /** Sélecteur du cadre applicatif (sinon la fenêtre entière). */
    frame?: string;
    /** Cadre utilisé à partir de 768 px de large (colonne centrée de l'app face au téléphone de la maquette). */
    frameWide?: string;
  };
  maquette: {
    /** Chemin relatif à la racine du dépôt. */
    file: string;
    /** Fragment d'URL (deep link de la maquette). */
    hash?: string;
    steps: Step[];
    /** Cadre de la maquette (le téléphone). */
    frame: string;
  };
  /** Zones légitimement différentes (données réelles, carte, chrome de l'app). */
  masques: { app: string[]; maquette: string[] };
  /**
   * Fond neutralisé (voir `lib/neutral.ts`) : même aplat uni derrière le tiroir des deux
   * côtés, et comparaison limitée à la zone du tiroir. Absent : capture brute, plein cadre.
   */
  neutre?: { app: { sheet: string; root: string; keep?: string[]; hide?: string[] }; maquette: { sheet: string; root: string; keep?: string[]; hide?: string[] } };
  mesures: MeasureSpec[];
  /**
   * Textes de données alignés sur ceux de la maquette (banc uniquement) : le n-ième élément `app`
   * reçoit le texte du n-ième élément `maquette`. Les textes sont déjà masqués du diff ; seule la
   * mise en page (retours à la ligne, hauteurs de tuile) dépend de leur longueur.
   */
  alignerTextes?: Array<{ app: string; maquette: string }>;
  /** État que l'app ou la maquette ne permet pas d'atteindre : raison écrite. */
  nonAtteignable?: { app?: string; maquette?: string };
}

export interface MeasureValue {
  rect?: { x: number; y: number; w: number; h: number };
  style: Record<string, string>;
}

export interface MeasureResult {
  id: string;
  prop: string;
  app: string | null;
  maquette: string | null;
  ok: boolean;
  /** Écart numérique en px quand les deux valeurs sont des longueurs. */
  delta?: number;
  note?: string;
}

export interface FidelityResult {
  scenario: string;
  surface: FidelitySurface;
  ecran: string;
  etat: string;
  role: FidelityRole;
  project: string;
  viewport: { width: number; height: number };
  theme: 'clair' | 'sombre';
  status: 'ok' | 'ecart' | 'non-atteignable' | 'erreur';
  reason?: string;
  pixel?: {
    compared: { w: number; h: number };
    appFrame: { w: number; h: number };
    maquetteFrame: { w: number; h: number };
    diffPixels: number;
    maskedPixels: number;
    totalPixels: number;
    ratio: number;
    threshold: number;
    ok: boolean;
    /** Zone comparée quand le fond est neutralisé (boîte du tiroir, en px du cadre). */
    zone?: { x: number; y: number; w: number; h: number; fondNeutre: string };
    /** Bandes horizontales de 64 px les plus différentes (surface). */
    hotspots: Array<{ y: number; h: number; ratio: number }>;
  };
  measures?: { total: number; ok: number; results: MeasureResult[] };
  files?: { app: string; maquette: string; diff: string };
  masques?: { app: string[]; maquette: string[] };
  durationMs: number;
}
