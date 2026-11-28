import Foundation
import AppIntents

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Exécution out-of-process sécurisée : enregistre la commande et réveille le moteur
/// Swift principal via Darwin Notification (0 dépendance WebView / App Group optionnel).
private func dispatchNativeIntentCommand(sessionId: String, kind: String) {
    UserDefaults.standard.set(
        ["sessionId": sessionId, "kind": kind, "ts": Date().timeIntervalSince1970],
        forKey: "lkdv.pendingIntentCommand"
    )
    let center = CFNotificationCenterGetDarwinNotifyCenter()
    CFNotificationCenterPostNotification(
        center,
        CFNotificationName("com.lekitduvoyageur.intent.command" as CFString),
        nil,
        nil,
        true
    )
}

@available(iOS 17.0, *)
public struct TogglePauseActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Pause ou Reprendre la sortie"
    @Parameter(title: "Session") public var sessionId: String
    public init() { self.sessionId = "" }
    public init(sessionId: String) { self.sessionId = sessionId }
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: sessionId, kind: "toggle_pause")
        return .result()
    }
}

@available(iOS 17.0, *)
public struct AddWaypointActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Ajouter un repère GPS"
    @Parameter(title: "Session") public var sessionId: String
    public init() { self.sessionId = "" }
    public init(sessionId: String) { self.sessionId = sessionId }
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: sessionId, kind: "add_waypoint")
        return .result()
    }
}

@available(iOS 17.0, *)
public struct MarkLapActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Marquer un tour ou transition"
    @Parameter(title: "Session") public var sessionId: String
    public init() { self.sessionId = "" }
    public init(sessionId: String) { self.sessionId = sessionId }
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: sessionId, kind: "mark_lap_split")
        return .result()
    }
}

@available(iOS 17.0, *)
public struct LogStrengthSetActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Valider la série musculation"
    @Parameter(title: "Session") public var sessionId: String
    public init() { self.sessionId = "" }
    public init(sessionId: String) { self.sessionId = sessionId }
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: sessionId, kind: "log_strength_set")
        return .result()
    }
}

/// Règle sécurité A7 : ne déclenche JAMAIS d'appel 112/AML automatique depuis la poche.
/// Ouvre uniquement l'écran de confirmation Fiche Secours SOS (`lkdv://explorer/sos`).
@available(iOS 17.0, *)
public struct TriggerSosActivityIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Ouvrir la Fiche Secours SOS"
    public static var openAppWhenRun: Bool = true
    public init() {}
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: "active", kind: "open_sos")
        return .result()
    }
}

/// Bouton Action iPhone 16 Pro (Mode Gants / Montagne) : pause/reprise ou repère sans toucher l'écran.
@available(iOS 17.0, *)
public struct ActionButtonWorkoutIntent: AppIntent {
    public static var title: LocalizedStringResource = "Action Sortie Explorer (Pause / Transition)"
    public static var description = IntentDescription("Met en pause, reprend ou marque une transition sur la sortie Explorer active.")
    public init() {}
    public func perform() async throws -> some IntentResult {
        dispatchNativeIntentCommand(sessionId: "active", kind: "toggle_pause")
        return .result()
    }
}
