import { XpEmpty, XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function terrainDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const st = ws.selectedStage;
  return {
    title: 'Météo, Eau & Terrain',
    subtitle: st ? `Jour ${st.dayNumber} · ${st.title}` : 'Informations terrain',
  };
}

export function TerrainDrawer() {
  const { selectedStage } = useRouteWorkspace();
  const st = selectedStage;
  return (
    <div className="rcw-stack" data-testid="subdrawer-terrain">
      <Banners />
      <XpEyebrow>Météo datée par lieu et créneau</XpEyebrow>
      {st?.weatherSlice ? (
        <XpRows>
          <XpRow
            icon="cloud"
            tone={st.weatherSlice.status === 'stale' ? 'warn' : 'water'}
            title={`${st.weatherSlice.locationLabel} · ${st.weatherSlice.forecastFor}`}
            sub={`${st.weatherSlice.provider ?? 'Fournisseur inconnu'}${st.weatherSlice.fetchedAt ? ` · relevé ${st.weatherSlice.fetchedAt.slice(0, 10)}` : ''}${st.weatherSlice.windKph != null ? ` · vent ${st.weatherSlice.windKph} km/h` : ''}`}
            badge={{
              label:
                st.weatherSlice.temperatureC != null
                  ? `${st.weatherSlice.temperatureC}°C`
                  : st.weatherSlice.status,
              tone: st.weatherSlice.status === 'fresh' ? 'good' : 'warn',
            }}
          />
        </XpRows>
      ) : (
        <XpEmpty
          title="Météo non chargée"
          hint="Aucune donnée météo disponible pour cette étape — valeur affichée comme inconnue."
        />
      )}

      <XpEyebrow>Points d’eau & potabilité</XpEyebrow>
      {st && st.waterObservations.length > 0 ? (
        <XpRows>
          {st.waterObservations.map((w) => (
            <XpRow
              key={w.id}
              icon="drop"
              tone={w.status === 'dry' ? 'bad' : w.status === 'unknown' ? 'warn' : 'water'}
              title={w.name}
              sub={`Potabilité : ${w.potableClaim === 'yes' ? 'Potable' : w.potableClaim === 'no' ? 'Non potable' : 'Non garantie'}${w.observedAt ? ` · observé le ${w.observedAt.slice(0, 10)}` : ' · date inconnue'}`}
              badge={{
                label: w.status === 'flowing' ? 'Coule' : w.status === 'dry' ? 'À sec' : 'Inconnu',
                tone: w.status === 'flowing' ? 'good' : w.status === 'dry' ? 'bad' : 'warn',
              }}
            />
          ))}
        </XpRows>
      ) : (
        <p className="rcw-sub-note">Eau : inconnue sur cette étape (prévoir autonomie complète).</p>
      )}

      <XpEyebrow>Accès, refuges & dangers terrain</XpEyebrow>
      {st && st.hazards.length > 0 ? (
        <XpRows>
          {st.hazards.map((h) => (
            <XpRow
              key={h.id}
              icon="alert"
              tone="warn"
              title={h.title}
              sub={`${h.source} · observé le ${h.observedAt.slice(0, 10)}${h.expiresAt ? ` · expire le ${h.expiresAt.slice(0, 10)}` : ''}`}
              badge={{ label: h.severitySource, tone: 'warn' }}
            />
          ))}
        </XpRows>
      ) : (
        <p className="rcw-sub-note">
          Aucun danger terrain daté. Vérifiez l’ouverture des refuges et arrêtés locaux avant
          départ.
        </p>
      )}
    </div>
  );
}
