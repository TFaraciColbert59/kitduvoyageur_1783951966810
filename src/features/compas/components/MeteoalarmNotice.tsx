import { Fragment } from 'react';
import {
  METEOALARM_DISCLAIMER,
  METEOALARM_DISCLAIMER_FR,
  METEOALARM_HOME,
  formatIssuedUtc,
} from '../engine/meteoalarmFeeds';

/**
 * Ce que Meteoalarm exige de qui redonne ses alertes (conditions relues le
 * 2026-10-11, https://meteoalarm.org/en/live/page/terms-and-conditions, § 5) :
 * un lien vers meteoalarm.org et l'avertissement ci-dessous, mot pour mot. Le
 * nom du service national et l'heure d'émission voyagent avec chaque alerte
 * (`source` et libellé). À afficher sous toute liste qui montre une alerte.
 *
 * `readAt` : l'instant où le Compas a lu le flux. Une page restée ouverte ne se
 * rafraîchit pas, et Meteoalarm veut un retard de 10 minutes au plus : l'heure
 * de lecture permet de juger de l'âge de ce qui est affiché.
 */
export default function MeteoalarmNotice({ readAt }: { readAt?: string | null }) {
  // L'avertissement officiel, avec un lien sur chaque « www.meteoalarm.org ».
  const parts = METEOALARM_DISCLAIMER.split('www.meteoalarm.org');
  const read = formatIssuedUtc(readAt);
  return (
    <div className="cp-disc" data-testid="meteoalarm-notice">
      <p style={{ margin: 0 }}>
        Alertes officielles des services météorologiques nationaux, relayées par{' '}
        <a href={METEOALARM_HOME} target="_blank" rel="noopener noreferrer">
          Meteoalarm
        </a>{' '}
        (EUMETNET).{read ? ` Flux lu le ${read}.` : ''} {METEOALARM_DISCLAIMER_FR}
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
