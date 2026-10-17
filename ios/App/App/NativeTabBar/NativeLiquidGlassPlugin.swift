import UIKit
import Capacitor

/// Plugin Capacitor `NativeLiquidGlass` — primitives natives iOS 27 Liquid Glass v8.
///
/// Expose au Web/Next.js les composants système Apple du Design System v8 :
/// 1. Feuilles linéaires à 3 hauteurs (`peek`, `medium`, `large`, `closed`) avec
///    repli coordonné de la `UITabBar` + `UITabAccessory` et retour haptique ;
/// 2. Menus morphing (`presentMorphingMenu`) ancrés sur la pilule touchée
///    (ex. Rôle dans Compas, Visibilité d'empreinte dans Compte) ;
/// 3. Capsule Dynamic Island / Undo (`presentUndoBanner`) avec bouton `Annuler`
///    émettant `undoRequested` ;
/// 4. Mode Plein Soleil (`setOutdoorMode`) et découverte des capacités (`getCapabilities`).
@objc(NativeLiquidGlass)
public class NativeLiquidGlass: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeLiquidGlass"
    public let jsName = "NativeLiquidGlass"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCapabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSheetDetent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissSheet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentMorphingMenu", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentUndoBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideUndoBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOutdoorMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "triggerHaptic", returnType: CAPPluginReturnPromise),
    ]

    private let allowedDetents: Set<String> = ["closed", "peek", "medium", "large"]
    private var undoObserver: NSObjectProtocol?

    override public func load() {
        undoObserver = NotificationCenter.default.addObserver(
            forName: .LKDVNativeUndoRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("undoRequested", data: [:])
        }
    }

    deinit {
        if let observer = undoObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func container() -> NativeTabBarContainerViewController? {
        NativeTabBarContainerViewController.shared
    }

    // MARK: - Capacités iOS 27 Liquid Glass

    @objc func getCapabilities(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            let major = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
            let c = self?.container()
            call.resolve([
                "available": true,
                "iosMajor": major,
                "supportsLiquidGlass": major >= 26,
                "supportsThreeDetents": major >= 16,
                "supportsTabAccessory": major >= 26,
                "outdoorMode": c?.isOutdoorMode ?? false,
                "activeDetent": c?.activeSheetDetent ?? "closed",
            ])
        }
    }

    // MARK: - Feuilles à 3 hauteurs (peek / medium / large)

    @objc func setSheetDetent(_ call: CAPPluginCall) {
        guard let detent = call.getString("detent"), allowedDetents.contains(detent) else {
            call.reject("NATIVE_LIQUID_GLASS_INVALID_DETENT: attendu 'closed' | 'peek' | 'medium' | 'large'")
            return
        }
        DispatchQueue.main.async { [weak self] in
            let selectionFeedback = UISelectionFeedbackGenerator()
            selectionFeedback.selectionChanged()
            self?.container()?.setActiveSheetDetent(detent)
            self?.notifyListeners("sheetDetentChanged", data: ["detent": detent])
            call.resolve(["detent": detent])
        }
    }

    @objc func dismissSheet(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.container()?.setActiveSheetDetent("closed")
            self?.notifyListeners("sheetDetentChanged", data: ["detent": "closed"])
            call.resolve(["detent": "closed"])
        }
    }

    // MARK: - Menu morphing (pilule Rôle / Visibilité d'empreinte)

    @objc func presentMorphingMenu(_ call: CAPPluginCall) {
        let title = call.getString("title")
        let selectedId = call.getString("selectedId")
        guard let rawOptions = call.getArray("options", JSObject.self), !rawOptions.isEmpty else {
            call.reject("NATIVE_LIQUID_GLASS_EMPTY_OPTIONS: 'options' requis")
            return
        }

        let x = CGFloat(call.getDouble("x") ?? 195.0)
        let y = CGFloat(call.getDouble("y") ?? 120.0)
        let width = CGFloat(call.getDouble("width") ?? 88.0)
        let height = CGFloat(call.getDouble("height") ?? 32.0)

        DispatchQueue.main.async { [weak self] in
            guard let presenter = self?.bridge?.viewController else {
                call.reject("NATIVE_LIQUID_GLASS_NO_PRESENTER")
                return
            }

            let alert = UIAlertController(title: title, message: nil, preferredStyle: .actionSheet)
            alert.view.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)

            for opt in rawOptions {
                guard let id = opt["id"] as? String,
                      let label = opt["label"] as? String else { continue }
                let subtitle = opt["subtitle"] as? String
                let isSelected = (id == selectedId)
                let displayTitle = isSelected
                    ? "✓ \(label)" + (subtitle != nil ? " — \(subtitle!)" : "")
                    : label + (subtitle != nil ? " — \(subtitle!)" : "")

                let action = UIAlertAction(title: displayTitle, style: .default) { [weak self] _ in
                    let generator = UISelectionFeedbackGenerator()
                    generator.selectionChanged()
                    self?.notifyListeners("menuSelected", data: ["id": id])
                    call.resolve(["selectedId": id, "cancelled": false])
                }
                if let symbol = opt["symbol"] as? String,
                   let img = UIImage(systemName: symbol) {
                    action.setValue(img, forKey: "image")
                }
                alert.addAction(action)
            }

            alert.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in
                call.resolve(["selectedId": NSNull(), "cancelled": true])
            })

            if let pop = alert.popoverPresentationController {
                pop.sourceView = presenter.view
                pop.sourceRect = CGRect(x: x, y: y, width: width, height: height)
            }

            presenter.present(alert, animated: true)
        }
    }

    // MARK: - Dynamic Island / Capsule Annuler

    @objc func presentUndoBanner(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("NATIVE_LIQUID_GLASS_MISSING_TITLE: 'title' requis")
            return
        }
        let subtitle = call.getString("subtitle") ?? ""
        let undoable = call.getBool("undoable") ?? true
        let durationMs = call.getInt("durationMs") ?? 3800

        DispatchQueue.main.async { [weak self] in
            self?.container()?.presentUndoBanner(
                title: title,
                subtitle: subtitle,
                undoable: undoable,
                durationMs: durationMs
            )
            call.resolve(["presented": true])
        }
    }

    @objc func hideUndoBanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.container()?.hideUndoBanner()
            call.resolve(["presented": false])
        }
    }

    // MARK: - Mode Plein Soleil & Haptique

    @objc func setOutdoorMode(_ call: CAPPluginCall) {
        guard let outdoor = call.getBool("outdoor") else {
            call.reject("NATIVE_LIQUID_GLASS_MISSING_OUTDOOR: 'outdoor' (boolean) requis")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.container()?.setOutdoorMode(outdoor)
            call.resolve(["outdoor": outdoor])
        }
    }

    @objc func triggerHaptic(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "light"
        DispatchQueue.main.async {
            switch style {
            case "heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "selection":
                UISelectionFeedbackGenerator().selectionChanged()
            case "success":
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "warning":
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
            default:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve(["triggered": true])
        }
    }
}
