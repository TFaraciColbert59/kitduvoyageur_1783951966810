import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1.0)
        let bridgeVC = CAPBridgeViewController()
        bridgeVC.view.backgroundColor = stoneBg

        // POC iOS native Liquid Glass : conteneur unique qui embarque l'UNIQUE
        // CAPBridgeViewController en enfant (même instance, bridge intact, une
        // seule WebView) + vraie UITabBar système en overlay. Aucun écran Next.js
        // migré vers Swift, aucune WebView dupliquée.
        let rootVC = NativeTabBarContainerViewController(bridgeViewController: bridgeVC)

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = stoneBg
        window?.rootViewController = rootVC
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
