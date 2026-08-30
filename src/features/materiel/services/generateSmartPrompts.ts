import type { SmartPromptAlert, ChecklistItem, Participant } from '../types/trekHub';
import type { WeatherForecast } from './getWeather';

export interface SmartPromptsInput {
  items: ChecklistItem[];
  weather?: WeatherForecast | null;
  participants: Participant[];
  emergencyContact?: string | null;
  trailDistanceKm?: number | null;
}

/**
 * Moteur d'analyse en temps réel pour générer des alertes intelligentes et contextuelles.
 * Détecte les risques météo, le matériel de sécurité manquant et les lacunes d'équipe.
 */
export function generateSmartPrompts({
  items = [],
  weather,
  participants = [],
  emergencyContact,
  trailDistanceKm,
}: SmartPromptsInput): SmartPromptAlert[] {
  const alerts: SmartPromptAlert[] = [];

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
        message: `Conditions instables prévues sur l'itinéraire (${stormyDay.day}). Évitez les crêtes exposées et vérifiez l'abri.`,
        targetSection: 'weather',
        actionLabel: 'Voir Météo',
      });
    } else if (rainyDay) {
      // Vérifie si une protection pluie est dans le kit et cochée
      const rainGear = items.find((i) =>
        /pluie|gore-?tex|impermeable|poncho|veste|housse/i.test(i.name)
      );
      const isReady = rainGear ? rainGear.is_checked : false;

      alerts.push({
        id: 'alert-weather-rain',
        category: 'weather',
        severity: isReady ? 'info' : 'warning',
        title: `Pluie prévue (${rainyDay.day} : ${rainyDay.precipPct}%)`,
        message: isReady
          ? `Protection pluie prête (${rainGear?.name}). Restez vigilant aux changements de température.`
          : `Averses attendues (${rainyDay.day}). Pensez à emporter et cocher votre veste imperméable.`,
        targetSection: 'checklist',
        actionLabel: isReady ? 'Vérifié' : 'Checklist',
      });
    }

    if (coldDay) {
      alerts.push({
        id: 'alert-weather-cold',
        category: 'weather',
        severity: 'warning',
        title: `Températures fraîches (${coldDay.day} : ${coldDay.tempMinC}°C)`,
        message: `Minima de ${coldDay.tempMinC}°C au lever du jour. Un duvet et une sous-couche thermique sont fortement conseillés.`,
        targetSection: 'checklist',
        actionLabel: 'Compléter',
      });
    }
  }

  // 2. Analyse du Matériel Vital (Checklist & Sécurité)
  const uncheckedVital = items.filter(
    (i) =>
      !i.is_checked &&
      /secours|pharmacie|frontale|lampe|filtre|gourde|tente|boussole|dva|crampons/i.test(i.name)
  );

  if (uncheckedVital.length > 0) {
    const names = uncheckedVital.slice(0, 2).map((i) => i.name).join(', ');
    const more = uncheckedVital.length > 2 ? ` (+${uncheckedVital.length - 2})` : '';
    alerts.push({
      id: 'alert-vital-gear',
      category: 'checklist',
      severity: 'warning',
      title: 'Matériel vital à finaliser',
      message: `${names}${more} pas encore prêt(s) dans votre sac.`,
      targetSection: 'checklist',
      actionLabel: 'Cocher',
    });
  }

  // 3. Analyse des Participants & Urgence
  const missingContact = participants.filter((p) => !p.profileId && p.name !== 'Vous');
  if (!emergencyContact || emergencyContact.trim() === '' || emergencyContact.includes('00 00')) {
    alerts.push({
      id: 'alert-emergency-contact',
      category: 'medical',
      severity: 'critical',
      title: 'Contact d’urgence non renseigné',
      message: 'Indiquez un numéro joignable en cas d’incident ou de déclenchement du SOS.',
      targetSection: 'participants',
      actionLabel: 'Renseigner',
    });
  } else if (missingContact.length > 0) {
    alerts.push({
      id: 'alert-participants-sync',
      category: 'medical',
      severity: 'info',
      title: 'Équipe de départ',
      message: `${participants.length} participant(s) enregistrés pour cette sortie.`,
      targetSection: 'participants',
      actionLabel: 'Équipe',
    });
  }

  // 4. Hydratation & Ravitaillement Eau
  if (trailDistanceKm && trailDistanceKm > 20) {
    alerts.push({
      id: 'alert-water-trail',
      category: 'water',
      severity: 'info',
      title: `Ravitaillement Eau (${trailDistanceKm.toFixed(0)} km)`,
      message: 'Parcours long : prévoyez 2.5L à 3L minimum et localisez les sources avant le départ.',
      targetSection: 'consumables',
      actionLabel: 'Consommables',
    });
  }

  // Fallback si aucune alerte n'a été déclenchée : message rassurant de validation
  if (alerts.length === 0) {
    alerts.push({
      id: 'alert-all-green',
      category: 'equipment',
      severity: 'info',
      title: 'Tous les voyants sont au vert',
      message: 'Votre kit et vos paramètres de départ sont prêts pour l’aventure.',
      targetSection: 'kit',
      actionLabel: 'Paré',
    });
  }

  return alerts;
}
