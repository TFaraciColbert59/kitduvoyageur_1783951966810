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
  mesures: MeasureSpec[];
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
    /** Bandes horizontales de 64 px les plus différentes (surface). */
    hotspots: Array<{ y: number; h: number; ratio: number }>;
  };
  measures?: { total: number; ok: number; results: MeasureResult[] };
  files?: { app: string; maquette: string; diff: string };
  masques?: { app: string[]; maquette: string[] };
  durationMs: number;
}
