// Workers n'a pas sharp : le décodage d'altitude échoue proprement et
// terrainElevation renvoie null (aucune altitude inventée).
function sharp() {
  return {
    removeAlpha() { return this; },
    raw() { return this; },
    toBuffer() { return Promise.reject(new Error('sharp indisponible sur Workers')); },
  };
}
export default sharp;
