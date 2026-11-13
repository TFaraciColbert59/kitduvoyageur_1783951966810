'use client';

/**
 * Lot D03-UI — Live Sync, champs personnalisés et repères à venir.
 *
 * Règle non négociable : aucune métrique capteur n’est inventée. Un champ
 * sans donnée (`heartRateBpm`, `currentSpeedMps`, `etaUtcMs`, batterie) affiche
 * « — » et le badge « indisponible ». Les POI affichés viennent du contrat
 * `computeUpcomingPois`, triés par distance restante.
 */

import React, { useMemo, useState } from 'react';
import {
  DEFAULT_WATCH_FIELD_LAYOUT,
  buildLiveSyncCustomFields,
  computeUpcomingPois,
  type WatchFieldLayoutConfig,
  type WatchLiveMetricsInput,
  type WatchLiveSyncFrame,
  type WatchNavigationFieldKey,
  type WatchNextManeuver,
  type WatchRoutePoiInput,
} from '@/features/watches';
import { Radio, Send, ShieldQuestion } from 'lucide-react';
import type { WatchApi } from './api';
import {
  formatDateTime,
  formatDistanceMeters,
} from './format';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  Section,
  StatusPill,
} from './primitives';
import { WatchCustomFieldsEditor } from './WatchCustomFieldsEditor';

function numeric(value: string): number {
  if (value.trim().length === 0) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumeric(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export interface WatchLiveSyncScreenProps {
  sessionId: string;
  routeId?: string | null;
  api?: WatchApi;
  initialPois?: WatchRoutePoiInput[];
  nextManeuver?: WatchNextManeuver | null;
}

export function WatchLiveSyncScreen({
  sessionId,
  routeId = null,
  api,
  initialPois = [],
  nextManeuver = null,
}: WatchLiveSyncScreenProps) {
  const [pages, setPages] = useState<WatchNavigationFieldKey[][]>(() =>
    DEFAULT_WATCH_FIELD_LAYOUT.pages.map((page) => [...page]),
  );
  const [maxSlots, setMaxSlots] = useState(DEFAULT_WATCH_FIELD_LAYOUT.maxSlotsPerPage);
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<WatchLiveSyncFrame | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);

  const [distanceKm, setDistanceKm] = useState('0');
  const [elevGainM, setElevGainM] = useState('0');
  const [movingMin, setMovingMin] = useState('0');
  const [elapsedMin, setElapsedMin] = useState('0');
  const [heartRate, setHeartRate] = useState('');
  const [speedKmh, setSpeedKmh] = useState('');
  const [battery, setBattery] = useState('80');
  const [offRoute, setOffRoute] = useState(false);
  const [offRouteM, setOffRouteM] = useState('');

  const activeKeys = useMemo(
    () => Array.from(new Set(pages.flat())),
    [pages],
  );

  const metrics = useMemo<WatchLiveMetricsInput>(() => {
    const distanceM = Math.max(0, numeric(distanceKm) * 1000);
    return {
      distanceM,
      elevGainM: Math.max(0, numeric(elevGainM)),
      movingS: Math.max(0, numeric(movingMin) * 60),
      elapsedS: Math.max(0, numeric(elapsedMin) * 60),
      currentSpeedMps:
        optionalNumeric(speedKmh) === null ? null : Math.max(0, numeric(speedKmh)) / 3.6,
      heartRateBpm: optionalNumeric(heartRate),
      offRoute,
      offRouteDistanceM: offRoute ? optionalNumeric(offRouteM) : null,
      paused: false,
      batteryPercent: optionalNumeric(battery),
      etaUtcMs: null,
      currentElevationM: null,
    };
  }, [
    battery,
    distanceKm,
    elevGainM,
    elapsedMin,
    heartRate,
    movingMin,
    offRoute,
    offRouteM,
    speedKmh,
  ]);

  const previewFields = useMemo(
    () => buildLiveSyncCustomFields(activeKeys, metrics, nextManeuver),
    [activeKeys, metrics, nextManeuver],
  );

  const fields = frame?.customFields ?? previewFields;
  const upcomingPois = useMemo(
    () =>
      frame?.upcomingPois ??
      computeUpcomingPois(initialPois, metrics.distanceM, {
        currentElevationM: metrics.currentElevationM,
        maxCount: 5,
      }),
    [frame, initialPois, metrics.currentElevationM, metrics.distanceM],
  );

  async function saveLayout() {
    setLayoutError(null);
    setLayoutMessage(null);
    if (!api) {
      const duplicateFree = pages.every((page) => new Set(page).size === page.length);
      const overflow = pages.some((page) => page.length > maxSlots);
      if (!duplicateFree || overflow) {
        setLayoutError('Chaque page doit rester sous la limite et sans doublon.');
        return;
      }
      setLayoutMessage('Disposition prête. Aucun serveur appelé dans cet aperçu.');
      return;
    }
    const config: WatchFieldLayoutConfig = {
      sport: 'rando',
      maxSlotsPerPage: maxSlots,
      pages,
    };
    setBusy(true);
    try {
      const result = await api.setLayout(config);
      if (result.layout.valid) {
        setLayoutMessage('Disposition enregistrée et appliquée aux séances.');
        setPages(result.layout.normalizedPages);
      } else {
        setLayoutError(result.layout.errors.join(' '));
      }
    } catch (caught) {
      setLayoutError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function buildFrame() {
    setFrameError(null);
    if (!api) {
      setFrameError('Aucun serveur Live Sync branché dans cet aperçu.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.buildFrame({
        sessionId,
        routeId,
        metrics,
        pois: initialPois,
        nextManeuver,
      });
      setFrame(result.frame);
    } catch (caught) {
      setFrameError(caught instanceof Error ? caught.message : 'Trame impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function handoff(toSource: 'phone' | 'watch') {
    setHandoffMessage(null);
    if (!api) {
      setHandoffMessage('Bascule de source disponible une fois le compagnon connecté.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.handoff({
        sessionId,
        toSource,
        lastAcceptedSeq: 0,
      });
      setHandoffMessage(
        `Source ${result.handoff.toSource === 'watch' ? 'montre' : 'téléphone'} · génération ${result.handoff.newSourceGeneration}.`,
      );
    } catch (caught) {
      setHandoffMessage(caught instanceof Error ? caught.message : 'Bascule impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lkv-watch__stack" data-testid="watch-live-sync-screen">
      <Card>
        <div className="lkv-watch__row">
          <div>
            <p className="lkv-watch__eyebrow">K6.10 · Live Sync</p>
            <h2 className="lkv-watch__card-title">Champs et repères sur la montre</h2>
            <p className="lkv-watch__hint">
              Séance <code>{sessionId}</code>
              {routeId ? (
                <>
                  {' '}· itinéraire <code>{routeId}</code>
                </>
              ) : null}
            </p>
          </div>
          <StatusPill tone="info">
            <Radio size={13} aria-hidden="true" /> Trame locale
          </StatusPill>
        </div>
      </Card>

      <Section
        title="Disposition des champs"
        hint={`Maximum ${maxSlots} champs par page. Les doublons sont refusés par le contrat.`}
      >
        <Card>
          <div className="lkv-watch__field">
            <label htmlFor="watch-max-slots">Champs par page</label>
            <input
              id="watch-max-slots"
              type="number"
              min={1}
              max={6}
              value={maxSlots}
              onChange={(event) =>
                setMaxSlots(Math.max(1, Math.min(6, Number(event.target.value) || 1)))
              }
            />
          </div>
          <WatchCustomFieldsEditor
            pages={pages}
            maxSlotsPerPage={maxSlots}
            disabled={busy}
            onChange={setPages}
          />
          {layoutError ? <Notice tone="error">{layoutError}</Notice> : null}
          {layoutMessage ? <Notice tone="ok">{layoutMessage}</Notice> : null}
          <div className="lkv-watch__actions">
            <Button variant="primary" onClick={() => void saveLayout()} disabled={busy}>
              Enregistrer la disposition
            </Button>
          </div>
        </Card>
      </Section>

      <Section
        title="Aperçu des métriques"
        hint="Laisser un champ capteur vide produit « — », jamais une valeur inventée."
      >
        <Card>
          <div className="lkv-watch__form">
            <div className="lkv-watch__field">
              <label htmlFor="watch-distance">Distance (km)</label>
              <input
                id="watch-distance"
                type="number"
                min={0}
                step="0.01"
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-elev-gain">D+ (m)</label>
              <input
                id="watch-elev-gain"
                type="number"
                min={0}
                value={elevGainM}
                onChange={(event) => setElevGainM(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-moving">Temps en mouvement (min)</label>
              <input
                id="watch-moving"
                type="number"
                min={0}
                value={movingMin}
                onChange={(event) => setMovingMin(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-elapsed">Temps écoulé (min)</label>
              <input
                id="watch-elapsed"
                type="number"
                min={0}
                value={elapsedMin}
                onChange={(event) => setElapsedMin(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-heart">FC (bpm, facultatif)</label>
              <input
                id="watch-heart"
                type="number"
                min={0}
                max={300}
                placeholder="Capteur indisponible"
                value={heartRate}
                onChange={(event) => setHeartRate(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-speed">Vitesse (km/h, facultatif)</label>
              <input
                id="watch-speed"
                type="number"
                min={0}
                step="0.1"
                placeholder="Capteur indisponible"
                value={speedKmh}
                onChange={(event) => setSpeedKmh(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-battery">Batterie montre (%)</label>
              <input
                id="watch-battery"
                type="number"
                min={0}
                max={100}
                value={battery}
                onChange={(event) => setBattery(event.target.value)}
              />
            </div>
            <div className="lkv-watch__field">
              <label htmlFor="watch-off-route">Écart à la trace (m)</label>
              <input
                id="watch-off-route"
                type="number"
                min={0}
                value={offRouteM}
                onChange={(event) => setOffRouteM(event.target.value)}
              />
            </div>
            <label className="lkv-watch__check">
              <input
                type="checkbox"
                checked={offRoute}
                onChange={(event) => setOffRoute(event.target.checked)}
              />
              Hors trace
            </label>
          </div>

          <dl className="lkv-watch__metrics lkv-watch__metrics--fields">
            {fields.map((field) => (
              <div key={field.key} data-available={field.available}>
                <dt>{field.label}</dt>
                <dd>
                  <strong>{field.formatted}</strong>{' '}
                  {field.available ? null : (
                    <StatusPill tone="warning">
                      <ShieldQuestion size={12} aria-hidden="true" /> indisponible
                    </StatusPill>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {frameError ? <Notice tone="error">{frameError}</Notice> : null}
          <div className="lkv-watch__actions">
            <Button variant="primary" onClick={() => void buildFrame()} disabled={busy}>
              <Send size={15} aria-hidden="true" /> Construire la trame
            </Button>
            <Button variant="ghost" onClick={() => void handoff('watch')} disabled={busy}>
              Enregistrer sur la montre
            </Button>
            <Button variant="ghost" onClick={() => void handoff('phone')} disabled={busy}>
              Repasser sur le téléphone
            </Button>
          </div>
          {handoffMessage ? <Notice tone="info">{handoffMessage}</Notice> : null}
        </Card>
      </Section>

      <Section
        title="Repères à venir"
        hint="Triés par distance restante le long de l’itinéraire, avec delta d’altitude."
      >
        {upcomingPois.length === 0 ? (
          <EmptyState title="Aucun repère à venir">
            Aucun POI n’est fourni pour cette séance, ou tous sont déjà dépassés. L’écran
            n’en fabrique aucun.
          </EmptyState>
        ) : (
          <ul className="lkv-watch__list">
            {upcomingPois.map((poi) => (
              <li key={poi.id}>
                <Card as="article" className="lkv-watch__poi">
                  <div className="lkv-watch__row">
                    <strong>{poi.name}</strong>
                    <StatusPill tone="neutral">{poi.category}</StatusPill>
                  </div>
                  <p className="lkv-watch__hint">
                    {formatDistanceMeters(poi.distanceRemainingM)} restants
                    {poi.elevationDeltaM === null
                      ? ' · altitude non disponible'
                      : ` · ${poi.elevationDeltaM > 0 ? '+' : ''}${poi.elevationDeltaM} m`}
                  </p>
                  {poi.maneuverInstruction ? (
                    <p className="lkv-watch__hint">{poi.maneuverInstruction}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {frame ? (
        <Card>
          <p className="lkv-watch__hint">
            Dernière trame n° {frame.frameSeq} · {formatDateTime(frame.sentAtUtcMs)} · génération{' '}
            {frame.sourceGeneration} · source {frame.sourceOwner}.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
