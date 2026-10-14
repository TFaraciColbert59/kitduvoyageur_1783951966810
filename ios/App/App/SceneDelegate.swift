import UIKit
import Capacitor

// The existing CAPBridgeViewController remains the ONLY WebView.
// This subclass exposes a small native tab-bar bridge to the Next.js router.
final class LKDVBridgeViewController: CAPBridgeViewController {
    private(set) var accountTabBarPlugin: LKDVAccountTabBarPlugin?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let plugin = LKDVAccountTabBarPlugin()
        bridge?.registerPluginInstance(plugin)
        accountTabBarPlugin = plugin
    }
}

// iOS 26+ paints a real Liquid Glass tab bar when built against the iOS 26+ SDK.
// Each tab has a UIKit item, but only "Compte" owns the shared WebView.
// We intercept other tab taps and ask Next.js to navigate rather than swapping
// out the WebView (which would lose web history/authentication state).
final class LKDVAccountTabBarController: UITabBarController, UITabBarControllerDelegate {
    private let bridgeController: LKDVBridgeViewController
    private let destinationIds = ["adventures", "community", "explorer", "messages", "me"]

    init(bridgeController: LKDVBridgeViewController) {
        self.bridgeController = bridgeController
        super.init(nibName: nil, bundle: nil)

        let placeholderControllers: [UIViewController] = (0..<4).map { _ in UIViewController() }
        let controllers: [UIViewController] = placeholderControllers + [bridgeController]
        let items: [(String, String)] = [
            ("Hub", "tent"),
            ("Communauté", "person.2"),
            ("Explorer", "safari"),
            ("Messages", "message"),
            ("Compte", "person.crop.circle")
        ]
        for (index, controller) in controllers.enumerated() {
            let item = items[index]
            controller.tabBarItem = UITabBarItem(
                title: item.0,
                image: UIImage(systemName: item.1),
                selectedImage: nil
            )
        }

        setViewControllers(controllers, animated: false)
        selectedIndex = 4
        delegate = self
        tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)
        tabBar.isHidden = true
    }

    required init?(coder: NSCoder) {
        fatalError("Use init(bridgeController:)")
    }

    func setAccountVisible(_ requested: Bool) -> Bool {
        guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
            tabBar.isHidden = true
            return false
        }
        selectedIndex = 4
        tabBar.isHidden = !requested
        view.setNeedsLayout()
        view.layoutIfNeeded()
        return requested
    }

    func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
        guard let index = tabBarController.viewControllers?.firstIndex(of: viewController),
              destinationIds.indices.contains(index) else { return false }
        if index == 4 { return true }
        bridgeController.accountTabBarPlugin?.sendTabSelection(destinationIds[index])
        // The WebView stays selected while Next.js changes its route.
        return false
    }
}

@objc(LKDVAccountTabBarPlugin)
public final class LKDVAccountTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LKDVAccountTabBarPlugin"
    public let jsName = "LKDVAccountTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise)
    ]

    @objc func setVisible(_ call: CAPPluginCall) {
        let requested = call.getBool("visible") ?? false
        DispatchQueue.main.async { [weak self] in
            guard let bridgeController = self?.bridge?.viewController,
                  let accountController = bridgeController.parent as? LKDVAccountTabBarController else {
                call.resolve(["active": false])
                return
            }
            let active = accountController.setAccountVisible(requested)
            call.resolve(["active": active])
        }
    }

    func sendTabSelection(_ id: String) {
        notifyListeners("tabSelected", data: ["destination": id])
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1.0)
        let bridgeVC = LKDVBridgeViewController()
        bridgeVC.view.backgroundColor = stoneBg

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = stoneBg
        window?.rootViewController = LKDVAccountTabBarController(bridgeController: bridgeVC)
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
