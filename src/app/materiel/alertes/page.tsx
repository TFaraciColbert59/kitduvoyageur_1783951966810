import Link from 'next/link';
import { Eyebrow } from '@/components/ui/Eyebrow';
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
import { currentSeason } from '@/features/materiel/components/kits/WeatherMatchScore';

export const dynamic = 'force-dynamic';

export default async function AlertesPage() {
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
    <main className="max-w-[var(--page-max-w)] mx-auto px-4 py-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Eyebrow>Mon Matériel</Eyebrow>
          <h1 className="font-display font-semibold text-[32px] tracking-tight text-[color:var(--label)]">Alertes & fiabilité</h1>
        </div>
        <Link href="/materiel" className="glass interactive h-9 px-4 rounded-full flex items-center text-sm font-medium text-sage-600">
          ← Retour
        </Link>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3"><ReliabilityScore score={score} critical={critical} warning={warning} /></div>
        <div className="col-span-12 md:col-span-9"><CategoryTabs alerts={alerts} /></div>
        <div className="col-span-12"><TopAlertsAccordion alerts={alerts} /></div>
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
        <div className="col-span-12">
          <AlertsTimeline
            entries={alerts.map((a) => ({
              id: a.id,
              date: new Date(a.created_at).toLocaleDateString('fr-FR'),
              message: a.message,
              severity: a.severity,
            }))}
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
        <div className="col-span-12"><MaintenanceCalendar events={calendarEvents} /></div>
        <div className="col-span-12"><OccasionMarketplace products={occasion} /></div>
        <div className="col-span-12"><ExportShareBar /></div>
      </div>
    </main>
  );
}
