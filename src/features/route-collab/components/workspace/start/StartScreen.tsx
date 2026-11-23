'use client';

import './start.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import type { ImportableTrackEntry } from '@/app/api/routes/history/route';
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import { isFitFileName, parseTrackFile } from '../../../insights/formats';
import {
  EXPLORER_IMPORT_KEY,
  readExplorerImport,
  startBlank,
  startFromCatalogTrack,
  startFromParsedTrack,
  startFromPlace,
  type CatalogTrack,
  type StartContext,
} from '../../../startBuilders';
import { placeLabel, readGeocodeMatches, readStartPhrase, type PlaceMatch, type StartIntent } from '../../../startIntent';
import type { TripEntry } from '../../../entry';
import type { RouteWorkspaceState } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { useRouteEntry, type RouteGoal, type TripLinkState } from './RouteEntryContext';
import { loginHrefForRoute } from '../../../guestDraft';

const SPORTS: ReadonlyArray<{ id: RouteSport; label: string }> = [
  { id: 'marche', label: 'À pied' },
  { id: 'route', label: 'Vélo de route' },
  { id: 'gravel', label: 'Gravel' },
  { id: 'vtt', label: 'VTT' },
  { id: 'enduro', label: 'Moto enduro' },
];

const sportName = (s: RouteSport) => SPORTS.find((x) => x.id === s)?.label ?? s;

type Step = 'tiles' | 'phrase' | 'explorer' | 'gpx' | 'past';
type SportSource = 'trip' | 'draft' | 'phrase' | 'manual' | 'default';

export interface StartScreenProps {
  trip: TripEntry | null;
  tripLink: TripLinkState;
  userId: string;
  userName: string;
  onStart: (workspace: RouteWorkspaceState, goal: RouteGoal | null) => void;
}

const MAX_FILE_BYTES = 8_000_000;

/**
 * Premier écran : une seule question, « D'où pars-tu ? », et cinq départs en tuiles (1.3). Vue simple : une
 * décision à la fois ; vue experte : la lecture détaillée de la phrase et la source du profil.
 */
export function StartScreen({ trip, tripLink, userId, userName, onStart }: StartScreenProps) {
  const { expert } = useRouteViewMode();
  const entry = useRouteEntry();
  const [step, setStep] = useState<Step>('tiles');
  const [sport, setSport] = useState<RouteSport>(trip?.sport ?? 'marche');
  const [sportSource, setSportSource] = useState<SportSource>(trip ? (trip.sportFrom === 'draft' ? 'draft' : trip.sportFrom === 'activity' ? 'trip' : 'default') : 'default');
  const [sportOpen, setSportOpen] = useState(false);

  const ctx = useCallback(
    (): StartContext => ({
      trip,
      userId,
      userName,
      nowIso: new Date().toISOString(),
      idSeed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    }),
    [trip, userId, userName],
  );

  const pickSport = (s: RouteSport) => {
    setSport(s);
    setSportSource('manual');
    setSportOpen(false);
  };

  const sportWhy =
    sportSource === 'trip'
      ? 'hérité de l’activité du voyage'
      : sportSource === 'draft'
        ? 'repris du tracé du Compas'
        : sportSource === 'phrase'
          ? 'lu dans votre phrase'
          : sportSource === 'manual'
            ? 'choisi par vous'
            : 'par défaut';

  return (
    <div className="xp-root rcw-start" data-theme="light" data-testid="route-start-screen">
      <div className="rcw-start-card">
        <p className="rcw-start-eyebrow">
          {trip ? `Voyage · ${trip.title ?? trip.destinationName ?? 'sans titre'}` : 'Itinéraire'}
        </p>
        <h1 className="rcw-start-title">D’où pars-tu ?</h1>

        {entry.saveNote && !trip ? (
          <p className="rcw-start-note" role="status" data-testid="start-entry-note">
            {entry.saveNote}
          </p>
        ) : null}

        {tripLink === 'invalid' || tripLink === 'not_found' || tripLink === 'error' ? (
          <p className="rcw-start-note" role="status" data-testid="start-trip-note">
            {tripLink === 'invalid'
              ? 'Le lien du voyage est illisible : l’itinéraire s’ouvre sans voyage.'
              : tripLink === 'not_found'
                ? 'Voyage introuvable ou privé : l’itinéraire s’ouvre sans voyage.'
                : 'Le voyage n’a pas pu être lu pour l’instant : l’itinéraire s’ouvre sans voyage.'}
          </p>
        ) : null}

        <div className="rcw-start-sport">
          <span>
            Profil : <strong>{sportName(sport)}</strong>
            {expert || sportSource !== 'default' ? <em> · {sportWhy}</em> : null}
          </span>
          <button
            type="button"
            className="rcw-start-link"
            aria-expanded={sportOpen}
            onClick={() => setSportOpen((v) => !v)}
            data-testid="start-sport-toggle"
          >
            {sportOpen ? 'Replier' : 'Changer'}
          </button>
        </div>
        {sportOpen ? (
          <div className="rcw-start-sports" role="group" aria-label="Profil de routage" data-testid="start-sport-row">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="rcw-start-chip"
                aria-pressed={sport === s.id}
                onClick={() => pickSport(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}

        {step === 'tiles' ? (
          <Tiles onPick={(next) => (next === 'blank' ? onStart(startBlank(ctx(), { sport }), null) : setStep(next))} />
        ) : (
          <div className="rcw-start-panel">
            <button type="button" className="rcw-start-back" onClick={() => setStep('tiles')} data-testid="start-back">
              <XpIcon name="chevl" size={14} /> Autre départ
            </button>
            {step === 'phrase' ? (
              <PhrasePanel
                expert={expert}
                onSportRead={(s) => {
                  setSport(s);
                  setSportSource('phrase');
                }}
                onConfirm={(place, intent) => {
                  const chosen = intent.sport ?? sport;
                  onStart(
                    startFromPlace(ctx(), place, { sport: chosen, shapeMode: intent.shape ?? undefined }),
                    { distanceKm: intent.distanceKm, shape: intent.shape, placeLabel: placeLabel(place) },
                  );
                }}
              />
            ) : null}
            {step === 'gpx' ? <GpxPanel ctx={ctx} sport={sport} onReady={(ws) => onStart(ws, null)} /> : null}
            {step === 'explorer' ? (
              <TrackPanel
                mode="explorer"
                onPick={(track) => {
                  const r = startFromCatalogTrack(ctx(), track, 'explorer', { sport });
                  return r.ok ? (onStart(r.workspace, null), null) : r.error;
                }}
              />
            ) : null}
            {step === 'past' ? (
              <TrackPanel
                mode="past"
                onPick={(track) => {
                  const r = startFromCatalogTrack(ctx(), track, 'activity', { sport });
                  return r.ok ? (onStart(r.workspace, null), null) : r.error;
                }}
              />
            ) : null}
          </div>
        )}

        {!trip && step === 'tiles' ? (
          <p className="rcw-start-note" data-testid="start-attach-note">
            Cet itinéraire n’est rattaché à aucun voyage.{' '}
            {entry.requestAttach ? (
              <button type="button" className="rcw-start-link" onClick={entry.requestAttach} data-testid="start-attach-action">
                Rattacher à un voyage
              </button>
            ) : (
              <>
                <Link href={loginHrefForRoute(null)} className="rcw-start-link">
                  Rattacher à un voyage
                </Link>{' '}
                (après connexion : le choix du voyage vous sera proposé, votre tracé est gardé)
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Les cinq tuiles ---------- */

function Tiles({ onPick }: { onPick: (s: 'blank' | 'phrase' | 'explorer' | 'gpx' | 'past') => void }) {
  const items: ReadonlyArray<{ id: 'blank' | 'phrase' | 'explorer' | 'gpx' | 'past'; icon: string; title: string; sub: string }> = [
    { id: 'blank', icon: 'map', title: 'Carte vide', sub: 'Poser les points soi-même' },
    { id: 'phrase', icon: 'search', title: 'Une phrase', sub: '« Boucle de 15 km autour d’Annecy »' },
    { id: 'explorer', icon: 'mtn', title: 'Tracé Explorer', sub: 'Repartir d’un tracé du catalogue' },
    { id: 'gpx', icon: 'route', title: 'Mon GPX', sub: 'GPX, KML, TCX ou GeoJSON' },
    { id: 'past', icon: 'clock', title: 'Sortie passée', sub: 'Une sortie ou un carnet à refaire' },
  ];
  return (
    <div className="rcw-start-tiles" role="list">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="listitem"
          className="rcw-start-tile"
          data-testid={`start-tile-${it.id}`}
          onClick={() => onPick(it.id)}
        >
          <span className="rcw-start-tile-ico" aria-hidden="true">
            <XpIcon name={it.icon} size={18} />
          </span>
          <span className="rcw-start-tile-text">
            <strong>{it.title}</strong>
            <span>{it.sub}</span>
          </span>
          <XpIcon name="chevr" size={14} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Phrase libre : lecture, lieu, confirmation ---------- */

function PhrasePanel({
  expert,
  onSportRead,
  onConfirm,
}: {
  expert: boolean;
  onSportRead: (s: RouteSport) => void;
  onConfirm: (place: PlaceMatch, intent: StartIntent) => void;
}) {
  const [text, setText] = useState('');
  const [intent, setIntent] = useState<StartIntent | null>(null);
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [chosen, setChosen] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'searching' | 'none' | 'unavailable'>('idle');
  const [correcting, setCorrecting] = useState(false);
  const [other, setOther] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const search = useCallback(async (query: string) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setStatus('searching');
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: ctl.signal });
      if (!res.ok) {
        setMatches([]);
        setStatus(res.status === 503 ? 'unavailable' : 'none');
        return;
      }
      const found = readGeocodeMatches(await res.json());
      setMatches(found);
      setChosen(0);
      setStatus(found.length > 0 ? 'idle' : 'none');
    } catch {
      if (!ctl.signal.aborted) setStatus('unavailable');
    }
  }, []);

  const read = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const r = readStartPhrase(text, today);
    setIntent(r);
    setCorrecting(false);
    setMatches([]);
    if (r.sport) onSportRead(r.sport);
    if (r.place) void search(r.place);
    else setStatus(r.empty ? 'idle' : 'none');
  }, [onSportRead, search, text]);

  const place = matches[chosen] ?? null;

  return (
    <div data-testid="start-phrase-panel">
      <label className="rcw-start-label" htmlFor="rcw-start-phrase">
        Dis-le avec tes mots
      </label>
      <div className="rcw-start-row">
        <input
          id="rcw-start-phrase"
          className="rcw-start-input"
          type="text"
          inputMode="text"
          maxLength={240}
          placeholder="Boucle de 15 km autour d’Annecy"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') read();
          }}
          data-testid="start-phrase-input"
        />
        <button type="button" className="rcw-start-primary" onClick={read} disabled={!text.trim()} data-testid="start-phrase-read">
          Lire
        </button>
      </div>

      {intent && !intent.empty ? (
        <div className="rcw-start-read" data-testid="start-understood">
          <p className="rcw-start-label">Voici ce que j’ai compris</p>
          <ul>
            {(expert ? intent.lines : intent.lines.filter((l) => l.key === 'lieu' || l.key === 'activite' || l.key === 'quand')).map((l) => (
              <li key={l.key}>
                <span>{l.label}</span> <strong>{l.value}</strong>
                {expert ? <em> · {l.state}</em> : null}
              </li>
            ))}
            {intent.distanceKm != null ? (
              <li>
                <span>Distance visée</span> <strong>{intent.distanceKm} km</strong>
              </li>
            ) : null}
            {intent.shape ? (
              <li>
                <span>Forme</span> <strong>{intent.shape === 'loop' ? 'Boucle' : 'Aller-retour'}</strong>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {status === 'searching' ? <p className="rcw-start-note" role="status">Recherche du lieu…</p> : null}
      {status === 'unavailable' ? (
        <p className="rcw-start-note" role="status">Recherche de lieu indisponible pour l’instant. Réessayez dans un instant.</p>
      ) : null}
      {status === 'none' && intent ? (
        <p className="rcw-start-note" role="status" data-testid="start-place-none">
          {intent.place ? `Aucun lieu retrouvé pour « ${intent.place} ».` : 'Aucun lieu lu dans la phrase.'} Indiquez-en un ci-dessous.
        </p>
      ) : null}

      {place ? (
        <div className="rcw-start-confirm" data-testid="start-place-confirm">
          <p className="rcw-start-label">Départ</p>
          <p className="rcw-start-place">
            <XpIcon name="pin" size={16} /> <strong>{placeLabel(place)}</strong>
          </p>
          {place.precision === 'inexact' ? <p className="rcw-start-note">Position approximative : ce n’est pas une commune.</p> : null}
          <div className="rcw-start-row">
            <button type="button" className="rcw-start-primary" onClick={() => intent && onConfirm(place, intent)} data-testid="start-place-ok">
              C’est bien là
            </button>
            <button type="button" className="rcw-start-secondary" aria-expanded={correcting} onClick={() => setCorrecting((v) => !v)} data-testid="start-place-fix">
              Corriger
            </button>
          </div>
        </div>
      ) : null}

      {correcting || (status === 'none' && intent) ? (
        <div className="rcw-start-fix" data-testid="start-place-alternatives">
          {matches.length > 1 ? (
            <XpRows>
              {matches.map((m, i) => (
                <XpRow
                  key={m.id}
                  icon="pin"
                  tone={i === chosen ? 'good' : 'ink'}
                  title={placeLabel(m)}
                  ariaPressed={i === chosen}
                  onClick={() => {
                    setChosen(i);
                    setCorrecting(false);
                  }}
                />
              ))}
            </XpRows>
          ) : null}
          <div className="rcw-start-row">
            <input
              className="rcw-start-input"
              type="text"
              maxLength={120}
              placeholder="Autre lieu (ville, vallée, lac…)"
              aria-label="Autre lieu"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && other.trim().length >= 2) void search(other.trim());
              }}
              data-testid="start-place-other"
            />
            <button type="button" className="rcw-start-secondary" disabled={other.trim().length < 2} onClick={() => void search(other.trim())}>
              Chercher
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- GPX, KML, TCX, GeoJSON ---------- */

function GpxPanel({
  ctx,
  sport,
  onReady,
}: {
  ctx: () => StartContext;
  sport: RouteSport;
  onReady: (ws: RouteWorkspaceState) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ ws: RouteWorkspaceState; name: string; count: number; reduced: boolean } | null>(null);

  const onFile = async (file: File | undefined) => {
    setError(null);
    setReady(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('Fichier trop volumineux (8 Mo au plus).');
      return;
    }
    let text = '';
    let parsed: ReturnType<typeof parseTrackFile>;
    try {
      // 5.9 : un FIT est binaire (ArrayBuffer), les autres formats sont lus en texte.
      if (isFitFileName(file.name)) parsed = parseTrackFile(await file.arrayBuffer(), file.name);
      else {
        text = await file.text();
        parsed = parseTrackFile(text, file.name);
      }
    } catch {
      setError('Impossible de lire ce fichier.');
      return;
    }
    if (!parsed.ok) {
      setError(parsed.error.message);
      return;
    }
    const r = startFromParsedTrack(ctx(), parsed, { name: file.name, text }, { sport });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setReady({ ws: r.workspace, name: file.name, count: r.pointCount, reduced: r.reduced });
  };

  const km = ready?.ws.sections[0]?.distanceKm;
  return (
    <div data-testid="start-gpx-panel">
      <label className="rcw-start-file">
        <span className="rcw-start-primary">Choisir un fichier</span>
        <input
          type="file"
          accept=".gpx,.kml,.tcx,.geojson,.json,.fit,application/gpx+xml,application/json"
          onChange={(e) => void onFile(e.target.files?.[0])}
          data-testid="start-gpx-input"
        />
      </label>
      <p className="rcw-start-note">GPX, KML, TCX ou GeoJSON. Le tracé garde sa géométrie : rien n’est recollé aux routes sans votre demande.</p>
      {error ? (
        <p className="rcw-start-error" role="alert" data-testid="start-gpx-error">
          {error}
        </p>
      ) : null}
      {ready ? (
        <div className="rcw-start-confirm" data-testid="start-gpx-ready">
          <p className="rcw-start-place">
            <XpIcon name="route" size={16} /> <strong>{ready.ws.title}</strong>
          </p>
          <p className="rcw-start-note">
            {ready.count.toLocaleString('fr-FR')} points{km != null ? ` · ${km.toLocaleString('fr-FR')} km` : ''}
            {ready.ws.sections[0]?.ascentM == null ? ' · altitude absente' : ` · D+ ${ready.ws.sections[0].ascentM} m`}
            {ready.reduced ? ' · tracé réduit à 20 000 points' : ''}
          </p>
          <button type="button" className="rcw-start-primary" onClick={() => onReady(ready.ws)} data-testid="start-gpx-use">
            Utiliser ce tracé
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Tracé Explorer, sortie passée ---------- */

function TrackPanel({ mode, onPick }: { mode: 'explorer' | 'past'; onPick: (t: CatalogTrack) => string | null }) {
  const [items, setItems] = useState<ImportableTrackEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromExplorer = useMemo<CatalogTrack | null>(() => {
    if (mode !== 'explorer' || typeof window === 'undefined') return null;
    try {
      return readExplorerImport(window.sessionStorage.getItem(EXPLORER_IMPORT_KEY));
    } catch {
      return null;
    }
  }, [mode]);

  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/routes/history', { credentials: 'include', signal: ctl.signal });
        if (!res.ok) throw new Error('history');
        const data = (await res.json()) as { items?: ImportableTrackEntry[] };
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!ctl.signal.aborted) {
          setFailed(true);
          setItems([]);
        }
      }
    })();
    return () => ctl.abort();
  }, []);

  const rows = (items ?? []).filter((i) => (mode === 'explorer' ? i.kind === 'randonnee' : i.kind !== 'randonnee'));

  return (
    <div data-testid={`start-${mode}-panel`}>
      {fromExplorer ? (
        <XpRows>
          <XpRow
            icon="mtn"
            tone="good"
            title={`Reprendre « ${fromExplorer.title} »`}
            sub="Tracé reçu de l’Explorer"
            onClick={() => setError(onPick(fromExplorer))}
            trailing={<XpIcon name="chevr" size={14} />}
          />
        </XpRows>
      ) : null}
      {items === null ? <p className="rcw-start-note" role="status">Chargement…</p> : null}
      {failed ? <p className="rcw-start-error" role="alert">Liste indisponible pour l’instant. Réessayez plus tard.</p> : null}
      {items && !failed && rows.length === 0 && !fromExplorer ? (
        <p className="rcw-start-note" data-testid="start-track-empty">
          {mode === 'explorer'
            ? 'Aucun tracé du catalogue à proposer ici. Ouvrez un tracé dans l’Explorer pour le reprendre.'
            : 'Aucune sortie enregistrée avec un tracé. Connectez-vous pour retrouver vos sorties et carnets.'}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <XpRows>
          {rows.map((r) => (
            <XpRow
              key={r.id}
              icon={mode === 'explorer' ? 'mtn' : 'clock'}
              title={r.title}
              sub={[r.subtitle, r.distanceKm != null ? `${r.distanceKm} km` : null].filter(Boolean).join(' · ')}
              onClick={() => setError(onPick({ id: r.id, kind: r.kind, title: r.title, coordinates: r.coordinates }))}
              trailing={<XpIcon name="chevr" size={14} />}
            />
          ))}
        </XpRows>
      ) : null}
      {mode === 'explorer' ? (
        <p className="rcw-start-note">
          <Link href="/explorer" className="rcw-start-link">Parcourir l’Explorer</Link>
        </p>
      ) : null}
      {error ? <p className="rcw-start-error" role="alert">{error}</p> : null}
    </div>
  );
}
