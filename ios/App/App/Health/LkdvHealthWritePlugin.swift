import Foundation
import Capacitor
import HealthKit
import CoreLocation

/// Plugin Swift maison complétant `@capgo/capacitor-health` (lecture seule) pour
/// écrire `HKWorkout` + `HKWorkoutRoute` dans Apple Santé (Lot 04).
/// - Lit directement les points depuis SQLite App Group (0 sérialisation JSON de 30k pts).
/// - Envoie les `CLLocation` par chunks de 50 (prévention pic RAM).
/// - Exclut strictement `stepCount` (zéro double comptage avec le coprocesseur M-series).
/// - Idempotence garantie via `HKMetadataKeyExternalUUID = sessionId`.
@objc(LkdvHealthWritePlugin)
public final class LkdvHealthWritePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LkdvHealthWritePlugin"
    public let jsName = "LkdvHealthWrite"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestWriteAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveCompletedWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteExportedWorkout", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    @objc func requestWriteAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["authorized": false, "reason": "healthkit_unavailable"])
            return
        }
        var shareTypes: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute(),
        ]
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { shareTypes.insert(energy) }
        if let walkRun = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { shareTypes.insert(walkRun) }
        if let cycling = HKObjectType.quantityType(forIdentifier: .distanceCycling) { shareTypes.insert(cycling) }
        if let swim = HKObjectType.quantityType(forIdentifier: .distanceSwimming) { shareTypes.insert(swim) }
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { shareTypes.insert(hr) }

        healthStore.requestAuthorization(toShare: shareTypes, read: nil) { success, error in
            call.resolve([
                "authorized": success,
                "reason": error?.localizedDescription as Any
            ])
        }
    }

    @objc func saveCompletedWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["saved": false, "reason": "healthkit_unavailable"])
            return
        }
        guard let sessionId = call.getString("sessionId") else {
            call.reject("sessionId requis")
            return
        }
        let hkTypeKey = call.getString("healthKitActivityType") ?? "hiking"
        let isIndoor = call.getBool("indoor") ?? false
        let startMs = call.getDouble("startedAtMs") ?? (Date().timeIntervalSince1970 * 1000)
        let endMs = call.getDouble("endedAtMs") ?? (Date().timeIntervalSince1970 * 1000)
        let distanceM = max(0, call.getDouble("distanceM") ?? 0)
        let elevGainM = max(0, call.getDouble("elevGainM") ?? 0)
        let activeEnergyKcal = max(0, call.getDouble("activeEnergyKcal") ?? 0)
        let swolf = call.getDouble("swolfScore")
        let lapLengthM = call.getDouble("lapLengthM")

        let startDate = Date(timeIntervalSince1970: startMs / 1000.0)
        let endDate = max(startDate.addingTimeInterval(1), Date(timeIntervalSince1970: endMs / 1000.0))

        let config = HKWorkoutConfiguration()
        config.activityType = Self.mapActivityType(hkTypeKey)
        config.locationType = isIndoor ? .indoor : .outdoor

        let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: config, device: .local())
        let routeBuilder = HKWorkoutRouteBuilder(healthStore: healthStore, device: .local())

        Task {
            do {
                try await builder.beginCollection(at: startDate)

                var samples: [HKSample] = []
                if activeEnergyKcal > 0,
                   let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                    samples.append(HKQuantitySample(
                        type: energyType,
                        quantity: HKQuantity(unit: .kilocalorie(), doubleValue: activeEnergyKcal),
                        start: startDate,
                        end: endDate
                    ))
                }
                if distanceM > 0, let distType = Self.distanceQuantityType(for: config.activityType) {
                    samples.append(HKQuantitySample(
                        type: distType,
                        quantity: HKQuantity(unit: .meter(), doubleValue: distanceM),
                        start: startDate,
                        end: endDate
                    ))
                }
                if !samples.isEmpty {
                    try await builder.addSamples(samples)
                }

                var metadata: [String: Any] = [
                    HKMetadataKeyExternalUUID: sessionId,
                    HKMetadataKeyIndoorWorkout: isIndoor
                ]
                if elevGainM > 0 {
                    metadata[HKMetadataKeyElevationAscended] = HKQuantity(unit: .meter(), doubleValue: elevGainM)
                }
                if #available(iOS 16.0, *), let swolf, swolf > 0 {
                    metadata[HKMetadataKeySWOLFScore] = swolf
                }
                if let lapLengthM, lapLengthM > 0 {
                    metadata[HKMetadataKeyLapLength] = HKQuantity(unit: .meter(), doubleValue: lapLengthM)
                }
                try await builder.addMetadata(metadata)
                try await builder.endCollection(at: endDate)

                guard let workout = try await builder.finishWorkout() else {
                    call.resolve(["saved": false, "reason": "finish_returned_nil"])
                    return
                }

                if !isIndoor, let db = try? TrackerDatabase() {
                    let rows = db.readTrackPoints(sessionId: sessionId, includeOutliers: false)
                    let chunkSize = 50
                    var idx = 0
                    while idx < rows.count {
                        let slice = rows[idx..<min(idx + chunkSize, rows.count)]
                        let locs = slice.map { pt in
                            CLLocation(
                                coordinate: CLLocationCoordinate2D(latitude: pt.lat, longitude: pt.lng),
                                altitude: pt.altBaroM ?? pt.altGpsM ?? 0,
                                horizontalAccuracy: pt.horizAccM,
                                verticalAccuracy: pt.vertAccM ?? 5.0,
                                course: pt.bearingDeg ?? -1,
                                speed: pt.speedMs ?? -1,
                                timestamp: Date(timeIntervalSince1970: Double(pt.recordedUtcMs) / 1000.0)
                            )
                        }
                        try await routeBuilder.insertRouteData(locs)
                        idx += chunkSize
                    }
                    if !rows.isEmpty {
                        _ = try await routeBuilder.finishRoute(with: workout, metadata: nil)
                    }
                }

                call.resolve([
                    "saved": true,
                    "hkWorkoutUuid": workout.uuid.uuidString
                ])
            } catch {
                call.resolve(["saved": false, "reason": error.localizedDescription])
            }
        }
    }

    @objc func deleteExportedWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let uuidStr = call.getString("hkWorkoutUuid"),
              let uuid = UUID(uuidString: uuidStr) else {
            call.resolve(["deleted": false])
            return
        }
        let predicate = HKQuery.predicateForObject(with: uuid)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 1, sortDescriptors: nil) { [weak self] _, results, _ in
            guard let self, let sample = results?.first else {
                call.resolve(["deleted": false])
                return
            }
            self.healthStore.delete(sample) { success, _ in
                call.resolve(["deleted": success])
            }
        }
        healthStore.execute(query)
    }

    private static func mapActivityType(_ key: String) -> HKWorkoutActivityType {
        switch key {
        case "running": return .running
        case "walking": return .walking
        case "hiking": return .hiking
        case "cycling": return .cycling
        case "climbing": return .climbing
        case "crossCountrySkiing": return .crossCountrySkiing
        case "downhillSkiing": return .downhillSkiing
        case "snowboarding": return .snowboarding
        case "swimming": return .swimming
        case "rowing": return .rowing
        case "paddleSports": return .paddleSports
        case "sailing": return .sailing
        case "surfingSports": return .surfingSports
        case "traditionalStrengthTraining": return .traditionalStrengthTraining
        case "functionalStrengthTraining": return .functionalStrengthTraining
        case "highIntensityIntervalTraining": return .highIntensityIntervalTraining
        case "yoga": return .yoga
        case "pilates": return .pilates
        default: return .other
        }
    }

    private static func distanceQuantityType(for type: HKWorkoutActivityType) -> HKQuantityType? {
        switch type {
        case .cycling: return HKQuantityType.quantityType(forIdentifier: .distanceCycling)
        case .swimming: return HKQuantityType.quantityType(forIdentifier: .distanceSwimming)
        case .downhillSkiing, .snowboarding: return HKQuantityType.quantityType(forIdentifier: .distanceDownhillSnowSports)
        default: return HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)
        }
    }
}
