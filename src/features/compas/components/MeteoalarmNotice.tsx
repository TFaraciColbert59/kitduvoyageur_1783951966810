import { Fragment } from 'react';
import {
  METEOALARM_DISCLAIMER,
  METEOALARM_DISCLAIMER_FR,
  METEOALARM_HOME,
} from '../engine/meteoalarmFeeds';

/**
 * Ce que Meteoalarm exige de qui redonne ses alertes (conditions lues le
 * 2026-10-10, https://meteoalarm.org/en/live/page/terms-and-conditions, § 5) :
 * un lien vers meteoalarm.org et l'avertissement ci-dessous, mot pour mot. Le
 * nom du service national et l'heure d'émission voyagent avec chaque alerte
 * (`source` et libellé). À afficher sous toute liste qui montre une alerte.
 */
export default function MeteoalarmNotice() {
  // L'avertissement officiel, avec un lien sur chaque « www.meteoalarm.org ».
  const parts = METEOALARM_DISCLAIMER.split('www.meteoalarm.org');
  return (
    <div className="cp-disc" data-testid="meteoalarm-notice">
      <p style={{ margin: 0 }}>
        Alertes officielles des services météorologiques nationaux, relayées par{' '}
        <a href={METEOALARM_HOME} target="_blank" rel="noopener noreferrer">
          Meteoalarm
        </a>{' '}
        (EUMETNET). {METEOALARM_DISCLAIMER_FR}
      </p>
      <p lang="en" style={{ margin: '4px 0 0' }}>
        {parts.map((text, i) => (
          <Fragment key={i}>
            {text}
            {i < parts.length - 1 && (
              <a href={METEOALARM_HOME} target="_blank" rel="noopener noreferrer">
                www.meteoalarm.org
              </a>
            )}
          </Fragment>
        ))}
      </p>
    </div>
  );
}
