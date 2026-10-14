import Foundation
import Capacitor

/// Plugin Capacitor `NativeTabBar` — pont natif du POC Liquid Glass (iOS uniquement).
///
/// Rôle strict : exposer 5 onglets canoniques + visibilité + état.
/// Interdits : URL arbitraires, 6e onglet, navigation directe WebView depuis
/// Swift, rechargement, recréation de WebView. Le tap natif émet `tabSelected`
/// (`{ id }`) ; le routeur Next.js décide seul du `router.push(href)`.
///
/// Disponibilité : iOS 15+ (deployment target conservé). Le matériau Liquid
/// Glass est celui d'`UITabBar` système sur iOS 26+ (aucun effet custom).
/// Sur iOS antérieur : même code, flou standard — repli automatique.
///
/// Enregistrement : classe `@objc(NativeTabBar)` compilée dans la cible `App`.
/// Côté JS : `Capacitor.registerPlugin("NativeTabBar")` avec repli web no-op
/// (voir `src/lib/native/tabBar.ts`). Aucun impact Android/Web/PWA.
@objc(NativeTabBar)
public class NativeTabBar: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabBar"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSelectedTab", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
    ]

    /// Allowlist fermée — miroir de `destinationRegistry.ts`.
    private let allowedIDs: Set<String> = ["adventures", "community", "explorer", "messages", "me"]
    private var selectionObserver: NSObjectProtocol?

    override public func load() {
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .LKDVNativeTabBarDidSelect,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let raw = note.userInfo?["id"] as? String else { return }
            self?.emitSelection(raw)
        }
    }

    deinit {
        if let observer = selectionObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Émission (natif → web)

    private func emitSelection(_ rawID: String) {
        guard allowedIDs.contains(rawID) else { return }
        notifyListeners("tabSelected", data: ["id": rawID])
    }

    private func container() -> NativeTabBarContainerViewController? {
        NativeTabBarContainerViewController.shared
    }

    // MARK: - Méthodes (web → natif)

    /// Active/désactive la barre native (flag de test iOS, OFF par défaut côté web).
    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("NATIVE_TABBAR_MISSING_PARAM: 'enabled' (boolean) requis")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setEnabled(enabled)
            call.resolve(["enabled": enabled])
        }
    }

    /// Sélectionne l'onglet natif (sync route React → tab iOS, deep link inclus).
    /// Rejette tout identifiant hors allowlist.
    @objc func setSelectedTab(_ call: CAPPluginCall) {
        guard let raw = call.getString("tab") else {
            call.reject("NATIVE_TABBAR_MISSING_PARAM: 'tab' (string) requis")
            return
        }
        guard allowedIDs.contains(raw), let tabID = LKDVTabID(rawValue: raw) else {
            call.reject("NATIVE_TABBAR_UNKNOWN_TAB: '\(raw)' hors allowlist (5 onglets)")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setSelectedTab(tabID)
            call.resolve(["selectedTab": raw])
        }
    }

    /// Masque/affiche la barre native (auth, checkout, publication pleine page,
    /// `lkdv-toggle-bottom-bar`). Ne touche jamais à la WebView.
    @objc func setVisible(_ call: CAPPluginCall) {
        guard let visible = call.getBool("visible") else {
            call.reject("NATIVE_TABBAR_MISSING_PARAM: 'visible' (boolean) requis")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setRouteVisible(visible)
            call.resolve(["visible": visible])
        }
    }

    /// État courant pour le web (diagnostic + tests Mac).
    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            let major = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
            guard let container = self?.container() else {
                call.resolve([
                    "available": true,
                    "enabled": false,
                    "visible": false,
                    "selectedTab": "adventures",
                    "iosMajor": major,
                    "container": false,
                ])
                return
            }
            call.resolve([
                "available": true,
                "enabled": container.isTabBarEnabled,
                "visible": container.isEffectivelyVisible,
                "selectedTab": container.selectedTabID.rawValue,
                "iosMajor": major,
                "container": true,
            ])
        }
    }
}
