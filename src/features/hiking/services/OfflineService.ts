import { saveRouteOffline, getRouteOffline, deleteRouteOffline, listOfflineRoutes, formatSize, OfflineRoute } from '@/lib/offlineStorage';


export class OfflineService {
  public static async saveRoute(route: OfflineRoute) {
    return saveRouteOffline(route);
  }

  public static async getRoute(routeId: string) {
    return getRouteOffline(routeId);
  }

  public static async removeRoute(routeId: string) {
    return deleteRouteOffline(routeId);
  }

  public static async listRoutes() {
    return listOfflineRoutes();
  }

  public static formatStorageSize(bytes: number): string {
    return formatSize(bytes);
  }
}
