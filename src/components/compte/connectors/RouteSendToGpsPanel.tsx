'use client';

import React, { useMemo, useState } from 'react';
import { Download, Send } from 'lucide-react';

import type { CanonicalRouteForSync, PartnerProviderId } from '@/features/connectors';
import type { RouteSendResponse, RouteSendTargetView } from '@/lib/connectors/types';
import { listCompatibleDevices } from '@/lib/connectors/viewModels';
import { ConnectorAvailabilityBadge } from './ConnectorAvailabilityBadge';

export interface RouteSendToGpsPanelProps {
  targets: readonly RouteSendTargetView[];
  route: CanonicalRouteForSync | null;
  result?: RouteSendResponse | null;
  busyProvider?: PartnerProviderId | null;
  error?: string | null;
  onSend?: (providerId: PartnerProviderId, deviceModelId?: string) => void;
}

function downloadGpx(plan: RouteSendResponse['plan']): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([plan.gpxFallbackXml], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${plan.routeId.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'itineraire'}-${plan.fallbackFormat}.gpx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Envoi d'un itinéraire vers un GPS / une montre.
 * - Le mode affiché vient du plan serveur : cloud, repli manuel, consentement
 *   bloqué ou appareil incompatible.
 * - Sans credentials, le repli GPX réel reste téléchargeable.
 * - Aucun itinéraire n'est inventé : sans route sélectionnée, l'écran l'annonce.
 */
export function RouteSendToGpsPanel({
  targets,
  route,
  result = null,
  busyProvider = null,
  error = null,
  onSend,
}: RouteSendToGpsPanelProps) {
  const defaultProvider = useMemo(
    () => targets.find((target) => target.canSend)?.providerId ?? targets[0]?.providerId ?? '',
    [targets]
  );
  const [selectedProvider, setSelectedProvider] = useState<PartnerProviderId | ''>(defaultProvider);
  const [deviceModelId, setDeviceModelId] = useState('');
  const activeProviderId =
    selectedProvider && targets.some((target) => target.providerId === selectedProvider)
      ? selectedProvider
      : defaultProvider;
  const activeTarget = targets.find((target) => target.providerId === activeProviderId) ?? null;
  const devices = activeTarget ? listCompatibleDevices(activeTarget.providerId) : [];
  const isBusy = busyProvider === activeTarget?.providerId;

  return (
    <section className="cn-section" aria-labelledby="cn-send-title">
      <div className="cn-section-head">
        <h2 id="cn-send-title">Envoyer un itinéraire vers un GPS</h2>
        <p>Parcours et waypoints · distinction envoi / import</p>
      </div>

      {error ? <p className="cn-error" role="alert">{error}</p> : null}

      {route === null ? (
        <div className="cn-empty" role="status">
          <b>Aucun itinéraire sélectionné</b>
          Ouvre un itinéraire depuis Explorer ou le carnet de voyage : l’envoi vers un GPS reste disponible
          depuis sa fiche, sans quitter la navigation.
        </div>
      ) : targets.length === 0 ? (
        <div className="cn-empty" role="status">
          <b>Aucun connecteur compatible</b>
          Configure un partenaire Garmin, Wahoo, COROS, Suunto, Polar, Hammerhead, Samsung Health ou Apple Watch.
        </div>
      ) : (
        <>
          <div className="cn-plan" aria-label="Itinéraire sélectionné">
            <b>{route.title}</b>
            <p>
              {route.routeId} · révision {route.revision} · {(route.totalDistanceMeters / 1000).toFixed(1)} km ·{' '}
              {Math.round(route.elevationGainMeters)} m D+ · {route.waypoints.length} waypoint
              {route.waypoints.length > 1 ? 's' : ''}
            </p>
          </div>

          <form
            className="cn-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!activeTarget || !activeTarget.canSend) return;
              onSend?.(activeTarget.providerId, deviceModelId || undefined);
            }}
          >
            <div className="cn-field">
              <label htmlFor="cn-send-provider">Destinataire</label>
              <select
                id="cn-send-provider"
                className="cn-select"
                value={activeProviderId}
                onChange={(event) => {
                  setSelectedProvider(event.target.value as PartnerProviderId);
                  setDeviceModelId('');
                }}
              >
                {targets.map((target) => (
                  <option key={target.providerId} value={target.providerId} disabled={!target.canSend}>
                    {target.label} — {target.modeLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="cn-field">
              <label htmlFor="cn-send-device">Appareil</label>
              <select
                id="cn-send-device"
                className="cn-select"
                value={deviceModelId}
                onChange={(event) => setDeviceModelId(event.target.value)}
              >
                <option value="">Modèle par défaut du partenaire</option>
                {devices.map((device) => (
                  <option key={device.modelId} value={device.modelId}>
                    {device.modelName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="cn-btn cn-btn--primary"
              disabled={!activeTarget?.canSend || isBusy}
            >
              <Send size={15} aria-hidden="true" />
              {isBusy ? 'Préparation…' : 'Envoyer'}
            </button>
          </form>

          <p className="cn-fine">
            {activeTarget
              ? `${activeTarget.deviceCount} appareil(s) compatible(s). ${
                  activeTarget.manualFallbackFormats.length > 0
                    ? `Repli ${activeTarget.manualFallbackFormats.map((format) => format.toUpperCase()).join('/')} disponible même sans cloud.`
                    : 'Aucun repli manuel pour ce partenaire.'
                }`
              : 'Choisis un destinataire.'}
          </p>

          {result ? (
            <div className="cn-plan" role="status">
              <div className="cn-row-side">
                <b>{result.plan.providerLabel}</b>
                <ConnectorAvailabilityBadge
                  label={result.plan.deliveryLabel}
                  tone={
                    result.plan.deliveryMode === 'cloud_push_ready'
                      ? 'positive'
                      : result.plan.deliveryMode === 'blocked_consent' ||
                          result.plan.deliveryMode === 'incompatible_device'
                        ? 'warning'
                        : 'pending'
                  }
                />
              </div>
              <p>{result.plan.reason}</p>
              <p>
                {result.plan.exportedWaypointsCount} waypoint(s) exporté(s)
                {result.plan.truncatedWaypointsCount > 0
                  ? ` · ${result.plan.truncatedWaypointsCount} tronqué(s) par la limite de l’appareil`
                  : ''}
                {result.plan.jobId
                  ? ` · job ${result.plan.jobId} (${result.plan.jobStatusLabel ?? 'en file'})`
                  : ' · aucun job créé (appareil incompatible)'}
              </p>
              <div className="cn-actions">
                <button
                  type="button"
                  className="cn-btn"
                  onClick={() => downloadGpx(result.plan)}
                >
                  <Download size={15} aria-hidden="true" />
                  Télécharger le repli GPX
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default RouteSendToGpsPanel;
