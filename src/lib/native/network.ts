import { Network, ConnectionStatus } from "@capacitor/network";
import { isNative } from "./platform";

export interface NetworkState {
  connected: boolean;
  connectionType: string;
}

/**
 * Recupere l'etat du reseau
 */
export async function getNetworkState(): Promise<NetworkState> {
  if (isNative()) {
    try {
      const status = await Network.getStatus();
      return {
        connected: status.connected,
        connectionType: status.connectionType,
      };
    } catch {
      // fallback
    }
  }

  if (typeof window !== "undefined") {
    return {
      connected: navigator.onLine,
      connectionType: "web",
    };
  }

  return { connected: true, connectionType: "unknown" };
}

/**
 * Ecouteur de changement d'etat reseau (offline / online)
 */
export async function onNetworkChange(
  callback: (status: NetworkState) => void
): Promise<() => void> {
  if (isNative()) {
    const handle = await Network.addListener("networkStatusChange", (status: ConnectionStatus) => {
      callback({
        connected: status.connected,
        connectionType: status.connectionType,
      });
    });
    return () => handle.remove();
  }

  if (typeof window !== "undefined") {
    const onlineHandler = () => callback({ connected: true, connectionType: "web" });
    const offlineHandler = () => callback({ connected: false, connectionType: "none" });

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }

  return () => {};
}
