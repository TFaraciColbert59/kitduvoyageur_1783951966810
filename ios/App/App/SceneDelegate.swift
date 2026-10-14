import UIKit
import Capacitor

/// Exactly one CAPBridgeViewController remains mounted throughout navigation.
/// Native controls never instantiate a second WKWebView.
final class LKDVBridgeViewController: CAPBridgeViewController {
    private(set) var nativeTabBarPlugin: LKDVAccountTabBarPlugin?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let plugin = LKDVAccountTabBarPlugin()
        bridge?.registerPluginInstance(plugin)
        nativeTabBarPlugin = plugin
    }
}

/// An independent UIKit tab bar keeps Next.js/Capacitor's SINGLE WebView alive.
/// UITabBarController with dummy view controllers was deliberately removed:
/// selecting a dummy controller would detach the WebView, losing its state.
final class LKDVNativeTabBarHost: UIViewController, UITabBarDelegate {
    private let web: LKDVBridgeViewController
    private let tabBar = UITabBar()
    private let tabIds = ["adventures", "community", "explorer", "messages", "me"]
    private var webBottomToView: NSLayoutConstraint!
    private var webBottomToBar: NSLayoutConstraint!
    private var barHeight: NSLayoutConstraint!
    private var isNativeVisible = false
    private var keyboardShown = false

    init(web: LKDVBridgeViewController) {
        self.web = web
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("Use init(web:)")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)

        addChild(web)
        web.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web.view)

        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)
        tabBar.items = [
            UITabBarItem(title: "Hub", image: UIImage(systemName: "tent"), tag: 0),
            UITabBarItem(title: "Communauté", image: UIImage(systemName: "person.2"), tag: 1),
            UITabBarItem(title: "Explorer", image: UIImage(systemName: "safari"), tag: 2),
            UITabBarItem(title: "Messages", image: UIImage(systemName: "message"), tag: 3),
            UITabBarItem(title: "Compte", image: UIImage(systemName: "person.crop.circle"), tag: 4)
        ]
        tabBar.selectedItem = tabBar.items?[4]
        tabBar.isHidden = true
        view.addSubview(tabBar)

        webBottomToView = web.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        webBottomToBar = web.view.bottomAnchor.constraint(equalTo: tabBar.topAnchor)
        barHeight = tabBar.heightAnchor.constraint(equalToConstant: 49)
        NSLayoutConstraint.activate([
            web.view.topAnchor.constraint(equalTo: view.topAnchor),
            web.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webBottomToView,
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            barHeight
        ])
        web.didMove(toParent: self)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func keyboardWillShow(_ notification: Notification) {
        keyboardShown = true
        applyBarLayout()
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        keyboardShown = false
        applyBarLayout()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // UIKit controls the actual Liquid Glass rendering on iOS 26+.
        // Height includes the home-indicator safe area and rotation.
        let fitting = tabBar.sizeThatFits(CGSize(width: view.bounds.width, height: 0)).height
        let desired = max(49 + view.safeAreaInsets.bottom, fitting)
        if abs(barHeight.constant - desired) > 0.5 {
            barHeight.constant = desired
        }
    }

    func setVisible(_ requested: Bool, selectedId: String?) -> Bool {
        guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
            if isNativeVisible { switchVisibility(false) }
            return false
        }
        if let id = selectedId, let index = tabIds.firstIndex(of: id) {
            tabBar.selectedItem = tabBar.items?[index]
        }
        if isNativeVisible != requested { switchVisibility(requested) }
        return requested
    }

    private func switchVisibility(_ visible: Bool) {
        isNativeVisible = visible
        applyBarLayout()
    }

    private func applyBarLayout() {
        // A floating tab bar must never cover a web text field when the iOS
        // keyboard opens. The JS active state remains true so it won't
        // briefly render a second React bar while typing.
        let shown = isNativeVisible && !keyboardShown
        webBottomToView.isActive = !shown
        webBottomToBar.isActive = shown
        tabBar.isHidden = !shown
        view.setNeedsLayout()
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard isNativeVisible, tabIds.indices.contains(item.tag) else { return }
        web.nativeTabBarPlugin?.sendTabSelection(tabIds[item.tag])
    }
}

/// The JS API is backwards-compatible with the earlier Account-only pilot.
/// setVisible now receives the authoritative active destination.
@objc(LKDVAccountTabBarPlugin)
public final class LKDVAccountTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LKDVAccountTabBarPlugin"
    public let jsName = "LKDVAccountTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise)
    ]

    @objc func setVisible(_ call: CAPPluginCall) {
        let requested = call.getBool("visible") ?? false
        let selectedId = call.getString("selectedId")
        DispatchQueue.main.async { [weak self] in
            guard let web = self?.bridge?.viewController,
                  let host = web.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false])
                return
            }
            let active = host.setVisible(requested, selectedId: selectedId)
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
        let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)
        let web = LKDVBridgeViewController()
        web.view.backgroundColor = stoneBg

        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = stoneBg
        window.rootViewController = LKDVNativeTabBarHost(web: web)
        window.makeKeyAndVisible()
        self.window = window

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
