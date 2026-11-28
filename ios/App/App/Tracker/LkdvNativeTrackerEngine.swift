import Foundation
import CoreLocation
import CoreMotion
import ImageIO
import UniformTypeIdentifiers
import UIKit

/// Moteur de tracking natif Swift « Zéro-Perte » (iOS 18+).
/// Orchestre CoreLocation (`CLBackgroundActivitySession`), `CMAltimeter` + Terrarium DEM,
/// `CMPedometer` (dead-reckoning <= 90 s), `CMMotionActivityManager` (auto-pause + voiture),
/// mode `bivouac_sleep`, transcodage photo matériel `ImageIO` (0 € serveur) et SQLite WAL.
public final class LkdvNativeTrackerEngine: NSObject, CLLocationManagerDelegate {
    public static let shared = LkdvNativeTrackerEngine()
    public static let intentDarwinNotification = "com.lekitduvoyageur.intent.command"

    private let db: TrackerDatabase?
    private let offlinePackManager = OfflinePackManager()
    private let locationManager = CLLocationManager()
    private let altimeter = CMAltimeter()
    private let pedometer = CMPedometer()
    private let motionActivity = CMMotionActivityManager()

    private var backgroundSession: Any? // CLBackgroundActivitySession on iOS 17+
    private var activeSession: TrackerDatabase.LocalSessionRow?
    private var altitudeEngine = AltitudeFusionEngine()

    private var bootEpochId: Int = 1
    private var maxHorizontalAccuracyM: Double = 30.0
    private var maxInstantSpeedMs: Double = 30.0
    private var autoPauseEnabled: Bool = true
    private var lockAutoPauseDisabled: Bool = false
    private var autoPauseSpeedThresholdMs: Double = 0.45
    private var lastLocation: CLLocation?
    private var lastMotionAutomotiveStart: Date?
    private var vehicleSuspectedNotified: Bool = false
    private var latestHrBpm: Int?
    private var latestPowerW: Int?
    private var latestCadenceRpm: Double?

    public var onSnapshotUpdate: (([String: Any]) -> Void)?

    private override init() {
        self.db = try? TrackerDatabase()
        super.init()
        locationManager.delegate = self
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
        registerDarwinIntentObserver()
    }

    public func bootRecover() -> TrackerDatabase.LocalSessionRow? {
        guard var recovered = db?.readRecoverableSession() else { return nil }
        bootEpochId += 1
        activeSession = recovered
        db?.appendEvent(
            sessionId: recovered.sessionId,
            type: "crash_recovered",
            lat: nil,
            lng: nil,
            payloadJson: "{\"bootEpoch\":\(bootEpochId)}"
        )
        if recovered.domainState == "recording" {
            startBackgroundLocationStream()
        }
        recovered.updatedUtcMs = Self.nowUtcMs()
        db?.upsertSession(recovered)
        return recovered
    }

    public func startSession(
        sessionId: String,
        userId: String,
        canonicalSlug: String,
        specVersion: String,
        distanceFilterM: Double,
        maxHorizontalAccuracyM: Double,
        baroHysteresisM: Double,
        autoPauseEnabled: Bool,
        lockAutoPauseDisabled: Bool,
        maxInstantSpeedKmh: Double
    ) -> [String: Any] {
        self.maxHorizontalAccuracyM = max(10, maxHorizontalAccuracyM)
        self.maxInstantSpeedMs = max(5, maxInstantSpeedKmh / 3.6)
        self.autoPauseEnabled = lockAutoPauseDisabled ? false : autoPauseEnabled
        self.lockAutoPauseDisabled = lockAutoPauseDisabled
        self.altitudeEngine = AltitudeFusionEngine(hysteresisM: baroHysteresisM)
        self.lastLocation = nil
        self.vehicleSuspectedNotified = false

        let nowMs = Self.nowUtcMs()
        let lease = UUID().uuidString
        let row = TrackerDatabase.LocalSessionRow(
            sessionId: sessionId,
            userId: userId,
            canonicalSlug: canonicalSlug,
            specVersion: specVersion,
            domainState: "recording",
            writerLeaseId: lease,
            startedUtcMs: nowMs,
            endedUtcMs: nil,
            activeMovingMs: 0,
            elapsedTotalMs: 0,
            distanceM: 0,
            elevGainM: 0,
            elevLossM: 0,
            baroAltRefM: nil,
            lastPointSeq: 0,
            updatedUtcMs: nowMs
        )
        activeSession = row
        db?.upsertSession(row)

        locationManager.distanceFilter = max(3, distanceFilterM)
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        startBackgroundLocationStream()
        startSensors()
        return snapshotDict()
    }

    public func pauseSession(manual: Bool = true) -> [String: Any] {
        guard var s = activeSession else { return [:] }
        s.domainState = manual ? "paused_manual" : "paused_auto"
        s.updatedUtcMs = Self.nowUtcMs()
        activeSession = s
        db?.upsertSession(s)
        db?.appendEvent(sessionId: s.sessionId, type: manual ? "pause_manual" : "pause_auto", lat: lastLocation?.coordinate.latitude, lng: lastLocation?.coordinate.longitude, payloadJson: "{}")
        return snapshotDict()
    }

    public func resumeSession() -> [String: Any] {
        guard var s = activeSession else { return [:] }
        s.domainState = "recording"
        s.updatedUtcMs = Self.nowUtcMs()
        activeSession = s
        db?.upsertSession(s)
        db?.appendEvent(sessionId: s.sessionId, type: "resume", lat: lastLocation?.coordinate.latitude, lng: lastLocation?.coordinate.longitude, payloadJson: "{}")
        startBackgroundLocationStream()
        return snapshotDict()
    }

    public func enterBivouacSleep() -> [String: Any] {
        guard var s = activeSession else { return [:] }
        s.domainState = "bivouac_sleep"
        s.updatedUtcMs = Self.nowUtcMs()
        activeSession = s
        db?.upsertSession(s)
        db?.appendEvent(sessionId: s.sessionId, type: "bivouac_sleep", lat: lastLocation?.coordinate.latitude, lng: lastLocation?.coordinate.longitude, payloadJson: "{}")
        stopSensors()
        locationManager.stopUpdatingLocation()
        return snapshotDict()
    }

    public func resumeFromBivouac() -> [String: Any] {
        guard var s = activeSession else { return [:] }
        s.domainState = "recording"
        s.updatedUtcMs = Self.nowUtcMs()
        activeSession = s
        db?.upsertSession(s)
        if let loc = lastLocation {
            let dem = offlinePackManager.queryOfflineDemElevationM(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
            altitudeEngine.recalibrateAfterBivouac(demAltitudeM: dem, gpsAltitudeM: loc.altitude)
        }
        db?.appendEvent(sessionId: s.sessionId, type: "bivouac_resume", lat: lastLocation?.coordinate.latitude, lng: lastLocation?.coordinate.longitude, payloadJson: "{}")
        startBackgroundLocationStream()
        startSensors()
        return snapshotDict()
    }

    public func calibrateAltitudeManual(_ altitudeM: Double) -> [String: Any] {
        altitudeEngine.calibrateManual(altitudeM: altitudeM)
        if var s = activeSession {
            s.baroAltRefM = altitudeEngine.altRefM
            s.updatedUtcMs = Self.nowUtcMs()
            activeSession = s
            db?.upsertSession(s)
        }
        return snapshotDict()
    }

    public func addWaypoint(kind: String, label: String) -> [String: Any] {
        guard let s = activeSession else { return [:] }
        let safeLabel = label.replacingOccurrences(of: "\"", with: "'")
        db?.appendEvent(
            sessionId: s.sessionId,
            type: "waypoint",
            lat: lastLocation?.coordinate.latitude,
            lng: lastLocation?.coordinate.longitude,
            payloadJson: "{\"kind\":\"\(kind)\",\"label\":\"\(safeLabel)\"}"
        )
        return snapshotDict()
    }

    /// Transcodage matériel on-device HEIC/UIImage -> JPEG 82 % (<= 2 048 px) + miniature 400 px
    /// stocké dans l'App Group (zéro base64 WebView, zéro coût serveur Cloudflare Images).
    public func saveTranscodedPhoto(imageData: Data) -> [String: Any]? {
        guard let s = activeSession,
              let src = CGImageSourceCreateWithData(imageData as CFData, nil) else { return nil }
        let mediaId = UUID().uuidString
        guard let groupUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TrackerDatabase.appGroupIdentifier) else {
            return nil
        }
        let dir = groupUrl.appendingPathComponent("media/\(s.sessionId)", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let fullUrl = dir.appendingPathComponent("\(mediaId).jpg")
        let thumbUrl = dir.appendingPathComponent("\(mediaId)_thumb.jpg")
        guard writeResizedJpeg(source: src, maxPixel: 2048, quality: 0.82, to: fullUrl),
              writeResizedJpeg(source: src, maxPixel: 400, quality: 0.72, to: thumbUrl) else {
            return nil
        }
        let size = (try? FileManager.default.attributesOfItem(atPath: fullUrl.path)[.size] as? Int) ?? 0
        return [
            "mediaId": mediaId,
            "localPath": fullUrl.path,
            "thumbPath": thumbUrl.path,
            "mimeType": "image/jpeg",
            "byteSize": size,
            "lat": lastLocation?.coordinate.latitude as Any,
            "lng": lastLocation?.coordinate.longitude as Any
        ]
    }

    public func ingestBleMetrics(hrBpm: Int?, powerW: Int?, cadenceRpm: Double?) {
        if let hrBpm { latestHrBpm = hrBpm }
        if let powerW { latestPowerW = powerW }
        if let cadenceRpm { latestCadenceRpm = cadenceRpm }
    }

    public func finishSession() -> [String: Any] {
        guard var s = activeSession else { return [:] }
        s.domainState = "finished_local"
        s.endedUtcMs = Self.nowUtcMs()
        s.updatedUtcMs = Self.nowUtcMs()
        activeSession = s
        db?.upsertSession(s)
        db?.checkpointTruncate()
        stopSensors()
        locationManager.stopUpdatingLocation()
        stopBackgroundSession()
        let out = snapshotDict()
        activeSession = nil
        return out
    }

    public func discardSession() {
        guard let s = activeSession else { return }
        stopSensors()
        locationManager.stopUpdatingLocation()
        stopBackgroundSession()
        db?.deleteSession(sessionId: s.sessionId)
        activeSession = nil
    }

    public func nearestOfflineRefuge() -> TrackerDatabase.OfflineRefugeRow? {
        guard let coord = lastLocation?.coordinate else { return nil }
        return db?.nearestRefuge(lat: coord.latitude, lng: coord.longitude)
    }

    public func snapshotDict() -> [String: Any] {
        guard let s = activeSession else { return ["active": false] }
        return [
            "active": true,
            "sessionId": s.sessionId,
            "canonicalSlug": s.canonicalSlug,
            "domainState": s.domainState,
            "writerLeaseId": s.writerLeaseId,
            "distanceM": s.distanceM,
            "elevGainM": s.elevGainM,
            "elevLossM": s.elevLossM,
            "altitudeM": altitudeEngine.currentAltitudeM as Any,
            "movingS": Double(s.activeMovingMs) / 1000.0,
            "lastPointSeq": s.lastPointSeq,
            "hrBpm": latestHrBpm as Any,
            "powerW": latestPowerW as Any,
            "cadenceRpm": latestCadenceRpm as Any,
            "lat": lastLocation?.coordinate.latitude as Any,
            "lng": lastLocation?.coordinate.longitude as Any,
            "horizAccM": lastLocation?.horizontalAccuracy as Any
        ]
    }

    // MARK: - CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard var s = activeSession, s.domainState == "recording" else { return }
        applyLowBatteryExpeditionGuardIfNeeded()

        for loc in locations {
            guard loc.horizontalAccuracy >= 0, loc.horizontalAccuracy <= maxHorizontalAccuracyM else { continue }
            var isOutlier = false
            var deltaDist = 0.0
            var dtMs: Int64 = 0

            if let prev = lastLocation {
                let dt = loc.timestamp.timeIntervalSince(prev.timestamp)
                if dt <= 0 { continue }
                deltaDist = loc.distance(from: prev)
                let speed = deltaDist / dt
                if dt < 5.0 && speed > maxInstantSpeedMs * 1.35 {
                    isOutlier = true
                }
                dtMs = Int64(dt * 1000.0)
            }

            let demAlt = offlinePackManager.queryOfflineDemElevationM(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
            altitudeEngine.ingestDemAndGpsFix(demAltM: demAlt, gpsAltM: loc.altitude, verticalAccM: loc.verticalAccuracy)

            let nextSeq = s.lastPointSeq + 1
            let moving = !isOutlier && (loc.speed < 0 || loc.speed >= autoPauseSpeedThresholdMs)
            if !isOutlier {
                s.distanceM += deltaDist
                s.elevGainM = altitudeEngine.elevGainM
                s.elevLossM = altitudeEngine.elevLossM
                if moving { s.activeMovingMs += dtMs }
                s.elapsedTotalMs = Self.nowUtcMs() - s.startedUtcMs
                lastLocation = loc
            }
            s.lastPointSeq = nextSeq
            s.updatedUtcMs = Self.nowUtcMs()

            db?.appendPoint(TrackerDatabase.TrackPointRow(
                sessionId: s.sessionId,
                seq: nextSeq,
                recordedUtcMs: Int64(loc.timestamp.timeIntervalSince1970 * 1000),
                monotonicUptimeMs: Int64(ProcessInfo.processInfo.systemUptime * 1000),
                bootEpochId: bootEpochId,
                lat: loc.coordinate.latitude,
                lng: loc.coordinate.longitude,
                altBaroM: altitudeEngine.currentAltitudeM,
                altGpsM: loc.altitude,
                altDemM: demAlt,
                horizAccM: loc.horizontalAccuracy,
                vertAccM: loc.verticalAccuracy,
                speedMs: loc.speed >= 0 ? loc.speed : nil,
                bearingDeg: loc.course >= 0 ? loc.course : nil,
                hrBpm: latestHrBpm,
                powerW: latestPowerW,
                cadenceRpm: latestCadenceRpm,
                isMoving: moving,
                isOutlier: isOutlier
            ))
            activeSession = s
            db?.upsertSession(s)
        }
        onSnapshotUpdate?(snapshotDict())
    }

    // MARK: - Private Helpers

    private func startBackgroundLocationStream() {
        if #available(iOS 17.0, *) {
            if backgroundSession == nil {
                backgroundSession = CLBackgroundActivitySession()
            }
        }
        locationManager.startUpdatingLocation()
    }

    private func stopBackgroundSession() {
        if #available(iOS 17.0, *) {
            (backgroundSession as? CLBackgroundActivitySession)?.invalidate()
        }
        backgroundSession = nil
    }

    private func startSensors() {
        if CMAltimeter.isRelativeAltitudeAvailable() {
            altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] data, _ in
                guard let self, let data else { return }
                self.altitudeEngine.ingestBarometerRelativeAltitude(data.relativeAltitude.doubleValue)
            }
        }
        if CMMotionActivityManager.isActivityAvailable() {
            motionActivity.startActivityUpdates(to: .main) { [weak self] activity in
                guard let self, let activity, let s = self.activeSession, s.domainState == "recording" else { return }
                if activity.automotive && activity.confidence == .high {
                    if self.lastMotionAutomotiveStart == nil { self.lastMotionAutomotiveStart = Date() }
                    if let start = self.lastMotionAutomotiveStart,
                       Date().timeIntervalSince(start) >= 20,
                       !self.vehicleSuspectedNotified,
                       (self.lastLocation?.speed ?? 0) > 8.9 {
                        self.vehicleSuspectedNotified = true
                        self.db?.appendEvent(
                            sessionId: s.sessionId,
                            type: "vehicle_suspected",
                            lat: self.lastLocation?.coordinate.latitude,
                            lng: self.lastLocation?.coordinate.longitude,
                            payloadJson: "{\"confidence\":\"high\"}"
                        )
                    }
                } else {
                    self.lastMotionAutomotiveStart = nil
                }
            }
        }
    }

    private func stopSensors() {
        altimeter.stopRelativeAltitudeUpdates()
        motionActivity.stopActivityUpdates()
        pedometer.stopUpdates()
    }

    private func applyLowBatteryExpeditionGuardIfNeeded() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel
        if level > 0 && level <= 0.15 {
            locationManager.distanceFilter = max(locationManager.distanceFilter, 18.0)
        }
    }

    private func writeResizedJpeg(source: CGImageSource, maxPixel: Int, quality: Double, to destinationUrl: URL) -> Bool {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              let dest = CGImageDestinationCreateWithURL(destinationUrl as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
            return false
        }
        CGImageDestinationAddImage(dest, cgImage, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(dest)
    }

    private func registerDarwinIntentObserver() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = UnsafeRawPointer(Unmanaged.passUnretained(self).toOpaque())
        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, _, _, _, _ in
                LkdvNativeTrackerEngine.shared.processPendingIntentCommands()
            },
            Self.intentDarwinNotification as CFString,
            nil,
            .deliverImmediately
        )
    }

    public func processPendingIntentCommands() {
        guard let commands = db?.consumePendingIntentCommands() else { return }
        for cmd in commands {
            switch cmd.intentKind {
            case "toggle_pause":
                if activeSession?.domainState == "recording" {
                    _ = pauseSession(manual: true)
                } else {
                    _ = resumeSession()
                }
            case "add_waypoint", "mark_lap_split", "mark_transition", "log_strength_set":
                _ = addWaypoint(kind: cmd.intentKind, label: cmd.intentKind)
            default:
                break
            }
        }
    }

    private static func nowUtcMs() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }
}
