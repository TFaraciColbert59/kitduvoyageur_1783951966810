/**
 * Portées des service workers du site.
 *
 * Deux workers coexistent : celui de l'app (`/sw.js`, portée `/`) et celui des
 * zones hors ligne de l'Explorer (`/explorer-v2-sw.js`). Le navigateur n'admet
 * qu'un enregistrement par portée : tant que l'Explorer s'enregistrait lui aussi
 * sur `/`, chacun remplaçait l'autre (les deux font `skipWaiting` + `clients.claim`)
 * et le rechargement sur `controllerchange` relançait la page en boucle (12
 * rechargements en 15 s sur /explorer en production, constaté le 01/11/2026).
 *
 * Règles : l'Explorer a sa portée propre, plus précise, qui gagne sur ses pages ;
 * l'app ne recharge que lorsque SON worker prend la main (nouvelle version).
 */
export const APP_SW_PATH = '/sw.js';
export const EXPLORER_SW_PATH = '/explorer-v2-sw.js';
export const EXPLORER_SW_SCOPE = '/explorer';

/** Recharger la page seulement quand le nouveau contrôleur est le worker de l'app. */
export function shouldReloadOnControllerChange(controllerScriptUrl: string | null | undefined): boolean {
  if (!controllerScriptUrl) return false;
  try {
    return new URL(controllerScriptUrl, 'https://lkdv.invalid').pathname === APP_SW_PATH;
  } catch {
    return false;
  }
}
