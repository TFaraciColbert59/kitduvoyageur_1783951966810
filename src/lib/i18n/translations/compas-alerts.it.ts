import type { compasAlertsFr } from './compas-alerts.fr';

type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/** Espace de noms `compas`, alertes officielles hors Europe (IT). Même forme que `compas-alerts.fr.ts`. */
export const compasAlertsIt: Shape<typeof compasAlertsFr> = {
  worldAlerts: {
    nwsRelay:
      'Allerte ufficiali del National Weather Service (NOAA, Stati Uniti), lette su {link}. Pubblico dominio; il testo ufficiale è riprodotto senza modifiche.',
    nwsLevel:
      'Il colore è una lettura del Compas in base alla gravità dichiarata (Extreme: rosso, Severe: arancione, altre: giallo); non è un livello del National Weather Service.',
    ecccRelay:
      'Allerte ufficiali di Environment and Climate Change Canada, lette su {link}. Il testo ufficiale è riprodotto senza modifiche, in francese e in inglese.',
    ecccLevel:
      'Colore di rischio pubblicato da ECCC; un bollettino senza colore è mostrato in giallo dal Compas.',
    ecccLicence: 'Licenza: {link}.',
    ecccLicenceName: 'Licenza d’uso finale dei server di dati di ECCC',
    notEndorsed: 'Il Compas non è affiliato a questo servizio né approvato da esso.',
    readAt: 'Servizio consultato il {date}.',
    check: 'Per le informazioni più aggiornate, consulti {link}.',
    sourceNws: 'National Weather Service (allerte ufficiali, Stati Uniti)',
    sourceEccc: 'Environment and Climate Change Canada (allerte ufficiali)',
  },
};
