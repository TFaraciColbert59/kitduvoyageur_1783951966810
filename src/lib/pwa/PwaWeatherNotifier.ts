/**
 * PWA Weather Notification Service
 * Sends live Web Push / Native notifications for weather alerts during hikes
 */

export interface WeatherNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
}

export class PwaWeatherNotifier {
  /**
   * Request push notification permission from user
   */
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Trigger a push notification for live weather alert
   */
  static sendAlert(payload: WeatherNotificationPayload): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(payload.title, {
              body: payload.body,
              icon: payload.icon || '/icon-192x192.png',
              tag: payload.tag || 'weather-alert',
              vibrate: [200, 100, 200],
              data: { url: '/randonnee-active' },
            } as any);
          });
        } else {
          new Notification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
            tag: payload.tag || 'weather-alert',
          });
        }
      } catch (err) {
        console.warn('Weather notification fallback error:', err);
      }
    }
  }

  /**
   * Check weather conditions and automatically trigger alert if dangerous
   */
  static checkAndNotify(weatherData: {
    tempC?: number;
    precipitationProbability?: number;
    windSpeedKmH?: number;
    isAlert?: boolean;
  }): void {
    if (!weatherData) return;

    if (weatherData.isAlert || (weatherData.precipitationProbability && weatherData.precipitationProbability >= 0.75)) {
      this.sendAlert({
        title: '⚡ Alerte Météo Randonnée',
        body: `Risque élevé de pluie (${Math.round((weatherData.precipitationProbability || 0.8) * 100)}%). Pensez à abriter votre équipement.`,
        tag: 'rain-alert',
      });
    } else if (weatherData.windSpeedKmH && weatherData.windSpeedKmH > 55) {
      this.sendAlert({
        title: '💨 Alerte Vents Forts en Altitude',
        body: `Raffales détectées à ${Math.round(weatherData.windSpeedKmH)} km/h sur votre secteur. Soyez prudent sur les crêtes.`,
        tag: 'wind-alert',
      });
    }
  }
}
