/**
 * LE KIT DU VOYAGEUR — HIKER PROFILE & PACE PREDICTION ENGINE
 * 
 * Calcule le profil athlétique réel du randonneur à partir de ses sessions enregistrées :
 * - Vitesse à plat (km/h) et allure (min/km)
 * - Vitesse ascensionnelle moyenne réelle : VAM en d+/h (mètres de dénivelé positif par heure)
 * - Vitesse de descente moyenne : VDM en d-/h (mètres de dénivelé négatif par heure)
 * - Règle de Naismith & Tobler personnalisée pour estimer le temps d'un futur sentier
 */

import { HikeSession, GPSPosition } from '../types';

export interface HikerAthleticProfile {
  userId: string;
  totalSessionsAnalyzed: number;
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalDurationSeconds: number;
  
  // Vitesse à plat pure (km/h)
  flatSpeedKmH: number;
  
  // VAM : Vitesse Ascensionnelle Moyenne réelle (m/h)
  ascentSpeedMPerHour: number;
  
  // VDM : Vitesse de Descente Moyenne (m/h)
  descentSpeedMPerHour: number;
  
  // Facteur d'endurance (dégradation d'allure au fil des heures, ex: 1.05 = +5% de temps par tranche de 3h)
  fatigueFactor: number;
  
  // Niveau de confiance du profil basé sur le volume de données (0 à 100%)
  confidenceScorePercent: number;
}

export interface RouteTimeEstimation {
  estimatedDurationMinutes: number;
  estimatedDurationHours: number;
  formattedDuration: string;
  confidenceScorePercent: number;
  isPersonalized: boolean;
  breakdown: {
    flatTimeMinutes: number;
    ascentTimeMinutes: number;
    descentTimeMinutes: number;
    fatigueBufferMinutes: number;
  };
  comparisonToStandardMinutes: number; // positif = plus lent que la moyenne standard, négatif = plus rapide
}

// Constantes standards FFRP / Randonnée de référence
const STANDARD_FLAT_SPEED_KMH = 4.0; // 4 km/h standard
const STANDARD_VAM_M_PER_H = 300;     // 300 m D+/h standard
const STANDARD_VDM_M_PER_H = 500;     // 500 m D-/h standard

export class HikerProfileEngine {
  /**
   * Analyse une liste de sessions pour extraire le profil de vitesse et la VAM réelle du marcheur.
   */
  public static computeAthleticProfile(
    userId: string,
    sessions: HikeSession[]
  ): HikerAthleticProfile {
    const validSessions = (sessions || []).filter(
      (s) => s.distanceKm > 0.5 && s.durationSeconds > 300
    );

    if (validSessions.length === 0) {
      return {
        userId,
        totalSessionsAnalyzed: 0,
        totalDistanceKm: 0,
        totalElevationGainM: 0,
        totalDurationSeconds: 0,
        flatSpeedKmH: STANDARD_FLAT_SPEED_KMH,
        ascentSpeedMPerHour: STANDARD_VAM_M_PER_H,
        descentSpeedMPerHour: STANDARD_VDM_M_PER_H,
        fatigueFactor: 1.0,
        confidenceScorePercent: 0,
      };
    }

    let totalDistKm = 0;
    let totalDurSec = 0;
    let totalAscentM = 0;

    const sessionVamSamples: number[] = [];
    const sessionFlatSpeedSamples: number[] = [];

    for (const session of validSessions) {
      totalDistKm += session.distanceKm;
      totalDurSec += session.durationSeconds;
      const gain = session.elevationGainM || 0;
      totalAscentM += gain;

      const durationHours = session.durationSeconds / 3600;

      // Si la session comporte du dénivelé significatif (> 100m)
      if (gain >= 100 && durationHours > 0.2) {
        // Estimation temps à plat théorique (à ~4km/h)
        const theoreticalFlatHours = session.distanceKm / STANDARD_FLAT_SPEED_KMH;
        // Le temps restant est alloué au travail contre la gravité (montée)
        const climbHours = Math.max(0.1, durationHours - theoreticalFlatHours * 0.6);
        const sampleVam = gain / climbHours;

        // Éliminer les anomalies aberrantes (ex: VAM > 1500m/h ou < 50m/h)
        if (sampleVam >= 80 && sampleVam <= 1400) {
          sessionVamSamples.push(sampleVam);
        }
      }

      // Si la session est plate ou peu pentue
      if (gain < 150 && session.distanceKm > 1) {
        const speed = session.distanceKm / durationHours;
        if (speed >= 1.5 && speed <= 8.5) {
          sessionFlatSpeedSamples.push(speed);
        }
      }
    }

    // Calcul de la VAM moyenne observée
    let observedVam = STANDARD_VAM_M_PER_H;
    if (sessionVamSamples.length > 0) {
      const sumVam = sessionVamSamples.reduce((a, b) => a + b, 0);
      observedVam = Math.round(sumVam / sessionVamSamples.length);
    }

    // Calcul de la vitesse à plat moyenne observée
    let observedFlatSpeed = STANDARD_FLAT_SPEED_KMH;
    if (sessionFlatSpeedSamples.length > 0) {
      const sumFlat = sessionFlatSpeedSamples.reduce((a, b) => a + b, 0);
      observedFlatSpeed = Math.round((sumFlat / sessionFlatSpeedSamples.length) * 10) / 10;
    } else if (totalDurSec > 0 && totalDistKm > 0) {
      // Déduction globale
      const overallSpeed = totalDistKm / (totalDurSec / 3600);
      observedFlatSpeed = Math.max(2.5, Math.min(6.5, Math.round(overallSpeed * 10) / 10));
    }

    // VDM proportionnelle (généralement 1.6x la VAM)
    const observedVdm = Math.round(observedVam * 1.6);

    // Score de confiance (10 sessions = 100% confiance)
    const confidenceScorePercent = Math.min(100, Math.round((validSessions.length / 8) * 100));

    return {
      userId,
      totalSessionsAnalyzed: validSessions.length,
      totalDistanceKm: Math.round(totalDistKm * 10) / 10,
      totalElevationGainM: Math.round(totalAscentM),
      totalDurationSeconds: totalDurSec,
      flatSpeedKmH: observedFlatSpeed,
      ascentSpeedMPerHour: observedVam,
      descentSpeedMPerHour: observedVdm,
      fatigueFactor: validSessions.length > 3 ? 1.05 : 1.0,
      confidenceScorePercent,
    };
  }

  /**
   * Estime la durée d'un itinéraire en combinant distance, dénivelé + et -, et le profil personnalisé.
   * Utilise la formule de Naismith ajustée (Méthode Suisse / Club Alpin).
   */
  public static estimateRouteDuration(
    distanceKm: number,
    elevationGainM: number = 0,
    elevationLossM: number = 0,
    profile?: HikerAthleticProfile | null
  ): RouteTimeEstimation {
    const flatSpeed = profile && profile.confidenceScorePercent > 20 
      ? profile.flatSpeedKmH 
      : STANDARD_FLAT_SPEED_KMH;

    const vam = profile && profile.confidenceScorePercent > 20 
      ? profile.ascentSpeedMPerHour 
      : STANDARD_VAM_M_PER_H;

    const vdm = profile && profile.confidenceScorePercent > 20 
      ? profile.descentSpeedMPerHour 
      : STANDARD_VDM_M_PER_H;

    // 1. Temps à plat (minutes)
    const flatTimeMinutes = (distanceKm / flatSpeed) * 60;

    // 2. Temps en montée (minutes)
    const ascentTimeMinutes = (Math.max(0, elevationGainM) / vam) * 60;

    // 3. Temps en descente (minutes)
    const descentTimeMinutes = (Math.max(0, elevationLossM) / vdm) * 60;

    // Règle suisse : Max(Temps Plat, Temps Dénivelé) + 0.5 * Min(Temps Plat, Temps Dénivelé)
    const totalElevTime = ascentTimeMinutes + descentTimeMinutes;
    const baseTimeMinutes = Math.max(flatTimeMinutes, totalElevTime) + 0.5 * Math.min(flatTimeMinutes, totalElevTime);

    // Buffer de fatigue pour les très longues sorties (> 4h)
    let fatigueBufferMinutes = 0;
    if (baseTimeMinutes > 240) {
      const extraHours = (baseTimeMinutes - 240) / 60;
      fatigueBufferMinutes = extraHours * 8; // +8 min par heure au-delà de 4h
    }

    const estimatedDurationMinutes = Math.round(baseTimeMinutes + fatigueBufferMinutes);
    const estimatedDurationHours = Math.round((estimatedDurationMinutes / 60) * 10) / 10;

    // Calcul standard de référence (profil standard non personnalisé)
    const standardFlat = (distanceKm / STANDARD_FLAT_SPEED_KMH) * 60;
    const standardElev = (Math.max(0, elevationGainM) / STANDARD_VAM_M_PER_H) * 60 + (Math.max(0, elevationLossM) / STANDARD_VDM_M_PER_H) * 60;
    const standardBase = Math.max(standardFlat, standardElev) + 0.5 * Math.min(standardFlat, standardElev);
    const standardMinutes = Math.round(standardBase);

    // Formatage texte (ex: "3h45" ou "45 min")
    const hours = Math.floor(estimatedDurationMinutes / 60);
    const mins = estimatedDurationMinutes % 60;
    const formattedDuration = hours > 0 ? `${hours}h${mins < 10 ? '0' : ''}${mins}` : `${mins} min`;

    return {
      estimatedDurationMinutes,
      estimatedDurationHours,
      formattedDuration,
      confidenceScorePercent: profile ? profile.confidenceScorePercent : 0,
      isPersonalized: Boolean(profile && profile.confidenceScorePercent >= 30),
      breakdown: {
        flatTimeMinutes: Math.round(flatTimeMinutes),
        ascentTimeMinutes: Math.round(ascentTimeMinutes),
        descentTimeMinutes: Math.round(descentTimeMinutes),
        fatigueBufferMinutes: Math.round(fatigueBufferMinutes),
      },
      comparisonToStandardMinutes: estimatedDurationMinutes - standardMinutes,
    };
  }
}
