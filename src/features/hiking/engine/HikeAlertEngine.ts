

export type AlertType =
  | 'OFF_ROUTE' |'GPS_WEAK' |'GPS_LOST' |'TURN' |'POI' |'ARRIVAL' |'LOW_BATTERY' |'OFFLINE';

export interface HikeAlert {
  id: string;
  type: AlertType;
  priority: 1 | 2 | 3 | 4; // 1 = Critical, 2 = High, 3 = Medium, 4 = Info
  title: string;
  message: string;
  timestamp: string;
  cooldownMs: number;
  source: 'gps' | 'route' | 'battery' | 'system' | 'weather';
  data?: unknown;
}

export class HikeAlertEngine {
  private activeAlerts: Map<string, HikeAlert> = new Map();
  private lastFiredTimestamps: Map<string, number> = new Map();

  /**
   * Propose une alerte au moteur. Si elle respecte le cooldown et la priorité, elle est acceptée.
   */
  public pushAlert(alert: Omit<HikeAlert, 'id' | 'timestamp'>): HikeAlert | null {
    const key = `${alert.type}_${alert.title}`;
    const now = Date.now();
    const lastFired = this.lastFiredTimestamps.get(key) || 0;

    if (now - lastFired < alert.cooldownMs) {
      return null; // Ignorer en raison du cooldown
    }

    const fullAlert: HikeAlert = {
      ...alert,
      id: `${alert.type.toLowerCase()}-${now}`,
      timestamp: new Date(now).toISOString(),
    };

    this.activeAlerts.set(fullAlert.id, fullAlert);
    this.lastFiredTimestamps.set(key, now);
    return fullAlert;
  }

  /**
   * Retourne l'alerte la plus prioritaire active à afficher dans le cockpit.
   */
  public getHighestPriorityAlert(): HikeAlert | null {
    const list = Array.from(this.activeAlerts.values());
    if (list.length === 0) return null;
    list.sort((a, b) => a.priority - b.priority || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list[0];
  }

  /**
   * Supprime une alerte une fois résolue (ex: retour sur tracé).
   */
  public dismissAlert(type: AlertType): void {
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.type === type) {
        this.activeAlerts.delete(id);
      }
    }
  }

  /**
   * Vide l'ensemble des alertes actives.
   */
  public clear(): void {
    this.activeAlerts.clear();
  }
}
