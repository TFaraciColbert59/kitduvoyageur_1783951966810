import { WeatherSnapshot, POI, HikingStatistics } from '../types';


export interface HikeContextSummary {
  distanceKm: number;
  remainingDistanceKm?: number | null;
  durationSeconds: number;
  elevationGainM?: number | null;
  paceMinPerKm: number;
  progressPercent?: number | null;
  currentAltitudeM?: number | null;
  weather?: WeatherSnapshot | null;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  userStats?: HikingStatistics | null;
}

export class CopilotEngine {
  /**
   * Generates a context-aware answer for a hiker's question.
   */
  public static generateAnswer(question: string, context: HikeContextSummary): string {
    const qLower = question.toLowerCase();

    if (qLower.includes('reste') || qLower.includes('combien')) {
      if (context.remainingDistanceKm != null && context.remainingDistanceKm > 0) {
        const remainingPaceMin = context.paceMinPerKm > 0 ? Math.round(context.remainingDistanceKm * context.paceMinPerKm) : 0;
        return `Il vous reste environ ${context.remainingDistanceKm.toFixed(1)} km (${remainingPaceMin > 0 ? `~${remainingPaceMin} min` : 'durée estimée indisponible'}).`;
      }
      return `Vous avez parcouru ${context.distanceKm.toFixed(1)} km en ${Math.floor(context.durationSeconds / 60)} minutes.`;
    }

    if (qLower.includes('eau') || qLower.includes('point d\'eau') || qLower.includes('source')) {
      if (context.nextPoi && (context.nextPoi.category === 'water' || context.nextPoi.category === 'source')) {
        return `Le prochain point d'eau (${context.nextPoi.name}) est situé à environ ${Math.round(context.nextPoi.distanceRemainingM)} m sur votre parcours.`;
      }
      return `Prochain point d'eau : consultez la carte ou le tracé officiel à proximité. Gardez votre gourde remplie !`;
    }

    if (qLower.includes('temps') || qLower.includes('retard') || qLower.includes('estimation')) {
      if (context.paceMinPerKm > 0) {
        const expectedPace = 15; // standard 15 min/km for hiking
        const diffPace = context.paceMinPerKm - expectedPace;
        if (diffPace > 5) {
          return `Votre allure actuelle est de ${context.paceMinPerKm.toFixed(1)} min/km. Vous êtes légèrement en dessous de l'allure estimée, prévoyez un peu plus de temps.`;
        }
        return `Excellente allure ! Vous êtes à ${context.paceMinPerKm.toFixed(1)} min/km, parfaitement dans vos temps.`;
      }
      return `Rythme de marche régulier. Pensez à maintenir une cadence constante.`;
    }

    if (qLower.includes('pause') || qLower.includes('reposer')) {
      if (context.nextPoi && (context.nextPoi.category === 'shelter' || context.nextPoi.category === 'refuge' || context.nextPoi.category === 'viewpoint')) {
        return `Emplacement conseillé : ${context.nextPoi.name} à ${Math.round(context.nextPoi.distanceRemainingM)} m, idéal pour une halte.`;
      }
      return `Trouvez une zone ombragée et abritée du vent hors du sentier pour une pause de 10 à 15 minutes.`;
    }

    if (qLower.includes('montée') || qLower.includes('dénivelé') || qLower.includes('grimpe')) {
      if (context.elevationGainM != null) {
        return `Dénivelé positif cumulé : +${Math.round(context.elevationGainM)} m. Continuez à votre rythme sur les portions raides.`;
      }
      return `Gestion de l'effort : raccourcissez vos pas en montée pour préserver vos jambes.`;
    }

    return `Copilote Terrain : ${context.distanceKm.toFixed(1)} km effectués. Météo ${context.weather?.condition || 'stable'}. Tout va bien !`;
  }

  /**
   * Generates discrete proactive advice if significant conditions trigger it.
   */
  public static getProactiveSuggestion(context: HikeContextSummary): string | null {
    if (context.weather?.isAlert && context.weather.alertMessage) {
      return `🌧️ ${context.weather.alertMessage}`;
    }

    if (context.paceMinPerKm > 25 && context.durationSeconds > 1800) {
      return `⚠️ Votre allure a baissé (${context.paceMinPerKm.toFixed(0)} min/km). Pensez à vous hydrater et faire une courte pause.`;
    }

    if (context.nextPoi && context.nextPoi.distanceRemainingM < 300) {
      return `📍 ${context.nextPoi.name} à ${Math.round(context.nextPoi.distanceRemainingM)} m.`;
    }

    return null;
  }
}
