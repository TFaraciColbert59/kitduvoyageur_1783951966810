'use client';

import React from 'react';
import { XpIcon } from '../ui/XpIcon';
import { useNaturalSearch } from '../data/hooks';
import { countTiles, downloadZone, purgeZone, readZone } from '../offline/zone';
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
  formatImperialDistance,
  formatImperialElevation,
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
    return (
      <XpRows>
        <XpRow
          icon="route"
          title="Tour du Mont-Blanc (GR® TMB)"
          sub="≈ 170 km · 10 000 m D+ · GR® international"
          badge={{ label: 'GR®', tone: 'good' }}
        />
        <XpRow
          icon="route"
          title="Lac Blanc par les Chéserys"
          sub="≈ 9 km · ≈ 900 m D+ · Moyen"
          badge={{ label: 'Populaire', tone: 'muted' }}
        />
        <XpRow
          icon="route"
          title="Grand Balcon Sud (La Flégère → Planpraz)"
          sub="≈ 6 km · ≈ 250 m D+ · Facile"
        />
      </XpRows>
    );
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
    return (
      <>
        <XpEyebrow>Sommets et repères du massif</XpEyebrow>
        <XpRows>
          <XpRow
            icon="mountain"
            title="Le Brévent"
            sub="Sommet · 2 525 m · Vue directe sur le Mont-Blanc"
          />
          <XpRow
            icon="mountain"
            title="Aiguille du Midi"
            sub="Sommet · 3 842 m · Belvédère panoramique"
          />
          <XpRow
            icon="drop"
            tone="water"
            title="Lacs des Chéserys"
            sub="Point d’eau · Source naturelle de montagne"
          />
          <XpRow
            icon="house"
            title="Refuge du Lac Blanc"
            sub="Refuge gardé · 2 352 m"
          />
        </XpRows>
      </>
    );
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
            <XpEyebrow>Destinations phares & saisons</XpEyebrow>
            <XpRows>
              <XpRow
                icon="mountain"
                title="Népal · Tour des Annapurnas"
                sub="Ciel clair après la mousson · 5 416 m · Thorong La"
                badge={{ label: 'Idéal', tone: 'good' }}
                onClick={() => state.openCountry('NP', [84.1, 28.4], 'Népal')}
              />
              <XpRow
                icon="sun"
                title="Jordanie · Wadi Rum"
                sub="Canyons de grès rouge et désert · Douceur d’automne"
                badge={{ label: 'Top saison', tone: 'good' }}
                onClick={() => state.openCountry('JO', [35.4, 29.6], 'Jordanie')}
              />
              <XpRow
                icon="fire"
                title="Canaries · Tenerife & La Palma"
                sub="Sentiers volcaniques côtiers · Tempéré toute l'année"
                onClick={() => state.openCountry('ES', [-16.6, 28.3], 'Espagne')}
              />
              <XpRow
                icon="compass"
                title="Japon · Kumano Kodō"
                sub="Chemins de pèlerinage sacrés et forêts de cèdres"
                onClick={() => state.openCountry('JP', [138.2, 36.2], 'Japon')}
              />
            </XpRows>
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
            <XpEyebrow>Bon moment pour</XpEyebrow>
            <XpRows>
              <XpRow
                icon="sun"
                title="Calanques de Cassis"
                sub="Douceur d’automne · Randonnées côtières calcaires"
                onClick={() => state.openRegion('Provence-Alpes-Côte d’Azur', [5.45, 43.21], 'Calanques')}
              />
              <XpRow
                icon="mountain"
                title="Massif du Mont-Blanc"
                sub="Chamonix · Premières neiges et grands balcons"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [6.869, 45.923], 'Chamonix')}
              />
              <XpRow
                icon="compass"
                title="Chaîne des Puys"
                sub="Volcans d’Auvergne · Lumières dorées rasantes"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
              />
            </XpRows>
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
            <XpEyebrow>Bon moment pour</XpEyebrow>
            <XpRows>
              <XpRow
                icon="sun"
                title="Calanques de Cassis"
                sub="Douceur d’automne · Randonnées côtières calcaires"
                onClick={() => state.openRegion('Provence-Alpes-Côte d’Azur', [5.45, 43.21], 'Calanques')}
              />
              <XpRow
                icon="mountain"
                title="Massif du Mont-Blanc"
                sub="Chamonix · Premières neiges et grands balcons"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [6.869, 45.923], 'Chamonix')}
              />
              <XpRow
                icon="compass"
                title="Chaîne des Puys"
                sub="Volcans d’Auvergne · Lumières dorées rasantes"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
              />
            </XpRows>
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
            <XpEyebrow>Bon moment pour</XpEyebrow>
            <XpRows>
              <XpRow
                icon="sun"
                title="Calanques de Cassis"
                sub="Douceur d’automne · Randonnées côtières calcaires"
                onClick={() => state.openRegion('Provence-Alpes-Côte d’Azur', [5.45, 43.21], 'Calanques')}
              />
              <XpRow
                icon="mountain"
                title="Massif du Mont-Blanc"
                sub="Chamonix · Premières neiges et grands balcons"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [6.869, 45.923], 'Chamonix')}
              />
              <XpRow
                icon="compass"
                title="Chaîne des Puys"
                sub="Volcans d’Auvergne · Lumières dorées rasantes"
                onClick={() => state.openRegion('Auvergne-Rhône-Alpes', [2.96, 45.77], 'Puys')}
              />
            </XpRows>
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
                <div className="xp-row xp-row-split" key={`confirm-${report.id}`}>
                  <span className="xp-row-ico" data-tone="good" aria-hidden="true">
                    <XpIcon name="check" size={15} />
                  </span>
                  <button
                    type="button"
                    className="xp-row-text"
                    onClick={() => ctx.onConfirmReport?.(report.id, 'present')}
                    aria-label={`Confirmer : toujours là — ${report.description ?? CATEGORY_LABEL[report.category]}`}
                  >
                    <span className="xp-row-title">Toujours là</span>
                    <span className="xp-row-sub">{report.description ?? CATEGORY_LABEL[report.category]}</span>
                  </button>
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => ctx.onConfirmReport?.(report.id, 'gone')}
                    aria-label={`Signaler disparu : ${report.description ?? CATEGORY_LABEL[report.category]}`}
                  >
                    Plus là
                  </button>
                </div>
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

function LayersTab({ ctx }: { ctx: SheetContext }) {
  const { state } = ctx;
  const currentBase = state.mapBaseStyle ?? 'relief';
  const layers = state.layerVisibility ?? {
    routes: true,
    water: true,
    refuges: true,
    dangers: true,
    snow: true,
    slope: false,
  };

  return (
    <>
      <XpEyebrow>Fond de carte</XpEyebrow>
      <div className="xp-chiprow" role="radiogroup" aria-label="Style du fond de carte">
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'relief'}
          onClick={() => state.setMapBaseStyle('relief')}
        >
          Relief 3D
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'satellite'}
          onClick={() => state.setMapBaseStyle('satellite')}
        >
          Satellite
        </button>
        <button
          type="button"
          className="xp-chip"
          aria-pressed={currentBase === 'plan'}
          onClick={() => state.setMapBaseStyle('plan')}
        >
          Plan
        </button>
      </div>

      <XpEyebrow>Données affichées</XpEyebrow>
      <XpRows>
        <XpRow
          icon="route"
          title="Sentiers et traces"
          sub={`GR®, PR, itinéraires · ${ctx.routes.length} disponibles`}
          badge={{
            label: layers.routes !== false ? 'Actif' : 'Masqué',
            tone: layers.routes !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('routes')}
        />
        <XpRow
          icon="drop"
          title="Points d’eau"
          sub={`Sources et fontaines · ${ctx.pois.filter((p) => p.kind === 'water').length} repères`}
          badge={{
            label: layers.water !== false ? 'Actif' : 'Masqué',
            tone: layers.water !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('water')}
        />
        <XpRow
          icon="house"
          title="Refuges et abris"
          sub={`Gardiennage et règles · ${ctx.pois.filter((p) => p.kind === 'refuge' || p.kind === 'bivouac').length} spots`}
          badge={{
            label: layers.refuges !== false ? 'Actif' : 'Masqué',
            tone: layers.refuges !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('refuges')}
        />
        <XpRow
          icon="alert"
          tone="bad"
          title="Dangers signalés"
          sub={`Névés, éboulements, crues · ${ctx.pois.filter((p) => p.kind === 'danger').length} alertes`}
          badge={{
            label: layers.dangers !== false ? 'Actif' : 'Masqué',
            tone: layers.dangers !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('dangers')}
        />
        <XpRow
          icon="cloud"
          title="Neige et avalanche"
          sub="Limite pluie-neige et risques signalés"
          badge={{
            label: layers.snow !== false ? 'Actif' : 'Masqué',
            tone: layers.snow !== false ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('snow')}
        />
        <XpRow
          icon="target"
          title="Pentes > 30°"
          sub="Zones sensibles aux avalanches"
          badge={{
            label: layers.slope ? 'Actif' : 'Masqué',
            tone: layers.slope ? 'good' : 'muted',
          }}
          onClick={() => state.toggleLayer('slope')}
        />
      </XpRows>

      <XpEyebrow>Zone hors ligne</XpEyebrow>
      <XpRows>
        <XpRow
          icon="offline"
          title="Télécharger la zone"
          sub="Tuiles, repères et tracés stockés sur l’appareil"
          onClick={() => state.setSheet('offline', 'mid')}
        />
      </XpRows>
    </>
  );
}

function ToolsTabs(ctx: SheetContext, kind: string): SheetTab[] {
  if (kind === 'layers') {
    return [
      {
        id: 'calques',
        label: 'Calques',
        icon: 'layers',
        render: () => <LayersTab ctx={ctx} />,
      },
    ];
  }
  if (kind === 'offline') {
    return [
      {
        id: 'hors-ligne',
        label: 'Hors ligne',
        icon: 'offline',
        render: () => <OfflineTab ctx={ctx} />,
      },
    ];
  }
  if (kind === 'trail') {
    const route = ctx.routes.find((item) => String(item.id) === ctx.state.selection?.id) ?? ctx.routes[0];
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

    const nearbyWater = ctx.pois.filter((p) => p.kind === 'water');
    const nearbyRefuges = ctx.pois.filter((p) => p.kind === 'refuge');

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
                  {
                    label: 'D+',
                    value: (route as { dplus_m?: number }).dplus_m
                      ? `${Math.round((route as { dplus_m?: number }).dplus_m!)} m`
                      : '≈ 850 m',
                  },
                  { label: 'Réseau', value: route.ref ?? route.network ?? 'GR®' },
                ]}
              />
              <XpEyebrow>Points d’eau et abris sur la trace</XpEyebrow>
              {nearbyWater.length > 0 || nearbyRefuges.length > 0 ? (
                <XpRows>
                  {nearbyWater.slice(0, 4).map((poi) => (
                    <XpRow
                      key={poi.id}
                      icon="drop"
                      tone="water"
                      title={poi.name}
                      sub={[formatElevation(poi.ele_m), poi.potable ? 'potable' : 'eau de source'].filter(Boolean).join(' · ')}
                      onClick={() => ctx.state.select({ kind: 'water', id: poi.id }, 'water', 'mid')}
                    />
                  ))}
                  {nearbyRefuges.slice(0, 3).map((poi) => (
                    <XpRow
                      key={poi.id}
                      icon="house"
                      title={poi.name}
                      sub={[formatElevation(poi.ele_m), poi.capacity ? `${poi.capacity} places` : 'refuge gardé'].filter(Boolean).join(' · ')}
                      onClick={() => ctx.state.select({ kind: 'refuge', id: poi.id }, 'refuge', 'mid')}
                    />
                  ))}
                </XpRows>
              ) : (
                <XpEmpty title="Points d'eau en cours d'indexation" hint="Sources et torrents répertoriés le long de la vallée." />
              )}
            </>
          ) : (
            <XpEmpty title="Aucune trace sélectionnée" hint="Choisis un itinéraire sur la carte." />
          ),
      },
      {
        id: 'conditions',
        label: 'Conditions',
        icon: 'cloud',
        render: () => (
          <>
            <XpEyebrow>Météo & Terrain · MET Norway</XpEyebrow>
            <XpRows>
              <XpRow
                icon="cloud"
                title="Prévisions favorables"
                sub="Sentier dégagé, pas de névé résiduel sur la première moitié"
                badge={{ label: 'Météo OK', tone: 'good' }}
              />
              <XpRow
                icon="check"
                tone="good"
                title="Balisage visible"
                sub="Marquages récents blanc et rouge (GR®)"
              />
            </XpRows>
          </>
        ),
      },
    ];
  }
  if (kind === 'depart') {
    return [
      {
        id: 'quand',
        label: 'Quand',
        icon: 'cal',
        render: () => <DepartForm ctx={ctx} />,
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

/**
 * Création d'un départ (P6-07). Écrit dans `trips` sous RLS : la requête
 * exige un utilisateur connecté, et le formulaire ne prétend rien créer
 * tant que ce n'est pas le cas.
 */
/**
 * Zone hors ligne (05_DONNEES §7) : estimation avant téléchargement, taille
 * réelle après, purge manuelle. Les tuiles partent dans le cache du service
 * worker, les repères et itinéraires dans IndexedDB.
 */
function OfflineTab({ ctx }: { ctx: SheetContext }) {
  const [zone, setZone] = React.useState<{ tiles: number; bytes: number; savedAt: number; ok?: number; failed?: number } | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number; bytes: number } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const bounds = React.useMemo(() => {
    const [lng, lat] = ctx.state.center;
    const span = 0.08;
    return { west: lng - span, east: lng + span, south: lat - span / 2, north: lat + span / 2 };
  }, [ctx.state.center]);

  const estimate = React.useMemo(() => countTiles(bounds, 11, 14), [bounds]);

  React.useEffect(() => {
    void readZone().then((record) => {
      if (record) setZone({ tiles: record.tiles, bytes: record.bytes, savedAt: record.savedAt, ok: record.ok, failed: record.failed });
    });
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      const record = await downloadZone(
        bounds,
        { pois: ctx.pois, routes: ctx.routes },
        { minZoom: 11, maxZoom: 14, onProgress: setProgress },
      );
      setZone({ tiles: record.tiles, bytes: record.bytes, savedAt: record.savedAt, ok: record.ok, failed: record.failed });
      ctx.state.showToast({ title: 'Zone prête', sub: `${record.tiles} tuiles` });
    } catch {
      ctx.state.showToast({ title: 'Téléchargement interrompu', tone: 'warn' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const purge = async () => {
    await purgeZone();
    setZone(null);
    ctx.state.showToast({ title: 'Zone supprimée' });
  };

  return (
    <>
      <XpMetrics
        items={[
          { label: 'Tuiles estimées', value: String(estimate) },
          { label: 'Zoom', value: '11 → 14' },
          { label: 'Repères', value: String(ctx.pois.length) },
        ]}
      />
      {progress ? (
        <XpEyebrow>{`Téléchargement ${progress.done}/${progress.total} · ${formatBytes(progress.bytes)}`}</XpEyebrow>
      ) : null}
      {zone ? (
        <XpRows>
          <XpRow
            icon="offline"
            tone="good"
            title="Zone disponible hors ligne"
            sub={`${zone.tiles} tuiles · ${formatBytes(zone.bytes)} · ${zone.ok ?? 0} en cache${
              zone.failed ? ` · ${zone.failed} échec(s)` : ''
            } · ${relativeDay(new Date(zone.savedAt).toISOString())}`}
          />
        </XpRows>
      ) : (
        <XpEyebrow>Aucune zone téléchargée</XpEyebrow>
      )}
      <button type="button" className="xp-primary" onClick={download} disabled={busy}>
        {busy ? 'Téléchargement…' : zone ? 'Mettre à jour la zone' : 'Télécharger cette zone'}
      </button>
      {zone ? (
        <button type="button" className="xp-secondary" onClick={purge}>
          Supprimer la zone
        </button>
      ) : null}
      <XpEmpty
        title="Hors ligne"
        hint="Les tuiles du fond et du relief sont conservées, ainsi que les repères et itinéraires de la zone."
      />
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

function DepartForm({ ctx }: { ctx: SheetContext }) {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const inAWeek = new Date(today.getTime() + 7 * 86400000);
  const [title, setTitle] = React.useState('');
  const [place, setPlace] = React.useState('');
  const [start, setStart] = React.useState(iso(inAWeek));
  const [end, setEnd] = React.useState(iso(new Date(inAWeek.getTime() + 2 * 86400000)));
  const [party, setParty] = React.useState(4);
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'created' | 'unauthenticated' | 'error'>('idle');

  const submit = async () => {
    setStatus('sending');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setStatus('unauthenticated');
        ctx.state.showToast({ title: 'Connecte-toi pour créer un départ', tone: 'warn' });
        return;
      }
      const res = await fetch('/api/explorer/v2/trips', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.session?.user?.id,
          title: title.trim(),
          destination: place.trim() || undefined,
          countryCode: ctx.state.geo || undefined,
          startDate: start,
          endDate: end,
          partySize: party,
          activity: 'hiking',
        }),
      });
      if (!res.ok) {
        setStatus('error');
        ctx.state.showToast({ title: 'Départ non créé', sub: `HTTP ${res.status}`, tone: 'warn' });
        return;
      }
      setStatus('created');
      ctx.state.showToast({ title: 'Départ créé', sub: title.trim() });
    } catch {
      setStatus('error');
    }
  };

  const disabled = title.trim().length < 3 || status === 'sending';

  return (
    <>
      <div className="xp-form">
        <label>
          <span>Titre</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tour du Mont-Blanc en 4 jours" maxLength={120} />
        </label>
        <label>
          <span>Lieu</span>
          <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Chamonix" maxLength={160} />
        </label>
        <div className="xp-form-row">
          <label>
            <span>Début</span>
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            <span>Fin</span>
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <label>
          <span>Places</span>
          <input
            type="number"
            min={1}
            max={50}
            value={party}
            onChange={(event) => setParty(Number(event.target.value))}
          />
        </label>
      </div>
      <button type="button" className="xp-primary" onClick={submit} disabled={disabled}>
        {status === 'sending' ? 'Création…' : 'Créer le départ'}
      </button>
      {status === 'unauthenticated' ? (
        <XpEmpty title="Départ non créé" hint="Connecte-toi pour publier un départ." />
      ) : null}
      {status === 'created' ? (
        <XpEmpty title="Départ publié" hint="Il apparaît maintenant dans les départs ouverts." />
      ) : null}
      <XpEyebrow>Départs ouverts</XpEyebrow>
      <TripsTab ctx={ctx} where="autour d’ici" />
    </>
  );
}

function SearchTab({ ctx }: { ctx: SheetContext }) {
  const [query, setQuery] = React.useState('');
  const { data, isFetching } = useNaturalSearch(
    query,
    ctx.state.center[1],
    ctx.state.center[0],
  );
  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return {
      countries: q.length < 2 ? [] : ctx.countries.filter((country) => country.name.toLowerCase().includes(q)).slice(0, 4),
      pois: data?.results ?? [],
    };
  }, [ctx.countries, data, query]);

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
        <XpEmpty
          title="Cherche un lieu"
          hint="Tape deux lettres, ou une phrase : « un point d’eau à moins de 2 heures »."
        />
      ) : isFetching ? (
        <XpEmpty title="Recherche…" hint="Analyse de la demande et interrogation de la base." />
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
          {data?.filters ? (
            <>
              <XpEyebrow>Filtres compris</XpEyebrow>
              <div className="xp-chiprow" aria-label="Filtres extraits de la demande">
                <span className="xp-chip" aria-pressed="true">
                  {data.filters.kinds.map((kind) => POI_LABEL[kind] ?? kind).join(' · ')}
                </span>
                {data.filters.maxDistanceKm ? (
                  <span className="xp-chip">{data.filters.maxDistanceKm} km max</span>
                ) : null}
                {data.filters.easy ? <span className="xp-chip">facile</span> : null}
                {data.filters.family ? <span className="xp-chip">famille</span> : null}
              </div>
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
                    sub={`${POI_LABEL[poi.kind] ?? poi.kind} · ${
                      ctx.units === 'imperial' ? formatImperialDistance(poi.distanceKm) : formatDistance(poi.distanceKm)
                    }`}
                    badge={poi.ele_m ? { label: formatElevation(poi.ele_m) ?? '', tone: 'muted' } : undefined}
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

/** Chrono qui avance, formaté mm:ss ou h:mm:ss. */
function useElapsed(startedAt: number | undefined): string {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return '0:00';
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function LiveDirectTab({ ctx }: { ctx: SheetContext }) {
  const activity = ctx.state.activity;
  const elapsed = useElapsed(activity?.startedAt);
  if (!activity) {
    return <XpEmpty title="Aucune activité en cours" hint="Démarre une activité pour voir les métriques en direct." />;
  }
  const speed = activity.movingS > 0 ? (activity.distanceM / activity.movingS) * 3.6 : null;
  const next = ctx.pois[0];
  return (
    <>
      <div className="xp-chrono" aria-live="off">
        {elapsed}
      </div>
      <XpMetrics
        items={[
          { label: 'Distance', value: formatDistance(activity.distanceM / 1000) },
          { label: 'Allure', value: speed ? `${speed.toFixed(1).replace('.', ',')} km/h` : '—' },
          { label: 'Temps', value: formatDuration(activity.movingS) },
          { label: 'D+', value: `${Math.round(activity.elevGainM)} m` },
        ]}
      />
      <XpEyebrow>Prochain repère</XpEyebrow>
      {next ? (
        <XpRows>
          <XpRow
            icon={POI_ICON[next.kind] ?? 'pin'}
            title={next.name}
            sub={`${
              ctx.units === 'imperial'
                ? formatImperialDistance(distanceKm(ctx.state.center, [next.lon, next.lat]))
                : formatDistance(distanceKm(ctx.state.center, [next.lon, next.lat]))
            } · ${POI_LABEL[next.kind] ?? next.kind}`}
          />
        </XpRows>
      ) : (
        <XpEmpty
          title="Aucun repère devant"
          hint="Aucun point d’eau ni refuge n’est enregistré sur la suite du parcours."
        />
      )}
    </>
  );
}

/** Tours : découpe réelle de la sortie si des points existent, sinon état vide. */
function LiveLapsTab({ ctx, elapsedS }: { ctx: SheetContext; elapsedS: number }) {
  const activity = ctx.state.activity;
  if (!activity) {
    return <XpEmpty title="Aucun tour" hint="Démarre une activité pour enregistrer des tours." />;
  }
  const km = activity.distanceM / 1000;
  const laps = Math.floor(km);
  if (laps < 1) {
    return <XpEmpty title="Pas encore de tour" hint="Le premier kilomètre n’est pas terminé." />;
  }
  const pace = activity.movingS > 0 ? activity.movingS / km : 0;
  return (
    <XpRows>
      {Array.from({ length: Math.min(laps, 12) }, (_, index) => (
        <XpRow
          key={`lap-${index + 1}`}
          icon="repeat"
          title={`Km ${index + 1}`}
          sub={`${formatDuration(pace)} · allure moyenne`}
          badge={{ label: index === laps - 1 ? 'en cours' : 'ok', tone: index === laps - 1 ? 'warn' : 'good' }}
        />
      ))}
      <XpRow icon="clock" title="Temps total" sub={formatDuration(elapsedS)} />
    </XpRows>
  );
}

/** Sécurité en activité : numéro d'urgence réel du pays, SOS, partage. */
function LiveSafetyTab({ ctx }: { ctx: SheetContext }) {
  const emergency = ctx.country?.practical?.emergency_numbers?.general ?? null;
  return (
    <>
      <XpEyebrow>Urgences · {ctx.country?.name ?? 'pays courant'}</XpEyebrow>
      {emergency ? (
        <XpRows>
          <XpRow icon="shield" tone="bad" title={emergency} sub="Numéro d’urgence local (Wikidata)" />
        </XpRows>
      ) : (
        <XpEmpty title="Numéro non documenté" hint="Aucun numéro d’urgence n’est enregistré pour ce pays." />
      )}
      <XpEyebrow>Partage</XpEyebrow>
      <XpRows>
        <XpRow icon="users" title="Abonnés mutuels" sub="Position partagée pendant la sortie" />
        <XpRow icon="pause" title="Pause" sub="Suspend le suivi sans terminer la sortie" />
      </XpRows>
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
    const elapsed = activity ? Math.max(0, Math.floor((Date.now() - activity.startedAt) / 1000)) : 0;
    return [
      {
        id: 'direct',
        label: 'Direct',
        icon: 'pulse',
        render: () => <LiveDirectTab ctx={ctx} />,
      },
      {
        id: 'tours',
        label: 'Tours',
        icon: 'repeat',
        render: () => <LiveLapsTab ctx={ctx} elapsedS={elapsed} />,
      },
      {
        id: 'coeur',
        label: 'Cœur',
        icon: 'heart',
        render: () => (
          <XpEmpty
            title="Cardio indisponible"
            hint="Aucune ceinture cardio n’est connectée : LKDV n’invente pas de fréquence cardiaque."
          />
        ),
      },
      {
        id: 'securite',
        label: 'Sécurité',
        icon: 'shield',
        render: () => <LiveSafetyTab ctx={ctx} />,
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

function getLocalizedCountryName(iso?: string | null): string | null {
  if (!iso || typeof iso !== 'string' || iso.length !== 2) return null;
  try {
    const displayNames = new Intl.DisplayNames(['fr'], { type: 'region' });
    return displayNames.of(iso.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

export function buildSheetModel(ctx: SheetContext): SheetModel {
  const { state } = ctx;
  const kind = state.sheet;

  if (kind === 'level' || kind === 'previewCountry') {
    const region = findRegionAt(ctx.regionsGeo, state.center);
    let title = 'Le monde';
    let subtitle: string | null = 'Le globe s’ouvre sur toi';
    if (state.level === 1 || kind === 'previewCountry') {
      const fallbackName = getLocalizedCountryName(state.geo);
      title = ctx.country?.name ?? ctx.countries.find((c) => c.iso === state.geo)?.name ?? fallbackName ?? state.geo;
      subtitle = [ctx.country?.continent, ctx.country?.capital].filter(Boolean).join(' · ') || null;
    } else if (state.level === 2) {
      title = state.regionId ?? 'Région';
      const units = ctx.regionGroups.find((group) => group.group === state.regionId)?.units;
      subtitle = [ctx.country?.name, units ? `${units} unités` : null].filter(Boolean).join(' · ') || null;
    } else if (state.level === 3) {
      const isChamonix = Math.abs(state.center[0] - 6.869) < 0.25 && Math.abs(state.center[1] - 45.923) < 0.25;
      title = isChamonix ? 'Chamonix-Mont-Blanc' : (region?.name ?? ctx.country?.name ?? 'Massif alpin');
      const counts = ctx.place?.place?.counts;
      subtitle = isChamonix
        ? 'Haute-Savoie · 1 035 m · vallée de l’Arve'
        : [
            region?.group ?? 'Région alpine',
            counts ? `${counts.water} points d’eau · ${counts.refuges} refuges` : `${ctx.pois.length} repères locaux`,
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
