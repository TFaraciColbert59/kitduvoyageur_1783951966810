import type { compasAlertsFr } from './compas-alerts.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas`, alertes officielles hors Europe (EN). Même forme que `compas-alerts.fr.ts`. */
export const compasAlertsEn: Shape<typeof compasAlertsFr> = {
  worldAlerts: {
    nwsRelay:
      'Official alerts from the National Weather Service (NOAA, United States), read from {link}. Public domain; the official text is reproduced without modification.',
    nwsLevel:
      'The colour is the Compas’s reading of the declared severity (Extreme: red, Severe: orange, others: yellow); it is not a National Weather Service level.',
    ecccRelay:
      'Official alerts from Environment and Climate Change Canada, read from {link}. The official text is reproduced without modification, in French and English.',
    ecccLevel:
      'Risk colour published by ECCC; a statement without a colour is shown in yellow by the Compas.',
    ecccLicence: 'Licence: {link}.',
    ecccLicenceName: 'ECCC Data Servers End-use Licence',
    notEndorsed: 'The Compas is neither affiliated with nor endorsed by this service.',
    readAt: 'Service read on {date}.',
    check: 'For the most up-to-date information, see {link}.',
    sourceNws: 'National Weather Service (official alerts, United States)',
    sourceEccc: 'Environment and Climate Change Canada (official alerts)',
  },
};
