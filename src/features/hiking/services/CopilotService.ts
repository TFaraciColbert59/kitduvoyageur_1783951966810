import { HikeSession, WeatherSnapshot } from '../types';

export class CopilotService {
  /**
   * Request AI preparation or in-hike advice.
   */
  public static async getAdvice(question: string, context?: { session?: HikeSession; weather?: WeatherSnapshot }): Promise<{ answer: string; tips: string[] }> {
    const res = await fetch('/api/trip-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context: context ? {
          weather: context.weather?.condition,
          tempC: context.weather?.tempC,
          distanceKm: context.session?.distanceKm,
        } : undefined,
      }),
    });

    if (!res.ok) {
      throw new Error('Assistant indisponible');
    }

    return res.json();
  }
}
