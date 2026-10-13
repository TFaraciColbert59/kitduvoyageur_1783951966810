import { seedReferential } from './support/seed.mjs';

/** Pose le référentiel des lieux habités de la zone dans la base éphémère (idempotent). */
export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('[e2e compas] DATABASE_URL est requis.');
  seedReferential(databaseUrl);
}
