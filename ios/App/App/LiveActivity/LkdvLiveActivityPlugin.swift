import Foundation
import Capacitor

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Plugin local Capacitor — Live Activity (ActivityKit).
///
/// L'Island affiche les métriques d'une sortie en cours quand l'app passe en
/// arrière-plan. Dans l'app au premier plan, rien n'est affiché (règle iOS) :
/// les messages passent par le bandeau de l'Explorer.
///
/// Toutes les méthodes répondent `{ supported: Bool }` : sur le web, le pont
/// JS est un no-op, et sur un iOS < 16.2 le plugin répond `supported: false`
/// au lieu d'échouer.
@objc(LkdvLiveActivityPlugin)
public class LkdvLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LkdvLiveActivityPlugin"
    public let jsName = "LkdvLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    /// Conservé en `Any` : le type générique n'existe qu'à partir d'iOS 16.2.
    private var currentActivity: Any?

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve([
                "supported": ActivityAuthorizationInfo().areActivitiesEnabled,
                "platform": "ios",
            ])
        } else {
            call.resolve(["supported": false, "platform": "ios"])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false, "reason": "ios<16.2"])
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["supported": false, "reason": "disabled-by-user"])
            return
        }

        let sport = call.getString("sport") ?? "rando"
        let startedAtMs = call.getDouble("startedAt") ?? (Date().timeIntervalSince1970 * 1000)
        let state = Self.state(from: call)

        Task {
            do {
                let attributes = LkdvLiveActivityAttributes(
                    sport: sport,
                    startedAt: Date(timeIntervalSince1970: startedAtMs / 1000)
                )
                let activity = try Activity<LkdvLiveActivityAttributes>.request(
                    attributes: attributes,
                    content: ActivityContent(
                        state: state,
                        staleDate: Date().addingTimeInterval(15 * 60)
                    ),
                    pushType: nil
                )
                currentActivity = activity
                call.resolve(["supported": true, "id": activity.id])
            } catch {
                call.resolve(["supported": false, "reason": error.localizedDescription])
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false])
            return
        }
        guard let activity = currentActivity as? Activity<LkdvLiveActivityAttributes> else {
            // Pas d'activité en cours : on démarre plutôt que d'échouer.
            start(call)
            return
        }
        let state = Self.state(from: call)
        Task {
            await activity.update(
                ActivityContent(state: state, staleDate: Date().addingTimeInterval(15 * 60))
            )
            call.resolve(["supported": true, "id": activity.id])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false])
            return
        }
        guard let activity = currentActivity as? Activity<LkdvLiveActivityAttributes> else {
            call.resolve(["supported": true, "ended": false])
            return
        }
        let state = Self.state(from: call)
        Task {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: .immediate
            )
            currentActivity = nil
            call.resolve(["supported": true, "ended": true])
        }
    }

    @available(iOS 16.2, *)
    private static func state(from call: CAPPluginCall) -> LkdvLiveActivityAttributes.ContentState {
        LkdvLiveActivityAttributes.ContentState(
            distanceM: call.getDouble("distanceM") ?? 0,
            elevGainM: call.getDouble("elevGainM") ?? 0,
            movingS: call.getDouble("movingS") ?? 0,
            paused: call.getBool("paused") ?? false,
            offRoute: call.getBool("offRoute") ?? false
        )
    }
}
