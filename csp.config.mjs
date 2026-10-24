/**
 * Politique de sécurité du contenu (CSP) du site — plan 2.11.
 *
 * Deux modes, choisis par la variable d'environnement `CSP_MODE` (lue au démarrage ou
 * au build, donc un redéploiement après changement) :
 *   - absente ou `report-only` (défaut) : en-tête `Content-Security-Policy-Report-Only`,
 *     rien n'est bloqué, les violations sont rapportées à `/api/csp-report` (table
 *     `app_errors`, lecture `select * from csp_report_summary(7)`) ;
 *   - `enforce` : en-tête `Content-Security-Policy`, le navigateur BLOQUE ce qui sort de
 *     la politique. Les rapports continuent d'arriver (même `report-uri`).
 *
 * Passage en `enforce` (action de Tony, après une semaine de rapports propres) :
 *   1. Supabase SQL Editor : `select * from public.csp_report_summary(7);` — aucune
 *      directive ni hôte légitime ne doit y figurer (sinon l'ajouter ci-dessous d'abord) ;
 *   2. Vercel › Settings › Environment Variables : `CSP_MODE=enforce` (Production), puis
 *      redéployer ; 3. ouvrir /compas, /explorer, /connexion et vérifier la console.
 * Retour arrière : supprimer `CSP_MODE` et redéployer.
 *
 * `'unsafe-inline'` et `'unsafe-eval'` restent dans `script-src` tant que les scripts
 * JSON-LD en ligne et Next.js n'ont pas de nonce (chantier à part) : la politique bloque
 * déjà tout hôte tiers non listé. La liste n'a volontairement PAS changé depuis le début de la
 * semaine de rapports (13 oct.) : `object-src 'none'`, `base-uri 'self'` et `form-action 'self'`
 * sont à ajouter après le passage en `enforce`, pas avant, pour ne pas relancer la semaine.
 */

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com https://hcaptcha.com https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: https://upload.wikimedia.org",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://va.vercel-scripts.com https://*.arcgis.com https://*.arcgisonline.com https://s3.amazonaws.com https://tiles.openfreemap.org https://hcaptcha.com https://*.hcaptcha.com https://api.stripe.com",
  'frame-src https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com',
  "worker-src 'self' blob:",
  'report-uri /api/csp-report',
];

/**
 * @param {string | undefined} mode valeur de `CSP_MODE`
 * @returns {{ key: string, value: string }}
 */
export function cspHeader(mode) {
  const enforce = typeof mode === 'string' && mode.trim().toLowerCase() === 'enforce';
  return {
    key: enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    value: CSP_DIRECTIVES.join('; '),
  };
}
