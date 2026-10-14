import UIKit
import Capacitor

/// Notifications internes (processus applicatif uniquement, jamais réseau).
/// Le conteneur publie la sélection tactile ; le plugin Capacitor la relaie
/// au Web via `notifyListeners("tabSelected")`.
extension Notification.Name {
    static let LKDVNativeTabBarDidSelect = Notification.Name("LKDVNativeTabBarDidSelect")
    static let LKDVNativeTabBarRequestSync = Notification.Name("LKDVNativeTabBarRequestSync")
}

/// Identifiants canoniques — miroir strict de
/// `src/components/mobile-nav/destinationRegistry.ts` (ordre + hrefs).
/// Aucun autre identifiant n'est accepté (pont fermé : pas d'URL arbitraire).
enum LKDVTabID: String, CaseIterable {
    case adventures
    case community
    case explorer
    case messages
    case me

    var title: String {
        switch self {
        case .adventures: return "Hub"
        case .community: return "Communauté"
        case .explorer: return "Explorer"
        case .messages: return "Messages"
        case .me: return "Compte"
        }
    }

    /// SF Symbols disponibles dès iOS 13, sauf `tent` (iOS 16+) avec repli `house`.
    /// Vérifié à l'exécution : `UIImage(systemName:)` nil → repli, jamais de crash.
    var symbolName: String {
        switch self {
        case .adventures: return "tent"
        case .community: return "person.2"
        case .explorer: return "compass"
        case .messages: return "message"
        case .me: return "person.circle"
        }
    }

    var fallbackSymbolName: String {
        switch self {
        case .adventures: return "house"
        case .community: return "person.2"
        case .explorer: return "safari"
        case .messages: return "message"
        case .me: return "person"
        }
    }
}

/// Conteneur POC iOS — une seule WebView Capacitor préservée.
///
/// Architecture : `CAPBridgeViewController` reste l'unique contrôleur web
/// (même instance, même bridge, aucun rechargement). La `UITabBar` native est
/// un overlay UIKit sous la WebView translucide, affichée uniquement quand le
/// pont JS l'active (flag de test OFF par défaut côté web).
///
/// Matériau Liquid Glass : sur iOS 26+, `UITabBar` utilise le matériau système
/// automatiquement **si et seulement si** on conserve l'apparence par défaut
/// (`configureWithDefaultBackground`). Interdits ici : `UIVisualEffectView`
/// arbitraire, capture d'écran, CSS-imitated glass, `backgroundImage = UIImage()`,
/// `isTranslucent = false`. Ne pas surcharger l'apparence au-delà du stricte
/// nécessaire (teinte d'accent par défaut du système).
///
/// Minimisation au scroll (`tabBarMinimizeBehavior` ou équivalent UIKit) :
/// VOLONTAIREMENT NON ACTIVÉE pour ce POC. Le nom exact de l'API diverge selon
/// les notes WWDC26/278 et doit être vérifié dans le SDK installé sur Mac
/// (`xcrun --sdk iphoneos --show-sdk-version`, grep `Minimiz` dans les headers
/// UIKit) + test réel du scroll WKWebView avant activation. Barre fixe ici :
/// la vérité du matériau prime sur la minimisation.
///
/// Déploiement : aucune modification du deployment target (15.0 conservé).
/// Tout code iOS 26+ est derrière `if #available` avec repli antérieur.
final class NativeTabBarContainerViewController: UIViewController, UITabBarDelegate {

    static weak var shared: NativeTabBarContainerViewController?

    private let bridgeViewController: CAPBridgeViewController
    private let tabBar = UITabBar()

    /// État piloté par le plugin (donc par le web) — jamais deviné.
    private(set) var isTabBarEnabled = false
    private var isRouteVisible = true
    private var isKeyboardVisible = false
    private var isSyncingSelection = false

    private var tabItems: [UITabBarItem] = []
    private var idByTag: [Int: LKDVTabID] = [:]
    private var tabBarBottomConstraint: NSLayoutConstraint?

    // MARK: - Init (bridge injecté, jamais recréé)

    init(bridgeViewController: CAPBridgeViewController) {
        self.bridgeViewController = bridgeViewController
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        NativeTabBarContainerViewController.shared = self

        let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1.0)
        view.backgroundColor = stoneBg

        // 1. WebView existante, en enfant — même instance, bridge intact.
        addChild(bridgeViewController)
        bridgeViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeViewController.view)
        NSLayoutConstraint.activate([
            bridgeViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        bridgeViewController.didMove(toParent: self)

        // 2. Vraie UITabBar système en overlay bas (translucide par défaut).
        configureTabBar()
        view.addSubview(tabBar)
        tabBarBottomConstraint = tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBarBottomConstraint!,
        ])

        updateTabBarVisibility(animated: false)
        observeKeyboard()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Configuration système (Liquid Glass préservé)

    private func configureTabBar() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isHidden = true
        tabBar.alpha = 0

        var items: [UITabBarItem] = []
        var map: [Int: LKDVTabID] = [:]
        for (index, tabID) in LKDVTabID.allCases.enumerated() {
            let image = UIImage(systemName: tabID.symbolName)
                ?? UIImage(systemName: tabID.fallbackSymbolName)
            let item = UITabBarItem(title: tabID.title, image: image, tag: index)
            // Accessibilité VoiceOver : même intitulés que le registre web.
            item.accessibilityLabel = tabID.title
            items.append(item)
            map[index] = tabID
        }
        tabItems = items
        idByTag = map
        tabBar.setItems(items, animated: false)
        tabBar.selectedItem = items.first

        // Apparence système par défaut = Liquid Glass automatique sur iOS 26+.
        // Ne rien opacifier ici : tout `backgroundImage` vide ou `isTranslucent=false`
        // supprimerait l'effet natif (interdit par la spec du POC).
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        tabBar.standardAppearance = appearance
        if #available(iOS 15.0, *) {
            tabBar.scrollEdgeAppearance = appearance
        }

        // PAS de `tabBarMinimizeBehavior` ici (POC barre fixe).
        // Vérification Mac requise avant toute activation :
        //   1. `xcrun --sdk iphoneos --show-sdk-version` (>= 26 attendu),
        //   2. grep du symbole exact dans les headers UIKit installés,
        //   3. test scroll réel WKWebView (pas de faux positif simulateur).
    }

    // MARK: - API pilotée par le plugin

    func setEnabled(_ enabled: Bool, animated: Bool = true) {
        DispatchQueue.main.async { [weak self] in
            self?.isTabBarEnabled = enabled
            self?.updateTabBarVisibility(animated: animated)
        }
    }

    func setRouteVisible(_ visible: Bool, animated: Bool = true) {
        DispatchQueue.main.async { [weak self] in
            self?.isRouteVisible = visible
            self?.updateTabBarVisibility(animated: animated)
        }
    }

    func setSelectedTab(_ tabID: LKDVTabID, animated: Bool = false) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let index = self.idByTag.first(where: { $0.value == tabID })?.key,
                  index < self.tabItems.count else { return }
            // Évite la boucle delegate → notify → set → delegate.
            if self.tabBar.selectedItem == self.tabItems[index] { return }
            self.isSyncingSelection = true
            self.tabBar.selectedItem = self.tabItems[index]
            self.isSyncingSelection = false
        }
    }

    var selectedTabID: LKDVTabID {
        guard let selected = tabBar.selectedItem,
              let id = idByTag[selected.tag] else { return .adventures }
        return id
    }

    var isEffectivelyVisible: Bool {
        isTabBarEnabled && isRouteVisible && !isKeyboardVisible
    }

    private func updateTabBarVisibility(animated: Bool) {
        let show = isEffectivelyVisible
        let apply = { [weak self] in
            guard let self = self else { return }
            if show {
                self.tabBar.isHidden = false
                self.tabBar.alpha = 1
            } else {
                self.tabBar.alpha = 0
                self.tabBar.isHidden = true
            }
            self.view.setNeedsLayout()
        }
        if animated {
            UIView.animate(withDuration: 0.22, animations: { [weak self] in
                guard let self = self else { return }
                if show {
                    self.tabBar.isHidden = false
                    self.tabBar.alpha = 1
                } else {
                    self.tabBar.alpha = 0
                }
            }, completion: { [weak self] finished in
                if finished, !show {
                    self?.tabBar.isHidden = true
                }
                apply()
            })
        } else {
            apply()
        }
    }

    // MARK: - UITabBarDelegate (tap natif → pont)

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        // Les sélections programmatiques (sync route→tab) ne renotifient pas.
        if isSyncingSelection { return }
        guard isTabBarEnabled, let tabID = idByTag[item.tag] else { return }
        NotificationCenter.default.post(
            name: .LKDVNativeTabBarDidSelect,
            object: nil,
            userInfo: ["id": tabID.rawValue]
        )
    }

    // MARK: - Clavier (évite le recouvrement, sans casser le bridge)

    private func observeKeyboard() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onKeyboardWillShow),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onKeyboardWillHide),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    @objc private func onKeyboardWillShow() {
        isKeyboardVisible = true
        updateTabBarVisibility(animated: true)
    }

    @objc private func onKeyboardWillHide() {
        isKeyboardVisible = false
        updateTabBarVisibility(animated: true)
    }

    // La rotation / Dynamic Island / home indicator sont gérés par Auto Layout
    // + safe areas système : la tabBar est ancrée au bas de la vue et le
    // système applique l'inset du home indicator. Côté web, `contentInset: never`
    // impose de garder la réservation `--bottom-nav-height` (voir pont TS).
}
