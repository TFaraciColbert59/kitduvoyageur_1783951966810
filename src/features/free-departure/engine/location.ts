/**
 * « Partir librement » — usage de la localisation (ecrans 60 / 61 / 62).
 *
 * L'autorisation n'est demandee qu'au moment necessaire : le bouton
 * « Demarrer » la declenche, jamais le simple fait d'ouvrir l'ecran. Le
 * refus est un etat de premiere classe, pas une erreur a masquer — on peut
 * partir sans trace, et l'ecran le dit.
 *
 * Regle de fond : le texte ci-dessous est lu AVANT la boite systeme. Il ne
 * doit donc jamais promettre plus que ce que le code fait, ni moins.
 */

/** Etat de l'autorisation, tel que l'ecran doit le dire. */
export type LocationPermission = 'inconnue' | 'accordee' | 'refusee' | 'indisponible';

export const PERMISSION_LABELS: Readonly<Record<LocationPermission, string>> = {
  inconnue: 'Localisation non activée',
  accordee: 'Localisation activée',
  refusee: 'Localisation refusée',
  indisponible: 'Localisation indisponible sur cet appareil',
};

/**
 * Ce que l'app fait de la position, dit avant de la demander.
 *
 * Trois faits, dans l'ordre ou l'utilisateur les cherche : ce que la position
 * sert, quand elle sert, et ce qui n'en sort pas. Le dernier est le plus
 * important — c'est lui qui distingue cet ecran d'un traceur qui
 * s explique tout seul. Aucune promesse de partage n'y figure : le partage est decide
 * plus tard, ecran 62, et seulement si l'utilisateur le demande.
 */
export const LOCATION_PURPOSE =
  'Ta position sert à tracer ton parcours. ' +
  'Uniquement pendant l’activité : la trace reste sur ton téléphone, ' +
  'rien n’est partagé sans ton accord. Aucun partage, aucune donnée envoyée ' +
  'à qui que ce soit : tu peux arrêter le suivi à tout moment.';

/**
 * Etat affiche quand l'utilisateur refuse : la sortie reste possible.
 *
 * On ne dit pas « tu ne peux pas partir » : on dit ce qui manque. Le refus
 * coute une trace, pas l'activite.
 */
export const REFUSED_FALLBACK =
  'Tu pars sans trace ni distance : le chrono continue, mais l’activité ne pourra pas être déduite à la fin.';

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

