/**
 * Espace de noms `compas`, alertes officielles hors Europe (plan 4.9 : NWS, ECCC).
 * Branché dans `compas.fr.ts` ; les clés se lisent `compas.worldAlerts.…`. Les mentions
 * imposées par les services (attribution d’ECCC) ne sont pas ici : elles sont reprises mot
 * pour mot depuis `engine/worldAlerts.ts`.
 */
export const compasAlertsFr = {
  worldAlerts: {
    nwsRelay:
      'Alertes officielles du National Weather Service (NOAA, États-Unis), lues sur {link}. Domaine public ; le texte officiel est reproduit sans modification.',
    nwsLevel:
      'La couleur est une lecture du Compas d’après la sévérité déclarée (Extreme : rouge, Severe : orange, autres : jaune) ; ce n’est pas un niveau du National Weather Service.',
    ecccRelay:
      'Alertes officielles d’Environnement et Changement climatique Canada, lues sur {link}. Le texte officiel est reproduit sans modification, en français et en anglais.',
    ecccLevel:
      'Couleur de risque publiée par ECCC ; un bulletin sans couleur est montré en jaune par le Compas.',
    ecccLicence: 'Licence : {link}.',
    ecccLicenceName: 'Licence d’utilisation finale des serveurs de données d’ECCC',
    notEndorsed: 'Le Compas n’est ni affilié à ce service ni approuvé par lui.',
    readAt: 'Service lu le {date}.',
    check: 'Pour l’information la plus à jour, consulte {link}.',
    sourceNws: 'National Weather Service (alertes officielles, États-Unis)',
    sourceEccc: 'Environnement et Changement climatique Canada (alertes officielles)',
  },
} as const;
