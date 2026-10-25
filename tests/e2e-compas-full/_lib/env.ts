import path from 'node:path';

/** Réglages du passage (voir `playwright.compas-full.config.ts`). */
export const BASE_URL = (process.env.COMPAS_BASE_URL ?? '').replace(/\/$/, '');
/** Jeton du lien partagé Vercel : lu dans l'environnement, jamais écrit dans un fichier. */
export const VERCEL_SHARE = process.env.VERCEL_SHARE ?? '';
export const RUN_DIR = process.env.COMPAS_RUN_DIR ?? path.join(process.cwd(), 'proof/compas-full/local');
/** Dossier commun à TOUS les passages : la file des préparations survit d'un passage à l'autre. */
export const LEDGER_DIR = path.join(process.cwd(), 'proof/compas-full');

/** Limite du site : 6 lancements de préparation par 10 minutes et par personne. */
export const PREP_PER_PERSON = Number(process.env.COMPAS_PREP_PER_PERSON ?? 6);
/** Plafond du banc, tous comptes réunis (ménage les quotas gratuits des services tiers). */
export const PREP_GLOBAL = Number(process.env.COMPAS_PREP_GLOBAL ?? 12);
export const PREP_WINDOW_MS = 10 * 60_000;

/** La phrase de référence (celle du parcours CI) : courte, en France, sans ambiguïté. */
export const REFERENCE_REQUEST = '3 jours de randonnée dans le Vercors à 2';
