import type { compasAlertsFr } from './compas-alerts.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas`, alertes officielles hors Europe (ES). Même forme que `compas-alerts.fr.ts`. */
export const compasAlertsEs: Shape<typeof compasAlertsFr> = {
  worldAlerts: {
    nwsRelay:
      'Alertas oficiales del National Weather Service (NOAA, Estados Unidos), leídas en {link}. Dominio público; el texto oficial se reproduce sin modificaciones.',
    nwsLevel:
      'El color es una lectura del Compas según la gravedad declarada (Extreme: rojo, Severe: naranja, otras: amarillo); no es un nivel del National Weather Service.',
    ecccRelay:
      'Alertas oficiales de Environment and Climate Change Canada, leídas en {link}. El texto oficial se reproduce sin modificaciones, en francés y en inglés.',
    ecccLevel:
      'Color de riesgo publicado por ECCC; un boletín sin color se muestra en amarillo en el Compas.',
    ecccLicence: 'Licencia: {link}.',
    ecccLicenceName: 'Licencia de uso final de los servidores de datos de ECCC',
    notEndorsed: 'El Compas no está afiliado a este servicio ni cuenta con su aprobación.',
    readAt: 'Servicio consultado el {date}.',
    check: 'Para la información más actualizada, consulte {link}.',
    sourceNws: 'National Weather Service (alertas oficiales, Estados Unidos)',
    sourceEccc: 'Environment and Climate Change Canada (alertas oficiales)',
  },
};
