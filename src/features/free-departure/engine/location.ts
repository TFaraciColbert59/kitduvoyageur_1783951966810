/**
 * « Partir librement » — usage de la localisation (A11).
 *
 * L'autorisation n'est demandee qu'au moment necessaire : le bouton
 * « Demarrer » la declenche, jamais le simple fait d'ouvrir l'ecran. Le
 * refus est un etat de premiere classe, pas une erreur a masquer — on peut
 * partir sans trace, et l'ecran le dit.
 */

/** Etat de l'autorisation, tel que l'ecran doit le dire. */
export type LocationPermission = 'inconnue' | 'accordee' | 'refusee' | 'indisponible';

export const PERMISSION_LABELS: Readonly<Record<LocationPermission, string>> = {
  inconnue: 'Localisation non activée',
  accordee: 'Localisation activée',
  refusee: 'Localisation refusée',
  indisponible: 'Localisation indisponible sur cet appareil',
};

/** Ce que l'app fait de la position, dit avant de la demander. */
export const LOCATION_PURPOSE =
  'La position sert uniquement à enregistrer ta trace et ta distance pendant l’activité. ' +
  'Rien n’est envoyé ni partagé, et tu peux arrêter le suivi à tout moment.';

/** Etat affiche quand l'utilisateur refuse : la sortie reste possible. */
export const REFUSED_FALLBACK =
  'Tu pars sans trace ni distance : le suivi démarre, mais l’activité ne pourra pas être identifiée.';

/**
 * L'utilisateur a-t-il tranche ? Seul un « oui » ou un « non » explicite
 * compte : « inconnue » n'a pas encore ete demande, « indisponible » signifie
 * que l'appareil ne sait pas repondre et n'a jamais consulte la personne.
 */
export function isPermissionDecided(permission: LocationPermission): boolean {
  return permission === 'accordee' || permission === 'refusee';
}

/**
 * Peut-on enregistrer une trace ? `refusee` et `indisponible` ne bloquent
 * jamais le depart : elles signifient seulement « pas de mesure ».
 */
export function canTrack(permission: LocationPermission): boolean {
  return permission === 'accordee';
}

/**
 * Traduit une erreur de geolocalisation en etat affichable.
 *
 * `PERMISSION_DENIED` (1) = refus explicite. `POSITION_UNAVAILABLE` (2) et
 * `TIMEOUT` (3) = coupure momentanee : ce n'est PAS un refus, on ne l'affiche
 * donc pas comme tel.
 */
export function permissionFromGeolocationError(
  code: number | null | undefined
): LocationPermission {
  switch (code) {
    case 1:
      return 'refusee';
    case 2:
    case 3:
      return 'inconnue';
    default:
      return 'indisponible';
  }
}
