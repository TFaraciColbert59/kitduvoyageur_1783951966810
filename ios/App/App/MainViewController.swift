import UIKit
import Capacitor

/// Point d'entrée du pont Capacitor 8.5 pour l'app iOS.
/// Enregistre explicitement les 4 plugins locaux Swift (LiveActivity, Tracker SQLite WAL,
/// HealthKit Write, BLE GATT Background) afin qu'ils ne soient jamais écrasés par `cap sync`.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LkdvLiveActivityPlugin())
        bridge?.registerPluginInstance(LkdvNativeTrackerPlugin())
        bridge?.registerPluginInstance(LkdvHealthWritePlugin())
        bridge?.registerPluginInstance(LkdvBleBackgroundBridge())
    }
}
