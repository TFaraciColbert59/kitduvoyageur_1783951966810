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
    private var barHeight: NSLayoutConstraint!
    private var isNativeVisible = false
    private var keyboardShown = false
    private var lastRevision = -1
    private let selectionFeedback = UISelectionFeedbackGenerator()
    private let navigationProgress = UIProgressView(progressViewStyle: .bar)
    private var progressTask: DispatchWorkItem?

    init(web: LKDVBridgeViewController) {
        self.web = web
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("Use init(web:)")
    }

    // Preserve Capacitor's existing status-bar, appearance and orientation
    // behavior even though a UIKit container now owns the UIWindow root.
    override var childForStatusBarStyle: UIViewController? { web }
    override var childForStatusBarHidden: UIViewController? { web }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        web.supportedInterfaceOrientations
    }
    override var shouldAutorotate: Bool { web.shouldAutorotate }

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
        navigationProgress.translatesAutoresizingMaskIntoConstraints = false
        navigationProgress.isHidden = true
        navigationProgress.progressTintColor = tabBar.tintColor
        navigationProgress.trackTintColor = .clear
        navigationProgress.progress = 0.32
        view.addSubview(navigationProgress)
        NSLayoutConstraint.activate([
            navigationProgress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navigationProgress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            navigationProgress.bottomAnchor.constraint(equalTo: tabBar.topAnchor)
        ])
        selectionFeedback.prepare()

        barHeight = tabBar.heightAnchor.constraint(equalToConstant: 49)
        NSLayoutConstraint.activate([
            web.view.topAnchor.constraint(equalTo: view.topAnchor),
            web.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
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
        progressTask?.cancel()
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

    var nativeBarHeight: CGFloat { barHeight.constant }

    func setVisible(_ requested: Bool, selectedId: String?, revision: Int) -> Bool {
        // JS route changes are async: older setVisible calls must never
        // overwrite a newer page's selected tab or Compas exclusion.
        guard revision >= lastRevision else { return isNativeVisible }
        lastRevision = revision
        completeNavigation()

        guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
            if isNativeVisible { switchVisibility(false) }
            return false
        }
        // Null means an unclassified page: the native rail is present but
        // no top-level section is incorrectly highlighted.
        if let id = selectedId, let index = tabIds.firstIndex(of: id) {
            tabBar.selectedItem = tabBar.items?[index]
        } else {
            tabBar.selectedItem = nil
        }
        if isNativeVisible != requested { switchVisibility(requested) }
        // Ensure sizeThatFits() has accounted for the home indicator before
        // reporting an inset to Next.js. Initial height is just a placeholder.
        // Avoid repeatedly forcing a full WebView layout on every route.
        if requested { view.layoutIfNeeded() }
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
        // Never detach or resize the WebView; native system glass refracts
        // content beneath it. CSS reserves accessible bottom scrolling space.
        tabBar.isHidden = !shown
        view.setNeedsLayout()
    }

    private func beginNavigation() {
        progressTask?.cancel()
        navigationProgress.isHidden = true
        let task = DispatchWorkItem { [weak self] in
            guard let self = self, self.isNativeVisible, !self.keyboardShown else { return }
            self.navigationProgress.isHidden = false
            self.navigationProgress.progress = 0.32
        }
        progressTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18, execute: task)
    }

    private func completeNavigation() {
        progressTask?.cancel()
        progressTask = nil
        navigationProgress.isHidden = true
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard isNativeVisible, tabIds.indices.contains(item.tag) else { return }
        selectionFeedback.selectionChanged()
        selectionFeedback.prepare()
        beginNavigation()
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
        let revision = call.getInt("revision") ?? 0
        DispatchQueue.main.async { [weak self] in
            guard let web = self?.bridge?.viewController,
                  let host = web.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false])
                return
            }
            let active = host.setVisible(requested, selectedId: selectedId, revision: revision)
            call.resolve(["active": active, "height": host.nativeBarHeight])
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
