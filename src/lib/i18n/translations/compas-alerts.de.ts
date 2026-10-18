import type { compasAlertsFr } from './compas-alerts.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas`, alertes officielles hors Europe (DE). Même forme que `compas-alerts.fr.ts`. */
export const compasAlertsDe: Shape<typeof compasAlertsFr> = {
  worldAlerts: {
    nwsRelay:
      'Amtliche Warnungen des National Weather Service (NOAA, Vereinigte Staaten), abgerufen über {link}. Gemeinfrei; der amtliche Text wird unverändert wiedergegeben.',
    nwsLevel:
      'Die Farbe ist eine Einschätzung des Compas nach der angegebenen Schwere (Extreme: Rot, Severe: Orange, sonst: Gelb); sie ist keine Warnstufe des National Weather Service.',
    ecccRelay:
      'Amtliche Warnungen von Environment and Climate Change Canada, abgerufen über {link}. Der amtliche Text wird unverändert wiedergegeben, auf Französisch und Englisch.',
    ecccLevel:
      'Von ECCC veröffentlichte Risikofarbe; eine Meldung ohne Farbe zeigt der Compas in Gelb.',
    ecccLicence: 'Lizenz: {link}.',
    ecccLicenceName: 'Endnutzerlizenz der Datenserver von ECCC',
    notEndorsed: 'Der Compas ist mit diesem Dienst weder verbunden noch von ihm gebilligt.',
    readAt: 'Dienst abgerufen am {date}.',
    check: 'Die aktuellsten Informationen finden Sie unter {link}.',
    sourceNws: 'National Weather Service (amtliche Warnungen, Vereinigte Staaten)',
    sourceEccc: 'Environment and Climate Change Canada (amtliche Warnungen)',
  },
};
