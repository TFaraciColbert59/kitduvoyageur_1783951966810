// Manifeste : trace chaque entité créée pour le rapport, la vérification et
// le nettoyage chirurgical. Fichiers locaux, jamais versionnés.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './env.mjs';

function fileFor(batch) {
  return path.join(config.manifestDir, `${batch}.manifest.json`);
}

export function loadManifest(batch = config.seedBatch) {
  const file = fileFor(batch);
  if (!fs.existsSync(file)) {
    return {
      batch,
      version: 1,
      createdAt: new Date().toISOString(),
      epoch: config.seedEpoch || new Date().toISOString(),
      users: {},
      media: {},
      entities: {},
      counts: {},
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveManifest(manifest) {
  fs.mkdirSync(config.manifestDir, { recursive: true });
  fs.writeFileSync(fileFor(manifest.batch), JSON.stringify(manifest, null, 2));
}

export function register(manifest, table, ids, persona = null) {
  if (!manifest.entities[table]) manifest.entities[table] = [];
  for (const id of ids) {
    manifest.entities[table].push({ id, persona });
  }
}

export function registerUser(manifest, key, user) {
  manifest.users[key] = {
    id: user.id,
    email: user.email,
    created: Boolean(user.created),
  };
}

export function credentialsPath(batch = config.seedBatch) {
  return path.join(config.manifestDir, `${batch}.credentials.json`);
}

export function writeCredentials(batch, payload) {
  fs.mkdirSync(config.manifestDir, { recursive: true });
  const file = credentialsPath(batch);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* ignore */
  }
  return file;
}
