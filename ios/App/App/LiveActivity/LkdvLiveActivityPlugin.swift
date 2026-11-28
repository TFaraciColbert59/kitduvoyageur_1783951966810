import Foundation
import Capacitor
import UserNotifications

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Plugin local Capacitor — Live Activity (ActivityKit) avec continuité > 8 h (Lot 03).
/// - Throttling des mises à jour <= 1 / 5 s (économie batterie SpringBoard).
/// - `staleDate` adaptatif (60–300 s selon sport).
/// - Rollover proactif à 7 h 45 (27 900 s) + notification locale de secours à 7 h 50 offline.
@objc(LkdvLiveActivityPlugin)
public class LkdvLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LkdvLiveActivityPlugin"
    public let jsName = "LkdvLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPushToStartToken", returnType: CAPPluginReturnPromise),
    ]

    private static let rolloverThresholdS: TimeInterval = 7 * 3600 + 45 * 60 // 7 h 45
    private static let minUpdateIntervalS: TimeInterval = 5.0

    private var currentActivity: Any?
    private var activityStartedAt: Date?
    private var lastUpdateSentAt: Date = .distantPast
    private var rolloverGeneration: Int = 1
    private var rolloverNotificationScheduled: Bool = false

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

    @objc func getPushToStartToken(_ call: CAPPluginCall) {
        if #available(iOS 17.2, *) {
            Task {
                for await tokenData in Activity<LkdvLiveActivityAttributes>.pushToStartTokenUpdates {
                    let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                    call.resolve(["supported": true, "token": hex])
                    return
                }
                call.resolve(["supported": false])
            }
        } else {
            call.resolve(["supported": false, "reason": "ios<17.2"])
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

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }

        let sport = call.getString("sport") ?? "Rando"
        let sessionId = call.getString("sessionId") ?? ""
        let sfSymbol = call.getString("sfSymbol") ?? "figure.hiking"
        let intentLeft = call.getString("intentLeft") ?? "toggle_pause"
        let intentRight = call.getString("intentRight") ?? "add_waypoint"
        let startedAtMs = call.getDouble("startedAt") ?? (Date().timeIntervalSince1970 * 1000)
        let staleTimeoutS = call.getDouble("staleTimeoutS") ?? 90.0
        let state = Self.state(from: call, generation: rolloverGeneration)

        Task {
            do {
                let attributes = LkdvLiveActivityAttributes(
                    sport: sport,
                    startedAt: Date(timeIntervalSince1970: startedAtMs / 1000),
                    sessionId: sessionId,
                    sfSymbol: sfSymbol,
                    intentLeft: intentLeft,
                    intentRight: intentRight
                )
                let activity = try Activity<LkdvLiveActivityAttributes>.request(
                    attributes: attributes,
                    content: ActivityContent(
                        state: state,
                        staleDate: Date().addingTimeInterval(staleTimeoutS)
                    ),
                    pushType: nil
                )
                currentActivity = activity
                activityStartedAt = Date()
                lastUpdateSentAt = Date()
                rolloverNotificationScheduled = false
                scheduleOfflineRolloverFallbackNotification()
                postLocalStatusNotification(
                    id: "lkdv.activity.started",
                    title: "Sortie démarrée — \(sport.capitalized)",
                    body: "Suivi GPS et Dynamic Island actifs."
                )
                call.resolve(["supported": true, "id": activity.id, "generation": rolloverGeneration])
            } catch {
                postLocalStatusNotification(
                    id: "lkdv.activity.started",
                    title: "Sortie démarrée — \(sport.capitalized)",
                    body: "Suivi GPS actif en arrière-plan."
                )
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
            start(call)
            return
        }

        let now = Date()
        let force = call.getBool("force") ?? false
        if !force && now.timeIntervalSince(lastUpdateSentAt) < Self.minUpdateIntervalS {
            call.resolve(["supported": true, "throttled": true, "id": activity.id])
            return
        }

        // Protocole continuité > 8 h : alerte/rollover à T = 7 h 45.
        let needsRollover = activityStartedAt.map { now.timeIntervalSince($0) >= Self.rolloverThresholdS } ?? false
        let staleTimeoutS = call.getDouble("staleTimeoutS") ?? 90.0
        var state = Self.state(from: call, generation: rolloverGeneration)
        if needsRollover {
            state.phaseLabel = "Relais 8h — Touchez pour prolonger"
            notifyListeners("liveActivityRolloverNeeded", data: [
                "generation": rolloverGeneration,
                "activityId": activity.id
            ])
        }

        lastUpdateSentAt = now
        Task {
            await activity.update(
                ActivityContent(state: state, staleDate: now.addingTimeInterval(staleTimeoutS))
            )
            call.resolve([
                "supported": true,
                "id": activity.id,
                "rolloverNeeded": needsRollover,
                "generation": rolloverGeneration
            ])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["supported": false])
            return
        }
        cancelOfflineRolloverFallbackNotification()
        guard let activity = currentActivity as? Activity<LkdvLiveActivityAttributes> else {
            call.resolve(["supported": true, "ended": false])
            return
        }
        let state = Self.state(from: call, generation: rolloverGeneration)
        Task {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: .immediate
            )
            currentActivity = nil
            activityStartedAt = nil
            rolloverGeneration = 1
            postLocalStatusNotification(
                id: "lkdv.activity.ended",
                title: "Sortie terminée",
                body: "Résumé prêt dans Explorer."
            )
            call.resolve(["supported": true, "ended": true])
        }
    }

    private func postLocalStatusNotification(id: String, title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        let req = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    private func scheduleOfflineRolloverFallbackNotification() {
        guard !rolloverNotificationScheduled else { return }
        rolloverNotificationScheduled = true
        let content = UNMutableNotificationContent()
        content.title = "Suivi GPS toujours actif"
        content.body = "Touchez 1 fois pour prolonger la Dynamic Island 8 h supplémentaires."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 7 * 3600 + 50 * 60, repeats: false)
        let req = UNNotificationRequest(identifier: "lkdv.liveactivity.rollover", content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req)
    }

    private func cancelOfflineRolloverFallbackNotification() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["lkdv.liveactivity.rollover"])
        rolloverNotificationScheduled = false
    }

    @available(iOS 16.2, *)
    private static func state(from call: CAPPluginCall, generation: Int) -> LkdvLiveActivityAttributes.ContentState {
        func slot(_ key: String) -> LkdvLiveActivityAttributes.MetricSlot? {
            guard let obj = call.getObject(key),
                  let label = obj["label"] as? String,
                  let value = obj["value"] as? String else { return nil }
            return LkdvLiveActivityAttributes.MetricSlot(label: label, value: value)
        }
        return LkdvLiveActivityAttributes.ContentState(
            distanceM: call.getDouble("distanceM") ?? 0,
            elevGainM: call.getDouble("elevGainM") ?? 0,
            movingS: call.getDouble("movingS") ?? 0,
            paused: call.getBool("paused") ?? false,
            offRoute: call.getBool("offRoute") ?? false,
            nextManeuverInstruction: call.getString("nextManeuverInstruction"),
            nextManeuverDistanceM: call.getDouble("nextManeuverDistanceM"),
            offRouteLabel: call.getString("offRouteLabel"),
            primarySlot: slot("primarySlot"),
            secondarySlot: slot("secondarySlot"),
            expandedSlot3: slot("expandedSlot3"),
            expandedSlot4: slot("expandedSlot4"),
            rolloverGeneration: generation,
            phaseLabel: call.getString("phaseLabel")
        )
    }
}
