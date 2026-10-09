/**
 * Compas — « aujourd'hui » et fuseaux horaires. Module PUR : aucun réseau,
 * aucune dépendance serveur ; lu par le serveur ET par le navigateur.
 *
 * - « Aujourd'hui » du voyageur : le fuseau de SON navigateur, envoyé par
 *   l'écran avec la phrase et la préparation (`browserTimeZone`). Paris
 *   (`DEFAULT_TRAVELLER_ZONE`) n'est qu'un repli, quand rien de valable n'est
 *   envoyé (ancien écran, tests).
 * - Les dates de la météo et du soleil sont celles de la DESTINATION : son
 *   fuseau se retrouve côté serveur (`destinationZone`, `server/weather.ts`).
 *   La recherche du fuseau par coordonnées n'entre jamais ici (poids du navigateur).
 */

/** Repli quand le navigateur n'a envoyé aucun fuseau valable. */
export const DEFAULT_TRAVELLER_ZONE = 'Europe/Paris';

/** Date du jour (AAAA-MM-JJ) dans un fuseau IANA ; date UTC si le fuseau est illisible. */
export function localToday(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Un fuseau IANA réel (64 caractères au plus), sinon null : jamais une valeur forgée. */
export function safeTimeZone(z: unknown): string | null {
  if (typeof z !== 'string') return null;
  const zone = z.trim();
  if (!zone || zone.length > 64) return null;
  try {
    return Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone || zone;
  } catch {
    return null;
  }
}

/** « Aujourd'hui » du voyageur : le fuseau envoyé par son navigateur, sinon Paris. */
export function travellerToday(timeZone: unknown, now = new Date()): string {
  return localToday(safeTimeZone(timeZone) ?? DEFAULT_TRAVELLER_ZONE, now);
}

/** Fuseau du navigateur (null s'il est illisible). À n'appeler que côté navigateur. */
export function browserTimeZone(): string | null {
  try {
    return safeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
}

/** Date du jour du navigateur (AAAA-MM-JJ), jamais celle d'UTC. */
export function browserToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
