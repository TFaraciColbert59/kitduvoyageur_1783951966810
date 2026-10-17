import UIKit
import Capacitor

/// Notifications internes (processus applicatif uniquement, jamais réseau).
/// Le conteneur publie les interactions tactiles natives ; les plugins Capacitor
/// les relaient au Web via `notifyListeners(...)`.
extension Notification.Name {
    static let LKDVNativeTabBarDidSelect = Notification.Name("LKDVNativeTabBarDidSelect")
    static let LKDVNativeTabBarRequestSync = Notification.Name("LKDVNativeTabBarRequestSync")
    static let LKDVNativeTabAccessoryEvent = Notification.Name("LKDVNativeTabAccessoryEvent")
    static let LKDVNativeUndoRequested = Notification.Name("LKDVNativeUndoRequested")
    static let LKDVNativeSheetDetentChanged = Notification.Name("LKDVNativeSheetDetentChanged")
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
        case .explorer: return "safari"
        case .messages: return "bubble.left"
        case .me: return "person.circle"
        }
    }

    var fallbackSymbolName: String {
        switch self {
        case .adventures: return "house"
        case .community: return "person.2"
        case .explorer: return "compass"
        case .messages: return "message"
        case .me: return "person"
        }
    }
}

/// Configuration de la barre accessoire contextuelle (`UITabAccessory` / `.acc` v8)
/// affichée au-dessus de la `UITabBar` (profil altimétrique dans Compas,
/// chronologie 12 mois / endurance kits dans Compte).
struct LKDVAccessoryConfig {
    var visible: Bool
    var title: String
    var subtitle: String
    var symbol: String
    var sparkline: [Double]
}

/// Mini-courbe vectorielle interactive (Sparkline / Profil altimétrique)
/// intégrée à la barre accessoire Liquid Glass.
final class LKDVSparklineView: UIView {
    private let areaLayer = CAShapeLayer()
    private let lineLayer = CAShapeLayer()
    private let scrubLineLayer = CAShapeLayer()
    private var values: [Double] = []
    var onScrub: ((Double) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear

        areaLayer.fillColor = UIColor(red: 91.0 / 255.0, green: 127.0 / 255.0, blue: 85.0 / 255.0, alpha: 0.24).cgColor
        layer.addSublayer(areaLayer)

        lineLayer.fillColor = UIColor.clear.cgColor
        lineLayer.strokeColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0).cgColor
        lineLayer.lineWidth = 1.6
        lineLayer.lineJoin = .round
        lineLayer.lineCap = .round
        layer.addSublayer(lineLayer)

        scrubLineLayer.strokeColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 0.85).cgColor
        scrubLineLayer.lineWidth = 1.2
        scrubLineLayer.isHidden = true
        layer.addSublayer(scrubLineLayer)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(pan)
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        addGestureRecognizer(tap)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setValues(_ newValues: [Double]) {
        values = newValues
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        drawSparkline()
    }

    private func drawSparkline() {
        let w = bounds.width
        let h = bounds.height
        guard w > 4, h > 4, values.count >= 2 else {
            areaLayer.path = nil
            lineLayer.path = nil
            return
        }
        let minVal = values.min() ?? 0
        let maxVal = values.max() ?? 1
        let span = max(maxVal - minVal, 0.0001)

        let linePath = UIBezierPath()
        let areaPath = UIBezierPath()

        for (index, val) in values.enumerated() {
            let x = CGFloat(index) * w / CGFloat(values.count - 1)
            let norm = CGFloat((val - minVal) / span)
            let y = (h - 3.0) - norm * (h - 7.0)
            let pt = CGPoint(x: x, y: y)
            if index == 0 {
                linePath.move(to: pt)
                areaPath.move(to: pt)
            } else {
                linePath.addLine(to: pt)
                areaPath.addLine(to: pt)
            }
        }
        areaPath.addLine(to: CGPoint(x: w, y: h))
        areaPath.addLine(to: CGPoint(x: 0, y: h))
        areaPath.close()

        lineLayer.path = linePath.cgPath
        areaLayer.path = areaPath.cgPath
    }

    private func emitProgress(at point: CGPoint) {
        guard bounds.width > 0 else { return }
        let progress = max(0.0, min(1.0, Double(point.x / bounds.width)))
        let x = CGFloat(progress) * bounds.width
        let scrubPath = UIBezierPath()
        scrubPath.move(to: CGPoint(x: x, y: 0))
        scrubPath.addLine(to: CGPoint(x: x, y: bounds.height))
        scrubLineLayer.path = scrubPath.cgPath
        scrubLineLayer.isHidden = false
        onScrub?(progress)
    }

    @objc private func handlePan(_ gr: UIPanGestureRecognizer) {
        switch gr.state {
        case .began, .changed:
            emitProgress(at: gr.location(in: self))
        default:
            scrubLineLayer.isHidden = true
        }
    }

    @objc private func handleTap(_ gr: UITapGestureRecognizer) {
        emitProgress(at: gr.location(in: self))
    }
}

/// Conteneur iOS 27 Liquid Glass v8 — une seule WebView Capacitor préservée.
///
/// Architecture :
/// - `CAPBridgeViewController` reste l'unique contrôleur web (même instance,
///   même bridge, aucun rechargement).
/// - `UITabBar` système en bas (matériau Liquid Glass automatique sur iOS 26/27).
/// - Barre accessoire flottante (`accessoryBar`) juste au-dessus de la `UITabBar`
///   pour le profil altimétrique (Compas) ou la chronologie 12 mois (Compte).
/// - Capsule Dynamic Island / Undo en haut (`undoBanner`) avec bouton `Annuler`.
/// - Support du mode Plein Soleil (`isOutdoorMode`) et de la minimisation (`isMinimized`).
final class NativeTabBarContainerViewController: UIViewController, UITabBarDelegate {

    static weak var shared: NativeTabBarContainerViewController?

    private let bridgeViewController: CAPBridgeViewController
    private let tabBar = UITabBar()

    // Barre accessoire Liquid Glass (.acc v8)
    private let accessoryEffectView = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialLight))
    private let accessoryModeButton = UIButton(type: .system)
    private let accessoryTitleLabel = UILabel()
    private let accessorySubtitleLabel = UILabel()
    private let sparklineView = LKDVSparklineView()

    // Capsule haute Dynamic Island / Undo (.island v8)
    private let undoBannerView = UIView()
    private let undoTitleLabel = UILabel()
    private let undoSubtitleLabel = UILabel()
    private let undoActionButton = UIButton(type: .system)
    private var undoHideWorkItem: DispatchWorkItem?

    /// État piloté par les plugins Capacitor — jamais deviné.
    private(set) var isTabBarEnabled = false
    private var isRouteVisible = true
    private var isKeyboardVisible = false
    private(set) var isMinimized = false
    private(set) var isOutdoorMode = false
    private(set) var activeSheetDetent: String = "closed"
    private var isSyncingSelection = false

    private var accessoryConfig = LKDVAccessoryConfig(
        visible: false,
        title: "",
        subtitle: "",
        symbol: "mountain.2",
        sparkline: []
    )

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
        overrideUserInterfaceStyle = .light

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

        // 2. Vraie UITabBar système en overlay bas (Liquid Glass par défaut).
        configureTabBar()
        view.addSubview(tabBar)
        tabBarBottomConstraint = tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBarBottomConstraint!,
        ])

        // 3. Barre accessoire contextuelle (.acc v8) ancrée 5pt au-dessus de la UITabBar.
        configureAccessoryBar()
        view.addSubview(accessoryEffectView)
        NSLayoutConstraint.activate([
            accessoryEffectView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 10),
            accessoryEffectView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
            accessoryEffectView.bottomAnchor.constraint(equalTo: tabBar.topAnchor, constant: -5),
            accessoryEffectView.heightAnchor.constraint(equalToConstant: 38),
        ])

        // 4. Capsule haute Dynamic Island / Undo (.island v8).
        configureUndoBanner()
        view.addSubview(undoBannerView)
        NSLayoutConstraint.activate([
            undoBannerView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            undoBannerView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            undoBannerView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            undoBannerView.heightAnchor.constraint(greaterThanOrEqualToConstant: 42),
        ])

        updateTabBarVisibility(animated: false)
        observeKeyboard()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Configuration système (Liquid Glass v8)

    private func configureTabBar() {
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.isHidden = true
        tabBar.alpha = 0
        tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)

        var items: [UITabBarItem] = []
        var map: [Int: LKDVTabID] = [:]
        for (index, tabID) in LKDVTabID.allCases.enumerated() {
            let image = UIImage(systemName: tabID.symbolName)
                ?? UIImage(systemName: tabID.fallbackSymbolName)
            let item = UITabBarItem(title: tabID.title, image: image, tag: index)
            item.accessibilityLabel = tabID.title
            items.append(item)
            map[index] = tabID
        }
        tabItems = items
        idByTag = map
        tabBar.setItems(items, animated: false)
        tabBar.selectedItem = items.first

        applyTabBarAppearance()
    }

    private func applyTabBarAppearance() {
        let appearance = UITabBarAppearance()
        if isOutdoorMode {
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(red: 252.0 / 255.0, green: 252.0 / 255.0, blue: 249.0 / 255.0, alpha: 0.96)
            tabBar.tintColor = UIColor(red: 20.0 / 255.0, green: 38.0 / 255.0, blue: 30.0 / 255.0, alpha: 1.0)
        } else {
            // Apparence système par défaut = Liquid Glass automatique sur iOS 26/27.
            appearance.configureWithDefaultBackground()
            tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)
        }
        tabBar.standardAppearance = appearance
        if #available(iOS 15.0, *) {
            tabBar.scrollEdgeAppearance = appearance
        }
    }

    private func configureAccessoryBar() {
        accessoryEffectView.translatesAutoresizingMaskIntoConstraints = false
        accessoryEffectView.layer.cornerRadius = 19
        if #available(iOS 13.0, *) {
            accessoryEffectView.layer.cornerCurve = .continuous
        }
        accessoryEffectView.clipsToBounds = true
        accessoryEffectView.layer.borderWidth = 0.6
        accessoryEffectView.layer.borderColor = UIColor.white.withAlphaComponent(0.75).cgColor
        accessoryEffectView.isHidden = true
        accessoryEffectView.alpha = 0

        let content = accessoryEffectView.contentView

        accessoryModeButton.translatesAutoresizingMaskIntoConstraints = false
        accessoryModeButton.backgroundColor = UIColor.white.withAlphaComponent(0.62)
        accessoryModeButton.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)
        accessoryModeButton.layer.cornerRadius = 14
        accessoryModeButton.setImage(UIImage(systemName: "mountain.2"), for: .normal)
        accessoryModeButton.addTarget(self, action: #selector(onAccessoryModeTap), for: .touchUpInside)
        accessoryModeButton.accessibilityLabel = "Basculer le mode de la courbe"

        let textStack = UIStackView(arrangedSubviews: [accessoryTitleLabel, accessorySubtitleLabel])
        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.spacing = 0

        accessoryTitleLabel.font = UIFont.monospacedDigitSystemFont(ofSize: 11.5, weight: .bold)
        accessoryTitleLabel.textColor = UIColor(red: 23.0 / 255.0, green: 43.0 / 255.0, blue: 36.0 / 255.0, alpha: 1.0)

        accessorySubtitleLabel.font = UIFont.systemFont(ofSize: 9.5, weight: .medium)
        accessorySubtitleLabel.textColor = UIColor(red: 23.0 / 255.0, green: 43.0 / 255.0, blue: 36.0 / 255.0, alpha: 0.64)

        let divider = UIView()
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.backgroundColor = UIColor(red: 23.0 / 255.0, green: 43.0 / 255.0, blue: 36.0 / 255.0, alpha: 0.12)

        sparklineView.translatesAutoresizingMaskIntoConstraints = false
        sparklineView.onScrub = { progress in
            NotificationCenter.default.post(
                name: .LKDVNativeTabAccessoryEvent,
                object: nil,
                userInfo: ["action": "scrub", "progress": progress]
            )
        }

        content.addSubview(accessoryModeButton)
        content.addSubview(textStack)
        content.addSubview(divider)
        content.addSubview(sparklineView)

        NSLayoutConstraint.activate([
            accessoryModeButton.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 6),
            accessoryModeButton.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            accessoryModeButton.widthAnchor.constraint(equalToConstant: 28),
            accessoryModeButton.heightAnchor.constraint(equalToConstant: 28),

            textStack.leadingAnchor.constraint(equalTo: accessoryModeButton.trailingAnchor, constant: 8),
            textStack.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            textStack.widthAnchor.constraint(lessThanOrEqualToConstant: 118),

            divider.leadingAnchor.constraint(equalTo: textStack.trailingAnchor, constant: 8),
            divider.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            divider.widthAnchor.constraint(equalToConstant: 1),
            divider.heightAnchor.constraint(equalToConstant: 22),

            sparklineView.leadingAnchor.constraint(equalTo: divider.trailingAnchor, constant: 8),
            sparklineView.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -10),
            sparklineView.topAnchor.constraint(equalTo: content.topAnchor, constant: 5),
            sparklineView.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -5),
        ])
    }

    private func configureUndoBanner() {
        undoBannerView.translatesAutoresizingMaskIntoConstraints = false
        undoBannerView.backgroundColor = UIColor(red: 8.0 / 255.0, green: 12.0 / 255.0, blue: 9.0 / 255.0, alpha: 0.96)
        undoBannerView.layer.cornerRadius = 21
        if #available(iOS 13.0, *) {
            undoBannerView.layer.cornerCurve = .continuous
        }
        undoBannerView.layer.shadowColor = UIColor.black.cgColor
        undoBannerView.layer.shadowOpacity = 0.28
        undoBannerView.layer.shadowRadius = 14
        undoBannerView.layer.shadowOffset = CGSize(width: 0, height: 6)
        undoBannerView.isHidden = true
        undoBannerView.alpha = 0

        let textStack = UIStackView(arrangedSubviews: [undoTitleLabel, undoSubtitleLabel])
        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.spacing = 1

        undoTitleLabel.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        undoTitleLabel.textColor = .white
        undoTitleLabel.numberOfLines = 1

        undoSubtitleLabel.font = UIFont.systemFont(ofSize: 10.5, weight: .regular)
        undoSubtitleLabel.textColor = UIColor.white.withAlphaComponent(0.68)
        undoSubtitleLabel.numberOfLines = 1

        undoActionButton.translatesAutoresizingMaskIntoConstraints = false
        undoActionButton.backgroundColor = UIColor(red: 91.0 / 255.0, green: 127.0 / 255.0, blue: 85.0 / 255.0, alpha: 0.42)
        undoActionButton.setTitleColor(UIColor(red: 168.0 / 255.0, green: 224.0 / 255.0, blue: 184.0 / 255.0, alpha: 1.0), for: .normal)
        undoActionButton.titleLabel?.font = UIFont.systemFont(ofSize: 11.5, weight: .bold)
        undoActionButton.layer.cornerRadius = 13
        undoActionButton.contentEdgeInsets = UIEdgeInsets(top: 5, left: 11, bottom: 5, right: 11)
        undoActionButton.setTitle("Annuler", for: .normal)
        undoActionButton.addTarget(self, action: #selector(onUndoButtonTap), for: .touchUpInside)

        undoBannerView.addSubview(textStack)
        undoBannerView.addSubview(undoActionButton)

        NSLayoutConstraint.activate([
            textStack.leadingAnchor.constraint(equalTo: undoBannerView.leadingAnchor, constant: 14),
            textStack.centerYAnchor.constraint(equalTo: undoBannerView.centerYAnchor),
            textStack.trailingAnchor.constraint(lessThanOrEqualTo: undoActionButton.leadingAnchor, constant: -8),

            undoActionButton.trailingAnchor.constraint(equalTo: undoBannerView.trailingAnchor, constant: -10),
            undoActionButton.centerYAnchor.constraint(equalTo: undoBannerView.centerYAnchor),
        ])
    }

    // MARK: - API pilotée par les plugins

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

    func setMinimized(_ minimized: Bool, animated: Bool = true) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.isMinimized != minimized else { return }
            self.isMinimized = minimized
            self.updateTabBarVisibility(animated: animated)
        }
    }

    func setOutdoorMode(_ outdoor: Bool, animated: Bool = true) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isOutdoorMode = outdoor
            self.applyTabBarAppearance()
            self.accessoryEffectView.effect = UIBlurEffect(
                style: outdoor ? .systemThickMaterialLight : .systemUltraThinMaterialLight
            )
            self.accessoryEffectView.layer.borderColor = (
                outdoor
                ? UIColor(red: 20.0 / 255.0, green: 38.0 / 255.0, blue: 30.0 / 255.0, alpha: 0.22)
                : UIColor.white.withAlphaComponent(0.75)
            ).cgColor
        }
    }

    func setAccessory(_ config: LKDVAccessoryConfig, animated: Bool = true) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.accessoryConfig = config
            self.accessoryTitleLabel.text = config.title
            self.accessorySubtitleLabel.text = config.subtitle
            self.accessorySubtitleLabel.isHidden = config.subtitle.isEmpty
            let img = UIImage(systemName: config.symbol) ?? UIImage(systemName: "mountain.2")
            self.accessoryModeButton.setImage(img, for: .normal)
            self.sparklineView.setValues(config.sparkline)
            self.updateTabBarVisibility(animated: animated)
        }
    }

    func setActiveSheetDetent(_ detent: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.activeSheetDetent = detent
            self.updateTabBarVisibility(animated: true)
        }
    }

    func presentUndoBanner(title: String, subtitle: String, undoable: Bool, durationMs: Int = 3800) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.undoHideWorkItem?.cancel()
            self.undoTitleLabel.text = title
            self.undoSubtitleLabel.text = subtitle
            self.undoSubtitleLabel.isHidden = subtitle.isEmpty
            self.undoActionButton.isHidden = !undoable

            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()

            self.undoBannerView.isHidden = false
            UIView.animate(withDuration: 0.24, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.4, options: [.beginFromCurrentState]) {
                self.undoBannerView.alpha = 1
                self.undoBannerView.transform = .identity
            }

            let work = DispatchWorkItem { [weak self] in
                self?.hideUndoBanner()
            }
            self.undoHideWorkItem = work
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(max(1000, durationMs)), execute: work)
        }
    }

    func hideUndoBanner() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            UIView.animate(withDuration: 0.2, animations: {
                self.undoBannerView.alpha = 0
            }, completion: { finished in
                if finished {
                    self.undoBannerView.isHidden = true
                }
            })
        }
    }

    func setSelectedTab(_ tabID: LKDVTabID, animated: Bool = false) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let index = self.idByTag.first(where: { $0.value == tabID })?.key,
                  index < self.tabItems.count else { return }
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
        isTabBarEnabled && isRouteVisible && !isKeyboardVisible && !isMinimized && activeSheetDetent == "closed"
    }

    private func updateTabBarVisibility(animated: Bool) {
        let showBar = isEffectivelyVisible
        let showAccessory = showBar && accessoryConfig.visible

        let applyState = { [weak self] in
            guard let self = self else { return }
            self.tabBar.alpha = showBar ? 1 : 0
            self.tabBar.transform = showBar ? .identity : CGAffineTransform(translationX: 0, y: 34).scaledBy(x: 0.94, y: 0.94)
            self.accessoryEffectView.alpha = showAccessory ? 1 : 0
            self.accessoryEffectView.transform = showAccessory ? .identity : CGAffineTransform(translationX: 0, y: 18).scaledBy(x: 0.95, y: 0.95)
        }

        if showBar { tabBar.isHidden = false }
        if showAccessory { accessoryEffectView.isHidden = false }

        if animated {
            UIView.animate(
                withDuration: 0.30,
                delay: 0,
                usingSpringWithDamping: 0.84,
                initialSpringVelocity: 0.3,
                options: [.beginFromCurrentState, .allowUserInteraction],
                animations: applyState,
                completion: { [weak self] _ in
                    if !showBar { self?.tabBar.isHidden = true }
                    if !showAccessory { self?.accessoryEffectView.isHidden = true }
                }
            )
        } else {
            applyState()
            tabBar.isHidden = !showBar
            accessoryEffectView.isHidden = !showAccessory
        }
    }

    // MARK: - Actions natives → Notifications Capacitor

    @objc private func onAccessoryModeTap() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        NotificationCenter.default.post(
            name: .LKDVNativeTabAccessoryEvent,
            object: nil,
            userInfo: ["action": "toggleMode"]
        )
    }

    @objc private func onUndoButtonTap() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
        hideUndoBanner()
        NotificationCenter.default.post(name: .LKDVNativeUndoRequested, object: nil)
    }

    // MARK: - UITabBarDelegate (tap natif → pont)

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
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
}
