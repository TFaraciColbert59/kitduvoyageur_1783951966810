import Foundation
import Capacitor

/// Plugin Capacitor 8.5 pontant `LkdvNativeTrackerEngine` vers la WebView.
@objc(LkdvNativeTrackerPlugin)
public final class LkdvNativeTrackerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LkdvNativeTrackerPlugin"
    public let jsName = "LkdvNativeTracker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterBivouacSleep", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeFromBivouac", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addWaypoint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "calibrateAltitudeManual", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discardSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecoverableSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSnapshot", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        LkdvNativeTrackerEngine.shared.onSnapshotUpdate = { [weak self] snap in
            self?.notifyListeners("trackerSnapshot", data: snap)
        }
    }

    @objc func startSession(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId") ?? UUID().uuidString
        let userId = call.getString("userId") ?? "anonymous"
        let slug = call.getString("canonicalSlug") ?? "hiking"
        let version = call.getString("specVersion") ?? "2.0.0"
        let distanceFilterM = call.getDouble("distanceFilterM") ?? 5.0
        let maxAcc = call.getDouble("maxHorizontalAccuracyM") ?? 30.0
        let baroHyst = call.getDouble("baroHysteresisM") ?? 2.0
        let autoPause = call.getBool("autoPauseEnabled") ?? true
        let lockAutoPauseOff = call.getBool("lockAutoPauseDisabled") ?? false
        let maxSpeed = call.getDouble("maxInstantSpeedKmh") ?? 40.0

        let snap = LkdvNativeTrackerEngine.shared.startSession(
            sessionId: sessionId,
            userId: userId,
            canonicalSlug: slug,
            specVersion: version,
            distanceFilterM: distanceFilterM,
            maxHorizontalAccuracyM: maxAcc,
            baroHysteresisM: baroHyst,
            autoPauseEnabled: autoPause,
            lockAutoPauseDisabled: lockAutoPauseOff,
            maxInstantSpeedKmh: maxSpeed
        )
        call.resolve(snap)
    }

    @objc func pauseSession(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.pauseSession(manual: call.getBool("manual") ?? true))
    }

    @objc func resumeSession(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.resumeSession())
    }

    @objc func enterBivouacSleep(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.enterBivouacSleep())
    }

    @objc func resumeFromBivouac(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.resumeFromBivouac())
    }

    @objc func addWaypoint(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "note"
        let label = call.getString("label") ?? "Repère"
        call.resolve(LkdvNativeTrackerEngine.shared.addWaypoint(kind: kind, label: label))
    }

    @objc func calibrateAltitudeManual(_ call: CAPPluginCall) {
        guard let alt = call.getDouble("altitudeM") else {
            call.reject("altitudeM requis")
            return
        }
        call.resolve(LkdvNativeTrackerEngine.shared.calibrateAltitudeManual(alt))
    }

    @objc func finishSession(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.finishSession())
    }

    @objc func discardSession(_ call: CAPPluginCall) {
        LkdvNativeTrackerEngine.shared.discardSession()
        call.resolve(["discarded": true])
    }

    @objc func getRecoverableSession(_ call: CAPPluginCall) {
        if let recovered = LkdvNativeTrackerEngine.shared.bootRecover() {
            call.resolve([
                "recovered": true,
                "sessionId": recovered.sessionId,
                "canonicalSlug": recovered.canonicalSlug,
                "domainState": recovered.domainState,
                "distanceM": recovered.distanceM,
                "elevGainM": recovered.elevGainM,
                "movingS": Double(recovered.activeMovingMs) / 1000.0
            ])
        } else {
            call.resolve(["recovered": false])
        }
    }

    @objc func getSnapshot(_ call: CAPPluginCall) {
        call.resolve(LkdvNativeTrackerEngine.shared.snapshotDict())
    }
}
