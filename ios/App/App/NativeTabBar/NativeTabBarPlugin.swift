import Foundation
import Capacitor

/// Plugin Capacitor `NativeTabBar` — pont natif iOS 27 Liquid Glass v8.
///
/// Rôle strict :
/// - Exposer les 5 onglets canoniques (`adventures`, `community`, `explorer`, `messages`, `me`) ;
/// - Piloter la barre accessoire contextuelle (`setAccessory` : profil altimétrique Compas /
///   courbe 12 mois Compte) et relayer ses interactions (`accessoryEvent`) ;
/// - Piloter la minimisation (`setMinimized`) et le mode Plein Soleil (`setOutdoorMode`).
///
/// Interdits : URL arbitraires, 6e onglet, navigation directe WebView depuis
/// Swift, rechargement, recréation de WebView. Le tap natif émet `tabSelected`
/// (`{ id }`) ; le routeur Next.js décide seul du `router.push(href)`.
@objc(NativeTabBar)
public class NativeTabBar: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabBar"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSelectedTab", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMinimized", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOutdoorMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAccessory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
    ]

    /// Allowlist fermée — miroir de `destinationRegistry.ts`.
    private let allowedIDs: Set<String> = ["adventures", "community", "explorer", "messages", "me"]
    private var selectionObserver: NSObjectProtocol?
    private var accessoryObserver: NSObjectProtocol?

    override public func load() {
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .LKDVNativeTabBarDidSelect,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let raw = note.userInfo?["id"] as? String else { return }
            self?.emitSelection(raw)
        }

        accessoryObserver = NotificationCenter.default.addObserver(
            forName: .LKDVNativeTabAccessoryEvent,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let action = note.userInfo?["action"] as? String else { return }
            var payload: [String: Any] = ["action": action]
            if let progress = note.userInfo?["progress"] as? Double {
                payload["progress"] = progress
            }
            self?.notifyListeners("accessoryEvent", data: payload)
        }
    }

    deinit {
        if let observer = selectionObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = accessoryObserver {
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

    /// Minimise/restaure la barre d'onglets et sa barre accessoire (défilement bas ou ouverture de tiroir).
    @objc func setMinimized(_ call: CAPPluginCall) {
        guard let minimized = call.getBool("minimized") else {
            call.reject("NATIVE_TABBAR_MISSING_PARAM: 'minimized' (boolean) requis")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setMinimized(minimized)
            call.resolve(["minimized": minimized])
        }
    }

    /// Bascule le mode Plein Soleil (`☀`) sur la barre d'onglets et l'accessoire.
    @objc func setOutdoorMode(_ call: CAPPluginCall) {
        guard let outdoor = call.getBool("outdoor") else {
            call.reject("NATIVE_TABBAR_MISSING_PARAM: 'outdoor' (boolean) requis")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setOutdoorMode(outdoor)
            call.resolve(["outdoor": outdoor])
        }
    }

    /// Configure la barre accessoire contextuelle (`UITabAccessory` / `.acc` v8).
    @objc func setAccessory(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? false
        let title = call.getString("title") ?? ""
        let subtitle = call.getString("subtitle") ?? ""
        let symbol = call.getString("symbol") ?? "mountain.2"
        let rawSpark = call.getArray("sparkline", Double.self) ?? []

        let config = LKDVAccessoryConfig(
            visible: visible,
            title: title,
            subtitle: subtitle,
            symbol: symbol,
            sparkline: rawSpark
        )
        DispatchQueue.main.async { [weak self] in
            guard let container = self?.container() else {
                call.reject("NATIVE_TABBAR_NO_CONTAINER: conteneur indisponible")
                return
            }
            container.setAccessory(config)
            call.resolve([
                "visible": visible,
                "title": title,
                "subtitle": subtitle,
            ])
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
                    "minimized": false,
                    "outdoorMode": false,
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
                "minimized": container.isMinimized,
                "outdoorMode": container.isOutdoorMode,
                "selectedTab": container.selectedTabID.rawValue,
                "iosMajor": major,
                "container": true,
            ])
        }
    }
}
