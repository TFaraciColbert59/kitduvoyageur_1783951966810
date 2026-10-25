'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { formatIssuedUtc } from '../engine/meteoalarmFeeds';
import {
  ECCC_API_PAGE,
  ECCC_ATTRIBUTION,
  ECCC_ATTRIBUTION_FR,
  ECCC_HOME_EN,
  ECCC_HOME_FR,
  ECCC_LICENCE_EN,
  ECCC_LICENCE_FR,
  NWS_ALERTS_PAGE,
  NWS_API_DOC,
  worldAlertServiceOf,
  type WorldAlertService,
} from '../engine/worldAlerts';

/**
 * Ce que chaque service hors Europe demande de qui redonne ses alertes (conditions
 * lues le 2026-10-17, voir `engine/worldAlerts.ts`), à afficher sous toute liste
 * qui montre une de ses alertes, comme `MeteoalarmNotice` pour l'Europe :
 * - NWS : domaine public, texte non modifié, aucune affiliation ni approbation
 *   suggérée ; la couleur est dite comme une lecture du Compas ;
 * - ECCC : attribution « Data Source: Environment and Climate Change Canada » mot pour
 *   mot, lien vers la licence, aucune approbation suggérée.
 * `readAt` : l'instant où le Compas a lu le service.
 */

function withLink(template: string, href: string, label: string): ReactNode {
  const [before, after = ''] = template.split('{link}');
  return (
    <>
      {before}
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
      {after}
    </>
  );
}

const host = (url: string) => new URL(url).host;

export function WorldAlertNotice({
  service,
  readAt,
}: {
  service: WorldAlertService;
  readAt?: string | null;
}) {
  const { t, locale } = useTranslation();
  const read = formatIssuedUtc(readAt);
  const fr = locale === 'fr';
  const site = service === 'nws' ? NWS_ALERTS_PAGE : fr ? ECCC_HOME_FR : ECCC_HOME_EN;
  return (
    <div className="cp-disc" data-testid="world-alert-notice" data-service={service}>
      {service === 'nws' ? (
        <p style={{ margin: 0 }}>
          {withLink(t('compas.worldAlerts.nwsRelay'), NWS_API_DOC, 'api.weather.gov')}{' '}
          {t('compas.worldAlerts.nwsLevel')} {t('compas.worldAlerts.notEndorsed')}
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            {withLink(t('compas.worldAlerts.ecccRelay'), ECCC_API_PAGE, 'api.weather.gc.ca')}{' '}
            {t('compas.worldAlerts.ecccLevel')} {t('compas.worldAlerts.notEndorsed')}
          </p>
          <p style={{ margin: '4px 0 0' }}>
            <span lang="en">{ECCC_ATTRIBUTION}</span>
            {fr ? (
              <>
                {' · '}
                <span lang="fr">{ECCC_ATTRIBUTION_FR}</span>
              </>
            ) : null}
            {'. '}
            {withLink(
              t('compas.worldAlerts.ecccLicence'),
              fr ? ECCC_LICENCE_FR : ECCC_LICENCE_EN,
              t('compas.worldAlerts.ecccLicenceName')
            )}
          </p>
        </>
      )}
      <p style={{ margin: '4px 0 0' }}>
        {read ? `${t('compas.worldAlerts.readAt', { date: read })} ` : ''}
        {withLink(t('compas.worldAlerts.check'), site, host(site))}
      </p>
    </div>
  );
}

/** Une mention par service hors Europe présent parmi les sources affichées (aucune sinon). */
export default function WorldAlertNotices({
  sources,
  readAt,
}: {
  sources: readonly string[];
  readAt?: string | null;
}) {
  const services = [...new Set(sources.map(worldAlertServiceOf))].filter(
    (s): s is WorldAlertService => s != null
  );
  return (
    <>
      {services.map((s) => (
        <WorldAlertNotice key={s} service={s} readAt={readAt} />
      ))}
    </>
  );
}
