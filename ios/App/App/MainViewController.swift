import UIKit
import Capacitor

/// Point d'entrée du pont Capacitor pour l'app iOS.
///
/// Enregistre le plugin local `LkdvLiveActivity` (ActivityKit) : c'est le seul
/// plugin qui n'est pas distribué par npm, il vit dans le projet Xcode.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LkdvLiveActivityPlugin())
    }
}
