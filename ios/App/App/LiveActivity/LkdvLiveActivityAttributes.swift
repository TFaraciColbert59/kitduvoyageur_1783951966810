import Foundation

#if canImport(ActivityKit)
import ActivityKit

/// Attributs partagés de la Live Activity « activité en cours » (Lot 03).
/// Charge utile sérialisée <= 640 octets (< 16 % du plafond Apple de 4 096 octets).
@available(iOS 16.2, *)
public struct LkdvLiveActivityAttributes: ActivityAttributes {
    public struct MetricSlot: Codable, Hashable {
        public var label: String
        public var value: String

        public init(label: String, value: String) {
            self.label = String(label.prefix(10))
            self.value = String(value.prefix(14))
        }
    }

    public struct ContentState: Codable, Hashable {
        public var distanceM: Double
        public var elevGainM: Double
        public var movingS: Double
        public var paused: Bool
        public var offRoute: Bool
        public var nextManeuverInstruction: String?
        public var nextManeuverDistanceM: Double?
        public var offRouteLabel: String?
        // Slots déclaratifs (Lot 03) + continuité > 8 h
        public var primarySlot: MetricSlot?
        public var secondarySlot: MetricSlot?
        public var expandedSlot3: MetricSlot?
        public var expandedSlot4: MetricSlot?
        public var rolloverGeneration: Int
        public var phaseLabel: String?

        public init(
            distanceM: Double,
            elevGainM: Double,
            movingS: Double,
            paused: Bool,
            offRoute: Bool,
            nextManeuverInstruction: String? = nil,
            nextManeuverDistanceM: Double? = nil,
            offRouteLabel: String? = nil,
            primarySlot: MetricSlot? = nil,
            secondarySlot: MetricSlot? = nil,
            expandedSlot3: MetricSlot? = nil,
            expandedSlot4: MetricSlot? = nil,
            rolloverGeneration: Int = 1,
            phaseLabel: String? = nil
        ) {
            self.distanceM = distanceM
            self.elevGainM = elevGainM
            self.movingS = movingS
            self.paused = paused
            self.offRoute = offRoute
            self.nextManeuverInstruction = nextManeuverInstruction.map { String($0.prefix(48)) }
            self.nextManeuverDistanceM = nextManeuverDistanceM
            self.offRouteLabel = offRouteLabel.map { String($0.prefix(24)) }
            self.primarySlot = primarySlot
            self.secondarySlot = secondarySlot
            self.expandedSlot3 = expandedSlot3
            self.expandedSlot4 = expandedSlot4
            self.rolloverGeneration = rolloverGeneration
            self.phaseLabel = phaseLabel.map { String($0.prefix(32)) }
        }
    }

    public var sport: String
    public var startedAt: Date
    public var sessionId: String
    public var sfSymbol: String
    public var intentLeft: String
    public var intentRight: String

    public init(
        sport: String,
        startedAt: Date,
        sessionId: String = "",
        sfSymbol: String = "figure.hiking",
        intentLeft: String = "toggle_pause",
        intentRight: String = "add_waypoint"
    ) {
        self.sport = String(sport.prefix(16))
        self.startedAt = startedAt
        self.sessionId = sessionId
        self.sfSymbol = sfSymbol
        self.intentLeft = intentLeft
        self.intentRight = intentRight
    }
}
#endif
