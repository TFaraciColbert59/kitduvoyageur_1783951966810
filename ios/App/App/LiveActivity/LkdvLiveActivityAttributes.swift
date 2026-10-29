import Foundation

#if canImport(ActivityKit)
import ActivityKit

/// Attributs partagés de la Live Activity « activité en cours ».
///
/// Les données d'état sont **celles du suivi** (distance, D+, temps, hors-trace) :
/// la Live Activity ne calcule rien, elle affiche ce que le WebView lui envoie.
@available(iOS 16.2, *)
public struct LkdvLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var distanceM: Double
        public var elevGainM: Double
        public var movingS: Double
        public var paused: Bool
        public var offRoute: Bool

        public init(
            distanceM: Double,
            elevGainM: Double,
            movingS: Double,
            paused: Bool,
            offRoute: Bool
        ) {
            self.distanceM = distanceM
            self.elevGainM = elevGainM
            self.movingS = movingS
            self.paused = paused
            self.offRoute = offRoute
        }
    }

    public var sport: String
    public var startedAt: Date

    public init(sport: String, startedAt: Date) {
        self.sport = sport
        self.startedAt = startedAt
    }
}
#endif
