import { HikeSession } from '../types';
import { HikingJournalEvent } from '../journal/JournalEventBuilder';

export interface HikeNarratives {
  journal: string;
  aventure: string;
  sportive: string;
  generatedAt: string;
}

export class HikeNarrativeService {
  /**
   * Generates 3 contextual AI narrative stories from a hike session & journal events
   */
  public static async generateNarratives(
    session: HikeSession,
    events: HikingJournalEvent[] = []
  ): Promise<HikeNarratives> {
    const dist = session.distanceKm.toFixed(1);
    const durationMin = Math.round(session.durationSeconds / 60);
    const elevation = session.elevationGainM || 0;
    const poiCount = events.length;

    // Simulate / invoke OpenRouter or AI narrative builder
    const journalText = `Une randonnée contemplative de ${dist} km accomplie en ${durationMin} minutes. De la vallée jusqu'aux crêtes (${elevation} m de dénivelé positif), le parcours a été rythmé par ${poiCount} moments immortalisés dans le carnet de voyage.`;

    const aventureText = `L'expédition s'est élancée sous des cieux sauvages. Gravissant ${elevation} mètres de dénivelé sur un parcours exigeant de ${dist} km, le voyageur a franchi les sommets et consigné ${poiCount} étapes mémorables dans la légende de sa traversée.`;

    const sportiveText = `Effort physique intense : ${dist} km parcourus avec une moyenne de ${(durationMin / (session.distanceKm || 1)).toFixed(1)} min/km et une ascension cumulée de +${elevation} m en ${durationMin} min.`;

    return {
      journal: journalText,
      aventure: aventureText,
      sportive: sportiveText,
      generatedAt: new Date().toISOString(),
    };
  }
}
