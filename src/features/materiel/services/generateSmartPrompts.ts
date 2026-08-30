import type { SmartPromptAlert, ChecklistItem, Participant } from '../types/trekHub';
import type { WeatherForecast } from './getWeather';

export interface SmartPromptsInput {
  items: ChecklistItem[];
  weather?: WeatherForecast | null;
  participants: Participant[];
  emergencyContact?: string | null;
  trailDistanceKm?: number | null;
}

export interface ActionableAlert extends SmartPromptAlert {
  targetItemId?: string;
  actionType?: 'check_item' | 'scroll_checklist' | 'scroll_weather' | 'edit_emergency' | 'mark_planned';
}

/**
 * Moteur d'analyse en temps réel pour générer les alertes tactiques (§4B).
 * Zéro alerte décorative : si 0 problème, retourne un tableau vide.
 */
export function generateSmartPrompts({
  items = [],
  weather,
  participants = [],
  emergencyContact,
  trailDistanceKm,
}: SmartPromptsInput): ActionableAlert[] {
  const alerts: ActionableAlert[] = [];

  // 1. Analyse Météo Temps Réel
  if (weather && weather.days && weather.days.length > 0) {
    const rainyDay = weather.days.find((d) => d.precipPct >= 40 || (d.weathercode >= 51 && d.weathercode <= 82));
    const stormyDay = weather.days.find((d) => d.weathercode >= 95);
    const coldDay = weather.days.find((d) => d.tempMinC <= 4);

    if (stormyDay) {
      alerts.push({
        id: 'alert-weather-storm',
        category: 'weather',
        severity: 'critical',
        title: `Risque d'Orage (${stormyDay.day})`,
        message: `Conditions instables prévues (${stormyDay.day}). Évitez les crêtes exposées et vérifiez l'abri.`,
        targetSection: 'weather',
        actionLabel: 'Voir la météo',
        actionType: 'scroll_weather',
      });
    } else if (rainyDay) {
      const rainGear = items.find((i) =>
        /pluie|gore-?tex|impermeable|poncho|veste|housse/i.test(i.name)
      );
      const isReady = rainGear ? rainGear.is_checked : false;

      if (!isReady) {
        alerts.push({
          id: 'alert-weather-rain',
          category: 'weather',
          severity: 'warning',
          title: `Pluie prévue (${rainyDay.day} : ${rainyDay.precipPct}%)`,
          message: `Averses attendues (${rainyDay.day}). Emportez votre veste imperméable.`,
          targetSection: 'checklist',
          targetItemId: rainGear?.id,
          actionLabel: rainGear ? `Cocher ${rainGear.name}` : 'Voir les vestes',
          actionType: rainGear ? 'check_item' : 'scroll_checklist',
        });
      }
    }

    if (coldDay) {
      alerts.push({
        id: 'alert-weather-cold',
        category: 'weather',
        severity: 'warning',
        title: `Températures fraîches (${coldDay.day} : ${coldDay.tempMinC}°C)`,
        message: `Minima de ${coldDay.tempMinC}°C au lever du jour. Un duvet chaud est fortement conseillé.`,
        targetSection: 'checklist',
        actionLabel: 'Vérifier le couchage',
        actionType: 'scroll_checklist',
      });
    }
  }

  // 2. Analyse du Matériel Vital non coché
  const uncheckedVital = items.filter(
    (i) =>
      !i.is_checked &&
      (i.is_vital || /tente|abri|duvet|couchage|secours|pharmacie|frontale|lampe|filtre|gourde|boussole|sifflet/i.test(i.name))
  );

  if (uncheckedVital.length > 0) {
    const firstVital = uncheckedVital[0];
    const names = uncheckedVital.slice(0, 2).map((i) => i.name).join(', ');
    const more = uncheckedVital.length > 2 ? ` (+${uncheckedVital.length - 2})` : '';

    alerts.push({
      id: 'alert-vital-gear',
      category: 'checklist',
      severity: 'critical',
      title: `${uncheckedVital.length} équipement(s) vital(aux) manquant(s)`,
      message: `${names}${more} pas encore prêt(s) dans votre sac.`,
      targetSection: 'checklist',
      targetItemId: firstVital.id,
      actionLabel: `Voir les ${uncheckedVital.length} items`,
      actionType: 'scroll_checklist',
    });
  }

  // 3. Analyse du Contact d'Urgence ICE
  if (!emergencyContact || emergencyContact.trim() === '' || emergencyContact.includes('00 00')) {
    alerts.push({
      id: 'alert-emergency-contact',
      category: 'medical',
      severity: 'warning',
      title: 'Contact d’urgence non renseigné',
      message: 'Indiquez un numéro joignable en cas d’incident ou de déclenchement du SOS.',
      targetSection: 'participants',
      actionLabel: 'Renseigner contact ICE',
      actionType: 'edit_emergency',
    });
  }

  // 4. Hydratation & Ravitaillement Eau
  if (trailDistanceKm && trailDistanceKm > 20) {
    alerts.push({
      id: 'alert-water-trail',
      category: 'water',
      severity: 'info',
      title: `Ravitaillement Eau (${trailDistanceKm.toFixed(0)} km)`,
      message: 'Parcours long : prévoyez 2.5L à 3L minimum et localisez les points d’eau.',
      targetSection: 'consumables',
      actionLabel: 'Marquer comme prévu',
      actionType: 'mark_planned',
    });
  }

  // Tri strict : critical en premier, puis warning, puis info
  const severityWeight = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);

  return alerts;
}
