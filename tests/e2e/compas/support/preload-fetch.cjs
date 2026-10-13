// Préchargé dans le processus `next start` du test E2E (NODE_OPTIONS=--require …).
// AUCUN code de l'application ne change : c'est le lanceur du test qui décide.
//
// - `fetch` vers un hôte non local est réécrit vers le serveur de doublures
//   (`/__ext/<schéma>/<hôte>/<chemin>`), qui sert une capture réelle, répond
//   « en panne » ou signale l'appel imprévu ;
// - `http.request` / `https.request` vers un hôte non local lèvent une erreur :
//   une bibliothèque qui contournerait `fetch` ne peut pas atteindre un vrai service.
'use strict';

const doubles = process.env.E2E_DOUBLES_URL;
if (!doubles) {
  throw new Error('[e2e] E2E_DOUBLES_URL est requis pour le préchargement réseau du test.');
}

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const isLocalHost = (h) => LOCAL.has(String(h || '').toLowerCase());

const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = function e2eFetch(input, init) {
  let raw;
  if (typeof input === 'string') raw = input;
  else if (input instanceof URL) raw = input.href;
  else if (input && typeof input.url === 'string') raw = input.url;
  else return realFetch(input, init);

  let u;
  try {
    u = new URL(raw);
  } catch {
    return realFetch(input, init);
  }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || isLocalHost(u.hostname)) {
    return realFetch(input, init);
  }
  const target = `${doubles}/__ext/${u.protocol.slice(0, -1)}/${u.host}${u.pathname}${u.search}`;
  if (typeof input === 'string' || input instanceof URL) return realFetch(target, init);
  // Une Request : même méthode, mêmes en-têtes, même corps, autre adresse.
  return realFetch(new Request(target, input), init);
};

for (const name of ['http', 'https']) {
  const mod = require(name);
  for (const fn of ['request', 'get']) {
    const original = mod[fn];
    mod[fn] = function guarded(...args) {
      const a0 = args[0];
      let host = null;
      if (typeof a0 === 'string') {
        try {
          host = new URL(a0).hostname;
        } catch {
          host = null;
        }
      } else if (a0 instanceof URL) host = a0.hostname;
      else if (a0 && typeof a0 === 'object') host = a0.hostname || a0.host || null;
      if (host && !isLocalHost(String(host).replace(/:\d+$/, ''))) {
        throw new Error(`[e2e] sortie réseau interdite (${name}.${fn}) vers ${host}`);
      }
      return original.apply(this, args);
    };
  }
}
