import { ReliabilityScore } from '@/features/materiel/components/alertes/ReliabilityScore';
import { TopAlertsAccordion } from '@/features/materiel/components/alertes/TopAlertsAccordion';
import { CategoryTabs } from '@/features/materiel/components/alertes/CategoryTabs';
import { SeasonalBanner } from '@/features/materiel/components/alertes/SeasonalBanner';
import { AlertsTimeline } from '@/features/materiel/components/alertes/AlertsTimeline';
import { ToCompleteList } from '@/features/materiel/components/alertes/ToCompleteList';
import { WeatherRadar } from '@/features/materiel/components/alertes/WeatherRadar';
import { MaintenanceCalendar } from '@/features/materiel/components/alertes/MaintenanceCalendar';
import { OccasionMarketplace } from '@/features/materiel/components/alertes/OccasionMarketplace';
import { ExportShareBar } from '@/features/materiel/components/alertes/ExportShareBar';
import { getAlerts } from '@/features/materiel/services/getAlerts';
import { getInventory } from '@/features/materiel/services/getInventory';
import { getOccasionProducts } from '@/features/materiel/services/getOccasionProducts';
import { getWeather, weatherLabel } from '@/features/materiel/services/getWeather';
import { currentSeason } from '@/lib/materiel/season';

/**
 * H4.2 — Section alertes du hub (composition materiel/alertes/page).
 * D4 : la section unique `alertes` vit ici (/materiel/alertes) — la racine
 * /alertes (32,9 ko) sera redirigée en H5 après audit de fusion.
 */
export async function HubAlertesSection() {
  const [alerts, inventory, occasion, weather] = await Promise.all([
    getAlerts(), getInventory(), getOccasionProducts(), getWeather(),
  ]);
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  const score = Math.max(0, 100 - alerts.length * 10);
  const meteoCount = alerts.filter((a) => a.type === 'meteo').length;
  const season = currentSeason();
  const calendarEvents = inventory
    .filter((i) => i.maintenance_due_at)
    .map((i) => ({ item: i.name, date: i.maintenance_due_at! }));

  return (
    <div className="grid grid-cols-12 gap-[var(--grid-gap)]">
      <div className="col-span-12 md:col-span-3"><ReliabilityScore score={score} critical={critical} warning={warning} /></div>
      <div className="col-span-12 md:col-span-9"><CategoryTabs alerts={alerts} /></div>
      <div className="col-span-12 md:col-span-6"><TopAlertsAccordion alerts={alerts} /></div>
      <div className="col-span-12 md:col-span-6">
        <AlertsTimeline
          entries={alerts.map((a) => ({
            id: a.id,
            date: new Date(a.created_at).toLocaleDateString('fr-FR'),
            message: a.message,
            severity: a.severity,
          }))}
        />
      </div>
      <div className="col-span-12">
        <SeasonalBanner
          chip={`Saison : ${season}`}
          message={
            alerts.length === 0
              ? `Votre équipement est sain pour la saison ${season}.`
              : `${alerts.length} alerte(s) active(s) — pensez à entretenir votre matériel avant la prochaine sortie.`
          }
        />
      </div>
      <div className="col-span-12 md:col-span-6"><ToCompleteList items={inventory} /></div>
      <div className="col-span-12 md:col-span-6">
        <WeatherRadar
          meteoCount={meteoCount}
          message={
            weather
              ? `${weatherLabel(weather.current.weathercode)} · ${weather.current.tempC}°C, précip ${weather.current.precipPct}% (${weather.location.label})`
              : 'Prévisions météo indisponibles.'
          }
        />
      </div>
      <div className="col-span-12 md:col-span-6"><MaintenanceCalendar events={calendarEvents} /></div>
      <div className="col-span-12 md:col-span-6"><OccasionMarketplace products={occasion} /></div>
      <div className="col-span-12"><ExportShareBar /></div>
    </div>
  );
}

export default HubAlertesSection;
