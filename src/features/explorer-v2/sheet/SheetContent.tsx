'use client';

import React from 'react';
import { XpIcon } from '../ui/XpIcon';
import { ElevationProfile } from './ElevationProfile';
import {
  XpAvatars,
  XpCard,
  XpCardRow,
  XpChips,
  XpEmpty,
  XpEyebrow,
  XpMetrics,
  XpRow,
  XpRows,
} from './blocks';
import type { SheetTab } from './ExplorerSheet';
import {
  POI_ICON,
  POI_LABEL,
  POI_TONE,
  SPORT_META,
  distanceKm,
  findRegionAt,
  formatDistance,
  formatElevation,
  formatDuration,
  relativeDay,
  type SheetContext,
} from './context';
import type { Sport } from '../state/types';

export interface SheetModel {
  title: string;
  subtitle: string | null;
  tabs: SheetTab[];
  tabsBottom?: boolean;
  mini: { items: Array<{ id: string; label: string; icon: string }>; value: number; onChange: (i: number) => void } | null;
  actions: React.ReactNode;
  onBack?: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  water: 'Point d’eau',
  snow_ice: 'Neige / glace',
  danger: 'Danger',
  closure: 'Fermeture',
  obstacle: 'Obstacle',
  mud: 'Boue',
  rockfall: 'Chutes de pierres',
  flood: 'Crue',
};

const SPORTS: Sport[] = ['course', 'rando', 'velo', 'kayak', 'trail', 'ski', 'escalade', 'famille', 'bivouac'];

function CarnetsTab({ ctx, where }: { ctx: SheetContext; where: string }) {
  const items = ctx.carnets;
  if (items.length === 0) {
    return (
      <XpEmpty
        title="Aucun carnet publié"
        hint={`Personne n’a encore publié de carnet public ${where}.`}
      />
    );
  }
  return (
    <XpRows>
      {items.map((carnet) => (
        <XpRow
          key={carnet.id}
          icon="book"
          title={carnet.title}
          sub={[
            carnet.destination,
            carnet.distance_km ? `${carnet.distance_km.toFixed(1).replace('.', ',')} km` : null,
            carnet.nb_nuits ? `${carnet.nb_nuits} nuit(s)` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={
            carnet.likes_count && carnet.likes_count > 0
              ? { label: `${carnet.likes_count} ❤`, tone: 'muted' }
              : undefined
          }
        />
      ))}
    </XpRows>
  );
}

function TripsTab({ ctx, where }: { ctx: SheetContext; where: string }) {
  const items = ctx.trips;
  if (items.length === 0) {
    return <XpEmpty title="Aucun départ ouvert" hint={`Aucun départ public n’est programmé ${where}.`} />;
  }
  return (
    <XpRows>
      {items.map((trip) => (
        <XpRow
          key={trip.id}
          icon="users"
          title={trip.title}
          sub={[
            trip.destination_name,
            trip.start_date ? new Date(trip.start_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null,
            trip.party_size ? `${trip.party_size} pers.` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={trip.difficulty ? { label: trip.difficulty, tone: 'muted' } : undefined}
        />
      ))}
    </XpRows>
  );
}

function EmptyCarnets({ where }: { where: string }) {
  return (
    <XpEmpty
      title="Aucun carnet publié"
      hint={`Personne n’a encore publié de carnet public ${where}.`}
    />
  );
}

function EmptyAmis() {
  return <XpEmpty title="Aucune position partagée" hint="Tes amis n’ont pas partagé leur position maintenant." />;
}

function RoutesTab({ ctx }: { ctx: SheetContext }) {
  if (ctx.routes.length === 0) {
    return <XpEmpty title="Aucun itinéraire référencé" hint="Aucune trace OSM n’est encore enregistrée dans cette zone." />;
  }
  return (
    <XpRows>
      {ctx.routes.slice(0, 12).map((route) => (
        <XpRow
          key={route.id}
          icon="route"
          title={route.name || `Itinéraire ${route.ref ?? route.id}`}
          sub={[
            route.distance_km ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : null,
            route.network === 'iwn' ? 'GR® international' : route.network === 'nwn' ? 'GR®' : route.network === 'rwn' ? 'PR' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          badge={route.ref ? { label: route.ref, tone: 'muted' } : undefined}
          onClick={() => ctx.state.select({ kind: 'trail', id: String(route.id) }, 'trail', 'mid')}
        />
      ))}
    </XpRows>
  );
}

function PoiSummaryTab({ ctx }: { ctx: SheetContext }) {
  const groups = new Map<string, typeof ctx.pois>();
  for (const poi of ctx.pois) {
    if (!groups.has(poi.kind)) groups.set(poi.kind, []);
    groups.get(poi.kind)!.push(poi);
  }
  if (ctx.pois.length === 0) {
    return <XpEmpty title="Rien à signaler ici" hint="Aucun repère enregistré dans cette fenêtre." />;
  }
  return (
    <>
      {[...groups.entries()].map(([kind, items]) => (
        <React.Fragment key={kind}>
          <XpEyebrow>{`${POI_LABEL[kind] ?? kind} · ${items.length}`}</XpEyebrow>
          <XpRows>
            {items.slice(0, 5).map((poi) => (
              <XpRow
                key={poi.id}
                icon={POI_ICON[kind] ?? 'pin'}
                tone={POI_TONE[kind] ?? 'ink'}
                title={poi.name}
                sub={[formatElevation(poi.ele_m), poi.potable ? 'potable' : null]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => ctx.state.select({ kind: kind as never, id: poi.id }, kind as never, 'mid')}
              />
            ))}
          </XpRows>
        </React.Fragment>
      ))}
    </>
  );
}

function CountryPratiqueTab({ ctx }: { ctx: SheetContext }) {
  const country = ctx.country;
  if (!country) {
    return <XpEmpty title="Informations indisponibles" hint="Aucune donnée pays n’est enregistrée pour ce pays." />;
  }
  const practical = country.practical;
  const emergency = practical?.emergency_numbers && Object.values(practical.emergency_numbers).filter(Boolean);
  return (
    <>
      <XpMetrics
        items={[
          ...(country.capital ? [{ label: 'Capitale', value: country.capital }] : []),
          ...(country.currency_code ? [{ label: 'Monnaie', value: country.currency_code }] : []),
          ...(country.phone_code ? [{ label: 'Indicatif', value: `+${country.phone_code}` }] : []),
        ]}
      />
      <XpEyebrow>Urgences</XpEyebrow>
      {emergency && emergency.length > 0 ? (
        <XpRows>
          {Object.entries(practical?.emergency_numbers ?? {}).map(([label, number]) => (
            <XpRow key={label} icon="shield" tone="bad" title={number} sub={label} />
          ))}
        </XpRows>
      ) : (
        <XpEmpty title="Numéros non disponibles" hint="Le numéro d’urgence local n’est pas encore documenté pour ce pays." />
      )}
      <XpEyebrow>Voyager</XpEyebrow>
      <XpRows>
        {practical?.plug_types && practical.plug_types.length > 0 ? (
          <XpRow icon="vol" title={practical.plug_types.join(', ')} sub="Prises" />
        ) : null}
        {practical?.driving_side ? (
          <XpRow icon="nav" title={practical.driving_side === 'left' ? 'À gauche' : 'À droite'} sub="Conduite" />
        ) : null}
        {country.timezone ? <XpRow icon="clock" title={country.timezone} sub="Fuseau horaire" /> : null}
      </XpRows>
    </>
  );
}

function LevelTabs(ctx: SheetContext): SheetTab[] {
  const { state, place } = ctx;
  const counts = place?.place?.counts;

  if (state.level === 0) {
    const nearest = ctx.countries
      .filter((country) => country.center)
      .map((country) => ({
        country,
        km: distanceKm(state.center, country.center as [number, number]),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);

    return [
      {
        id: 'pour-toi',
        label: 'Pour toi',
        icon: 'star',
        render: () => (
          <>
            <XpCardRow>
              {nearest.map(({ country, km }) => (
                <XpCard
                  key={country.iso}
                  title={country.name}
                  sub={formatDistance(km)}
                  initial={country.iso}
                  onClick={() =>
                    state.openCountry(country.iso, country.center as [number, number], country.name)
                  }
                />
              ))}
            </XpCardRow>
            <XpEyebrow>Explorer ailleurs</XpEyebrow>
            <XpCardRow>
              {ctx.countries
                .filter((country) => ['JP', 'US', 'CL', 'MN', 'NP', 'IS'].includes(country.iso))
                .map((country) => (
                  <XpCard
                    key={country.iso}
                    title={country.name}
                    sub={country.continent ?? undefined}
                    initial={country.iso}
                    onClick={() =>
                      state.openCountry(country.iso, country.center as [number, number], country.name)
                    }
                  />
                ))}
            </XpCardRow>
            <XpEyebrow>Autour de ce point</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Itinéraires', value: String(counts?.routes ?? 0) },
                { label: 'Points d’eau', value: String(counts?.water ?? 0) },
                { label: 'Refuges', value: String(counts?.refuges ?? 0) },
              ]}
            />
          </>
        ),
      },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans le monde" /> },
      {
        id: 'empreinte',
        label: 'Empreinte',
        icon: 'foot',
        render: () => (
          <XpEmpty
            title="Ton empreinte apparaîtra ici"
            hint="Connecte-toi pour voir les pays et les sorties enregistrés."
          />
        ),
      },
    ];
  }

  if (state.level === 1) {
    const groups = ctx.regionGroups.slice(0, 8);
    return [
      {
        id: 'apercu',
        label: 'Aperçu',
        icon: 'info',
        render: () => (
          <>
            {groups.length > 0 ? (
              <>
                <XpEyebrow>Régions</XpEyebrow>
                <XpCardRow>
                  {groups.map((group) => (
                    <XpCard
                      key={group.group}
                      title={group.group}
                      sub={`${group.units} ${group.units > 1 ? 'unités' : 'unité'}`}
                      icon="map"
                      onClick={() =>
                        group.center && state.openRegion(group.group, group.center, group.group)
                      }
                    />
                  ))}
                </XpCardRow>
              </>
            ) : (
              <XpEmpty title="Régions non disponibles" hint="Aucune région n’est encore documentée pour ce pays." />
            )}
            <XpEyebrow>Autour de ce point</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Itinéraires', value: String(counts?.routes ?? 0) },
                { label: 'Points d’eau', value: String(counts?.water ?? 0) },
                { label: 'Refuges', value: String(counts?.refuges ?? 0) },
              ]}
            />
          </>
        ),
      },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans ce pays" /> },
      { id: 'departs', label: 'Départs', icon: 'users', render: () => <TripsTab ctx={ctx} where="dans ce pays" /> },
      { id: 'pratique', label: 'Pratique', icon: 'bag', render: () => <CountryPratiqueTab ctx={ctx} /> },
    ];
  }

  if (state.level === 2) {
    const units = (ctx.regionsGeo?.features ?? []).filter(
      (feature) => (feature.properties as { group?: string }).group === state.regionId,
    );
    return [
      {
        id: 'apercu',
        label: 'Aperçu',
        icon: 'info',
        render: () => (
          <>
            {units.length > 0 ? (
              <>
                <XpEyebrow>{`${units.length} unités`}</XpEyebrow>
                <XpRows>
                  {units.slice(0, 10).map((unit) => {
                    const props = unit.properties as { name?: string; type_en?: string };
                    return <XpRow key={`${props.name}`} icon="map" title={props.name ?? '—'} sub={props.type_en ?? undefined} />;
                  })}
                </XpRows>
              </>
            ) : (
              <XpEmpty title="Massifs non disponibles" hint="Aucune donnée locale n’est enregistrée pour cette région." />
            )}
            <XpEyebrow>Autour de ce point</XpEyebrow>
            <XpMetrics
              items={[
                { label: 'Itinéraires', value: String(counts?.routes ?? 0) },
                { label: 'Points d’eau', value: String(counts?.water ?? 0) },
                { label: 'Refuges', value: String(counts?.refuges ?? 0) },
              ]}
            />
          </>
        ),
      },
      { id: 'randos', label: 'Randos', icon: 'hike', render: () => <RoutesTab ctx={ctx} /> },
      { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="dans cette région" /> },
      { id: 'departs', label: 'Départs', icon: 'users', render: () => <TripsTab ctx={ctx} where="dans cette région" /> },
    ];
  }

  return [
    { id: 'autour', label: 'Autour', icon: 'target', render: () => <PoiSummaryTab ctx={ctx} /> },
    { id: 'randos', label: 'Randos', icon: 'hike', render: () => <RoutesTab ctx={ctx} /> },
    { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <CarnetsTab ctx={ctx} where="ici" /> },
    { id: 'amis', label: 'Amis', icon: 'users', render: () => <EmptyAmis /> },
  ];
}

function PoiTabs(ctx: SheetContext, kind: string): SheetTab[] {
  const poi = ctx.selectedPoi;
  const weather = ctx.weather;
  const access: SheetTab = {
    id: 'acces',
    label: 'Accès',
    icon: 'hike',
    render: () =>
      poi ? (
        <XpMetrics
          items={[
            { label: 'Latitude', value: poi.lat.toFixed(4) },
            { label: 'Longitude', value: poi.lon.toFixed(4) },
            ...(poi.ele_m !== null ? [{ label: 'Altitude', value: formatElevation(poi.ele_m) as string }] : []),
          ]}
        />
      ) : (
        <XpEmpty title="Accès inconnu" hint="Aucun accès documenté pour ce repère." />
      ),
  };
  const meteo: SheetTab = {
    id: 'meteo',
    label: 'Météo',
    icon: 'cloud',
    render: () =>
      weather && weather.hours.length > 0 ? (
        <>
          <XpEyebrow>Prévisions · MET Norway</XpEyebrow>
          <XpRows>
            {weather.hours.slice(0, 4).map((hour) => (
              <XpRow
                key={hour.time}
                icon="cloud"
                title={
                  hour.temperature_c !== null ? `${Math.round(hour.temperature_c)} °C` : 'Température inconnue'
                }
                sub={new Date(hour.time).toLocaleString('fr-FR', {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                badge={hour.wind_ms !== null ? { label: `${Math.round(hour.wind_ms * 3.6)} km/h`, tone: 'muted' } : undefined}
              />
            ))}
          </XpRows>
        </>
      ) : (
        <XpEmpty title="Prévisions indisponibles" hint="La météo de ce point n’est pas accessible maintenant." />
      ),
  };

  const overview: SheetTab = {
    id: 'apercu',
    label: 'Aperçu',
    icon: 'info',
    render: () =>
      poi ? (
        <>
          <XpMetrics
            items={[
              ...(poi.ele_m !== null ? [{ label: 'Altitude', value: formatElevation(poi.ele_m) as string }] : []),
              ...(poi.capacity !== null ? [{ label: 'Places', value: String(poi.capacity) }] : []),
              { label: 'Distance', value: formatDistance(distanceKm(ctx.state.center, [poi.lon, poi.lat])) },
            ]}
          />
          <XpEyebrow>Repère</XpEyebrow>
          <XpRows>
            <XpRow icon={POI_ICON[kind] ?? 'pin'} tone={POI_TONE[kind] ?? 'ink'} title={POI_LABEL[kind] ?? kind} sub={poi.subtype} />
          </XpRows>
        </>
      ) : (
        <XpEmpty title="Repère introuvable" hint="Ce repère n’est pas encore enregistré dans la base." />
      ),
  };

  const nearbyReports = ctx.reports
    .filter((report) => report.category === 'water' || report.category === 'snow_ice')
    .slice(0, 5);
  const etat: SheetTab = {
    id: 'etat',
    label: 'État',
    icon: 'drop',
    render: () =>
      poi ? (
        <>
          <XpRows>
            <XpRow
              icon="drop"
              tone="water"
              title={poi.potable === false ? 'Eau non potable' : poi.potable ? 'Eau potable' : 'Qualité non renseignée'}
              sub={poi.ele_m !== null ? formatElevation(poi.ele_m) : undefined}
            />
          </XpRows>
          <XpEyebrow>Derniers signalements</XpEyebrow>
          {nearbyReports.length === 0 ? (
            <XpEmpty title="Aucun signalement" hint="Personne n’a encore signalé l’état de cette eau." />
          ) : (
            <XpRows>
              {nearbyReports.map((report) => (
                <XpRow
                  key={report.id}
                  icon={report.category === 'water' ? 'drop' : 'snow'}
                  tone={report.category === 'water' ? 'water' : 'warn'}
                  title={report.description ?? CATEGORY_LABEL[report.category] ?? report.category}
                  sub={`${relativeDay(report.created_at)} · ${report.present_count} présent · ${report.gone_count} disparu`}
                  badge={{ label: `${Math.round(report.distance_m)} m`, tone: 'muted' }}
                />
              ))}
            </XpRows>
          )}
          <XpEyebrow>Confirmer l’état</XpEyebrow>
          {nearbyReports.length === 0 ? (
            <XpEmpty title="Rien à confirmer" hint="Aucun signalement actif autour de ce point." />
          ) : (
            <XpRows>
              {nearbyReports.slice(0, 2).map((report) => (
                <XpRow
                  key={`confirm-${report.id}`}
                  icon="check"
                  tone="good"
                  title="Toujours là"
                  sub={report.description ?? CATEGORY_LABEL[report.category]}
                  onClick={() => ctx.onConfirmReport?.(report.id, 'present')}
                  trailing={
                    <span
                      role="button"
                      tabIndex={0}
                      className="xp-chip"
                      onClick={(event) => {
                        event.stopPropagation();
                        ctx.onConfirmReport?.(report.id, 'gone');
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        event.stopPropagation();
                        ctx.onConfirmReport?.(report.id, 'gone');
                      }}
                    >
                      Plus là
                    </span>
                  }
                />
              ))}
            </XpRows>
          )}
        </>
      ) : (
        <XpEmpty title="État inconnu" hint="Ce point d’eau n’est pas encore enregistré." />
      ),
  };

  if (kind === 'water') return [etat, access];
  if (kind === 'summit') return [overview, access, { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <EmptyCarnets where="ici" /> }, meteo];
  if (kind === 'viewpoint') return [overview, access, meteo];
  if (kind === 'access') return [overview, access];
  if (kind === 'danger')
    return [
      {
        id: 'detail',
        label: 'Détails',
        icon: 'alert',
        render: () => (
          <>
            <XpEmpty title="Aucun signalement actif" hint="Aucun danger n’a été signalé dans cette zone." />
          </>
        ),
      },
      access,
    ];
  return [overview, access, { id: 'carnets', label: 'Carnets', icon: 'book', render: () => <EmptyCarnets where="ici" /> }];
}

function ToolsTabs(ctx: SheetContext, kind: string): SheetTab[] {
  const { state } = ctx;
  if (kind === 'layers') {
    return [
      {
        id: 'calques',
        label: 'Calques',
        icon: 'layers',
        render: () => (
          <XpRows>
            <XpRow icon="route" title="Itinéraires" sub={String(ctx.routes.length)} />
            <XpRow icon="drop" title="Points d’eau" sub={String(ctx.pois.filter((p) => p.kind === 'water').length)} />
            <XpRow icon="house" title="Refuges" sub={String(ctx.pois.filter((p) => p.kind === 'refuge').length)} />
            <XpRow icon="tent" title="Bivouacs" sub={String(ctx.pois.filter((p) => p.kind === 'bivouac').length)} />
          </XpRows>
        ),
      },
    ];
  }
  if (kind === 'offline') {
    return [
      {
        id: 'hors-ligne',
        label: 'Hors ligne',
        icon: 'offline',
        render: () => (
          <XpEmpty
            title="Zone hors ligne"
            hint="Le téléchargement de zone n’est pas encore activé : tu peux continuer à utiliser la carte si elle est déjà chargée."
          />
        ),
      },
    ];
  }
  if (kind === 'trail') {
    const route = ctx.routes.find((item) => String(item.id) === state.selection?.id) ?? ctx.routes[0];
    const positions: Array<[number, number]> = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === 'number' && typeof value[1] === 'number') {
        positions.push([value[0] as number, value[1] as number]);
        return;
      }
      for (const child of value) walk(child);
    };
    walk((route?.geojson as { coordinates?: unknown } | undefined)?.coordinates);

    return [
      {
        id: 'trace',
        label: 'Trace',
        icon: 'route',
        render: () =>
          route ? (
            <>
              {positions.length > 1 ? <ElevationProfile positions={positions} /> : null}
              <XpMetrics
                items={[
                  { label: 'Distance', value: route.distance_km ? `${route.distance_km.toFixed(1).replace('.', ',')} km` : '—' },
                  { label: 'Réseau', value: route.ref ?? route.network ?? '—' },
                ]}
              />
              <XpEyebrow>Points d’eau sur la trace</XpEyebrow>
              <XpEmpty title="Aucun point d’eau référencé" hint="Aucune eau n’est enregistrée le long de cette trace." />
            </>
          ) : (
            <XpEmpty title="Aucune trace sélectionnée" hint="Choisis un itinéraire sur la carte." />
          ),
      },
      { id: 'conditions', label: 'Conditions', icon: 'cloud', render: () => <XpEmpty title="Aucune condition signalée" hint="Personne n’a signalé l’état de cette trace." /> },
    ];
  }
  if (kind === 'depart') {
    return [
      {
        id: 'quand',
        label: 'Quand',
        icon: 'cal',
        render: () => <XpEmpty title="Aucun départ programmé" hint="Crée un départ pour inviter d’autres membres." />,
      },
    ];
  }
  if (kind === 'search') {
    return [
      {
        id: 'recherche',
        label: 'Recherche',
        icon: 'search',
        render: () => <SearchTab ctx={ctx} />,
      },
    ];
  }
  return [{ id: 'info', label: 'Infos', icon: 'info', render: () => <XpEmpty title="Rien à afficher" hint="Aucune donnée pour cet écran." /> }];
}

function SearchTab({ ctx }: { ctx: SheetContext }) {
  const [query, setQuery] = React.useState('');
  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { countries: [], pois: [] };
    return {
      countries: ctx.countries.filter((country) => country.name.toLowerCase().includes(q)).slice(0, 5),
      pois: ctx.pois.filter((poi) => poi.name.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [ctx.countries, ctx.pois, query]);

  return (
    <>
      <input
        className="xp-searchinput"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Pays, sommet, refuge, eau…"
        aria-label="Rechercher un lieu"
        style={{
          width: '100%',
          height: 38,
          borderRadius: 12,
          border: '0.5px solid rgba(23,43,36,.16)',
          padding: '0 12px',
          background: 'rgba(255,255,255,.7)',
          fontSize: 13,
        }}
      />
      {query.trim().length < 2 ? (
        <XpEmpty title="Cherche un lieu" hint="Tape au moins deux lettres pour lancer la recherche." />
      ) : results.countries.length === 0 && results.pois.length === 0 ? (
        <XpEmpty title="Aucun résultat" hint="Aucun pays ni repère ne correspond dans les données disponibles." />
      ) : (
        <>
          {results.countries.length > 0 ? (
            <>
              <XpEyebrow>Pays</XpEyebrow>
              <XpRows>
                {results.countries.map((country) => (
                  <XpRow
                    key={country.iso}
                    icon="globe"
                    title={country.name}
                    sub={country.continent ?? undefined}
                    onClick={() =>
                      country.center && ctx.state.openCountry(country.iso, country.center, country.name)
                    }
                  />
                ))}
              </XpRows>
            </>
          ) : null}
          {results.pois.length > 0 ? (
            <>
              <XpEyebrow>Repères</XpEyebrow>
              <XpRows>
                {results.pois.map((poi) => (
                  <XpRow
                    key={poi.id}
                    icon={POI_ICON[poi.kind] ?? 'pin'}
                    tone={POI_TONE[poi.kind] ?? 'ink'}
                    title={poi.name}
                    sub={POI_LABEL[poi.kind] ?? poi.kind}
                    onClick={() => ctx.state.select({ kind: poi.kind as never, id: poi.id }, poi.kind as never, 'mid')}
                  />
                ))}
              </XpRows>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function ActivityTabs(ctx: SheetContext, kind: string): SheetTab[] {
  const { state } = ctx;
  const startSport = (sport: Sport) => {
    if (ctx.onStartSport) ctx.onStartSport(sport);
    else state.startActivity(sport);
  };
  if (kind === 'start') {
    return [
      {
        id: 'sport',
        label: 'Sport',
        icon: 'run',
        render: () => (
          <XpRows>
            {SPORTS.map((sport) => (
              <XpRow
                key={sport}
                icon={SPORT_META[sport].icon}
                title={SPORT_META[sport].label}
                sub="Démarrer maintenant"
                onClick={() => startSport(sport)}
              />
            ))}
          </XpRows>
        ),
      },
    ];
  }
  if (kind === 'live') {
    const activity = state.activity;
    return [
      {
        id: 'direct',
        label: 'Direct',
        icon: 'pulse',
        render: () =>
          activity ? (
            <>
              <XpMetrics
                items={[
                  { label: 'Distance', value: formatDistance(activity.distanceM / 1000) },
                  { label: 'D+', value: `${Math.round(activity.elevGainM)} m` },
                  { label: 'Temps', value: `${Math.floor(activity.movingS / 60)} min` },
                ]}
              />
              <XpEyebrow>Prochain repère</XpEyebrow>
              {ctx.pois[0] ? (
                <XpRows>
                  <XpRow
                    icon={POI_ICON[ctx.pois[0].kind] ?? 'pin'}
                    title={ctx.pois[0].name}
                    sub={`${formatDistance(distanceKm([activity && state.center[0], state.center[1]], [ctx.pois[0].lon, ctx.pois[0].lat]))} · ${POI_LABEL[ctx.pois[0].kind]}`}
                  />
                </XpRows>
              ) : (
                <XpEmpty title="Aucun repère devant" hint="Aucun point d’eau ni refuge n’est enregistré sur la suite du parcours." />
              )}
            </>
          ) : (
            <XpEmpty title="Aucune activité en cours" hint="Démarre une activité pour voir les métriques en direct." />
          ),
      },
    ];
  }
  if (kind === 'sos') {
    return [
      {
        id: 'sos',
        label: 'SOS',
        icon: 'shield',
        render: () => (
          <XpEmpty
            title="SOS en attente"
            hint="Maintiens le bouton rouge 1,5 s pour armer l’alerte. Aucun appel réel n’est passé en mode test."
          />
        ),
      },
    ];
  }
  if (kind === 'summary') {
    const summary = state.summary ?? null;
    return [
      {
        id: 'bilan',
        label: 'Bilan',
        icon: 'star',
        render: () => {
          if (!summary) {
            return (
              <XpEmpty
                title="Aucune sortie à résumer"
                hint="Termine une activité pour voir ton bilan."
              />
            );
          }
          const durationS = summary.movingS || (summary.endedAt - summary.startedAt) / 1000;
          return (
            <>
              <XpMetrics
                items={[
                  { label: 'Distance', value: formatDistance(summary.distanceM / 1000) },
                  { label: 'D+', value: `${Math.round(summary.elevGainM)} m` },
                  { label: 'Durée', value: formatDuration(durationS) },
                ]}
              />
              <XpEyebrow>Sortie</XpEyebrow>
              <XpRows>
                <XpRow
                  icon={SPORT_META[summary.sport].icon}
                  title={SPORT_META[summary.sport].label}
                  sub={new Date(summary.startedAt).toLocaleString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                <XpRow
                  icon={state.summarySaved === 'saved' ? 'check' : 'alert'}
                  tone={state.summarySaved === 'saved' ? 'good' : 'warn'}
                  title={
                    state.summarySaved === 'saved'
                      ? 'Sortie enregistrée'
                      : state.summarySaved === 'pending'
                        ? 'Enregistrement en cours…'
                        : state.summarySaved === 'unauthenticated'
                          ? 'Sortie non enregistrée'
                          : 'Enregistrement impossible'
                  }
                  sub={
                    state.summarySaved === 'unauthenticated'
                      ? 'Connecte-toi pour conserver tes sorties'
                      : state.summarySaved === 'failed'
                        ? 'Réessaie depuis ton compte'
                        : undefined
                  }
                />
              </XpRows>
            </>
          );
        },
      },
    ];
  }
  return [{ id: 'info', label: 'Infos', icon: 'info', render: () => <XpEmpty title="Rien à afficher" hint="" /> }];
}

function StateTabs(ctx: SheetContext): SheetTab[] {
  const { state } = ctx;
  return [
    {
      id: 'profil',
      label: 'Profil',
      icon: 'userplus',
      render: () => (
        <>
          <XpEyebrow>Pour qui explores-tu ?</XpEyebrow>
          <XpChips
            ariaLabel="Profil"
            items={[
              { id: 'solo', label: 'Solo' },
              { id: 'famille', label: 'En famille' },
              { id: 'enfants', label: 'Avec enfants' },
              { id: 'senior', label: 'Senior' },
              { id: 'pmr', label: 'Mobilité réduite' },
              { id: 'sportif', label: 'Sportif' },
            ]}
            value={state.profile ?? 'solo'}
            onChange={(id) => state.patch({ profile: id as never })}
          />
          <p style={{ margin: '12px 2px', fontSize: 12.5, color: 'var(--xp-mut)', lineHeight: 1.45 }}>
            Explorer s’ouvre là où tu es. Le globe tourne vers toi puis descend jusqu’à ton quartier. Langue,
            unités et numéros d’urgence suivent le pays affiché.
          </p>
          <XpRows>
            <XpRow
              icon="loc"
              title="Autoriser ma position"
              sub="Pour ouvrir la carte sur ton quartier"
              onClick={() => state.patch({ locationPermission: 'granted', sheet: 'level', detent: 'peek' })}
            />
            <XpRow icon="chevr" title="Plus tard" onClick={() => state.patch({ sheet: 'level', detent: 'peek' })} />
          </XpRows>
        </>
      ),
    },
  ];
}

export function buildSheetModel(ctx: SheetContext): SheetModel {
  const { state } = ctx;
  const kind = state.sheet;

  if (kind === 'level' || kind === 'previewCountry') {
    const region = findRegionAt(ctx.regionsGeo, state.center);
    let title = 'Le monde';
    let subtitle: string | null = 'Le globe s’ouvre sur toi';
    if (state.level === 1 || kind === 'previewCountry') {
      title = ctx.country?.name ?? ctx.countries.find((c) => c.iso === state.geo)?.name ?? state.geo;
      subtitle = [ctx.country?.continent, ctx.country?.capital].filter(Boolean).join(' · ') || null;
    } else if (state.level === 2) {
      title = state.regionId ?? 'Région';
      const units = ctx.regionGroups.find((group) => group.group === state.regionId)?.units;
      subtitle = [ctx.country?.name, units ? `${units} unités` : null].filter(Boolean).join(' · ') || null;
    } else if (state.level === 3) {
      title = region?.name ?? ctx.country?.name ?? 'Lieu';
      const counts = ctx.place?.place?.counts;
      subtitle = [
        region?.group ?? null,
        counts ? `${counts.water} points d’eau · ${counts.refuges} refuges` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null;
    }
    const mini =
      state.level === 2
        ? { items: [{ id: 'ete', label: 'Été', icon: 'sun' }, { id: 'hiver', label: 'Hiver', icon: 'snow' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
        : state.level === 3
          ? { items: [{ id: '2d', label: 'Vue 2D', icon: 'map' }, { id: '3d', label: 'Relief 3D', icon: 'cube' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
          : null;
    return {
      title,
      subtitle,
      tabs: LevelTabs(ctx),
      tabsBottom: state.level === 0,
      mini,
      actions: (
        <button type="button" className="xp-round-ink" onClick={() => state.setSheet('start', 'low')} aria-label="Démarrer une activité">
          <XpIcon name="play" size={15} />
        </button>
      ),
      onBack: state.level > 0 ? state.goUp : undefined,
    };
  }

  if (['summit', 'water', 'refuge', 'bivouac', 'viewpoint', 'danger', 'access', 'friend'].includes(kind)) {
    const poi = ctx.selectedPoi;
    const kindLabel = POI_LABEL[kind] ?? kind;
    return {
      title: poi?.name ?? kindLabel,
      subtitle: poi
        ? [
            kindLabel,
            formatElevation(poi.ele_m),
            formatDistance(distanceKm(state.center, [poi.lon, poi.lat])),
          ]
            .filter(Boolean)
            .join(' · ')
        : 'Aucun repère enregistré à cet endroit',
      tabs: PoiTabs(ctx, kind),
      mini: null,
      actions: (
        <button type="button" className="xp-round-ink" onClick={() => state.setSheet('start', 'low')} aria-label="Démarrer une activité">
          <XpIcon name="play" size={15} />
        </button>
      ),
      onBack: () => state.clearSelection(),
    };
  }

  if (['trail', 'depart', 'search', 'layers', 'offline'].includes(kind)) {
    const titles: Record<string, [string, string]> = {
      trail: ['Itinéraire', 'Trace enregistrée'],
      depart: ['Créer un départ', 'Invite d’autres membres'],
      search: ['Recherche', 'Pays, repères, itinéraires'],
      layers: ['Calques', 'Ce que la carte affiche'],
      offline: ['Hors ligne', 'Zone téléchargeable'],
    };
    const [title, subtitle] = titles[kind];
    const route = ctx.routes.find((item) => String(item.id) === state.selection?.id);
    return {
      title: kind === 'trail' && route?.name ? route.name : title,
      subtitle: kind === 'trail' && route ? `${route.distance_km ?? '—'} km${route.ref ? ` · ${route.ref}` : ''}` : subtitle,
      tabs: ToolsTabs(ctx, kind),
      mini:
        kind === 'trail'
          ? { items: [{ id: 'carte', label: 'Carte', icon: 'map' }, { id: 'survol', label: 'Survol 3D', icon: 'play' }], value: state.mini, onChange: (index: number) => state.setMini(index === 1 ? 1 : 0) }
          : null,
      actions: null,
      onBack: () => state.patch({ sheet: 'level', detent: 'peek' }),
    };
  }

  if (['start', 'live', 'sos', 'summary'].includes(kind)) {
    const titles: Record<string, [string, string]> = {
      start: ['Démarrer', 'Choisis ton activité'],
      live: ['En direct', 'Sortie en cours'],
      sos: ['SOS', 'Alerte en attente'],
      summary: ['Bilan', 'Fin de sortie'],
    };
    const [title, subtitle] = titles[kind];
    const sport = state.activity?.sport;
    return {
      title: kind === 'live' && sport ? SPORT_META[sport].label : title,
      subtitle: kind === 'live' && sport ? 'Suivi en cours' : subtitle,
      tabs: ActivityTabs(ctx, kind),
      mini: null,
      actions: null,
      onBack: () => state.patch({ sheet: 'level', detent: 'peek' }),
    };
  }

  // États : bienvenue, sans position, mode facile, nuit
  const titles: Record<string, [string, string]> = {
    welcome: ['Bienvenue dans Explorer', 'Le monde à ta hauteur, du globe au sentier'],
    noLocation: ['Sans position', 'Explorer sans partager où tu es'],
    easy: ['Mode facile', 'Une seule action à la fois'],
    level0: ['Le monde', 'Le globe s’ouvre sur toi'],
  };
  const [title, subtitle] = titles[kind] ?? ['Explorer', null as unknown as string];
  return { title, subtitle, tabs: StateTabs(ctx), mini: null, actions: null };
}
