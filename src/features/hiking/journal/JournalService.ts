import { HikingJournalEvent } from './JournalEventBuilder';

export class JournalService {
  /**
   * Persist a journal event to Supabase backend API (`/api/carnets/[id]`).
   */
  public static async saveEvent(carnetId: string, event: HikingJournalEvent): Promise<{ success: boolean; eventId: string }> {
    const res = await fetch(`/api/carnets/${carnetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: event.isAutomatic ? 'auto' : 'manuel',
        citation: event.title,
        lieu: event.description || `Km ${event.distanceKm.toFixed(1)}`,
        heure: new Date(event.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        momentTimestamp: event.timestamp,
        imageUrl: event.mediaUrl || null,
        identifiedSpecies: event.identifiedSpecies || null,
      }),
    });

    if (!res.ok) {
      throw new Error('Erreur de sauvegarde de l\'événement carnet');
    }

    const data = await res.json();
    return { success: true, eventId: data.id || event.id };
  }

  /**
   * Fetch all journal events for a carnet timeline.
   */
  public static async getJournalEvents(carnetId: string): Promise<HikingJournalEvent[]> {
    const res = await fetch(`/api/carnets/${carnetId}`);
    if (!res.ok) return [];
    
    const data = await res.json();
    const moments = data.carnet_moments || [];

    return moments.map((m: any) => ({
      id: m.id,
      type: m.source === 'auto' ? 'POI' : 'PHOTO',
      timestamp: m.moment_timestamp || m.created_at,
      latitude: 0,
      longitude: 0,
      distanceKm: 0,
      title: m.citation || 'Moment de voyage',
      description: m.lieu || undefined,
      mediaUrl: m.image_url || undefined,
      identifiedSpecies: m.identified_species || undefined,
      isAutomatic: m.source === 'auto',
    }));
  }
}
