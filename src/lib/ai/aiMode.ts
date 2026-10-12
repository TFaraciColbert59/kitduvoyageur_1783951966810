/**
 * Interrupteur de l'IA du site (plan 1.7), lisible par le serveur ET par tout module qui
 * n'a pas à tirer `askAI` (client IA, `server-only`) : une page serveur qui doit savoir
 * s'il faut parler d'IA à l'écran (PLAN-100 5.3 : rien ne parle d'IA quand elle est éteinte).
 */

/** IA allumée ? `AI_MODE=off` l'éteint pour tout le site (repli par règles partout). */
export function aiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AI_MODE?.trim().toLowerCase() !== 'off';
}
