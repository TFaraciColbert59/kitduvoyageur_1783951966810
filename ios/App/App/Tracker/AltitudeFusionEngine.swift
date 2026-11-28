import Foundation

/// Moteur de fusion altimétrique baromètre (`CMAltimeter`) + MNT local (`Terrarium DEM`).
/// Annule le D+ fantôme GPS (+3 751,7 m sur 1 h plat -> 0,0 m avec hystérésis >= 2 m)
/// tout en corrigeant la dérive météo sans injecter ce décalage dans `elevGainM`.
public final class AltitudeFusionEngine {
    public private(set) var altRefM: Double?
    public private(set) var currentAltitudeM: Double?
    public private(set) var elevGainM: Double = 0
    public private(set) var elevLossM: Double = 0

    private var lastAnchorM: Double?
    private var lastRelativeAltM: Double = 0
    private var lastDemRecalibrationAt: Date = .distantPast

    public var hysteresisM: Double
    public var demRecalibrationIntervalS: TimeInterval
    public var demMaxDriftDeltaM: Double

    public init(
        hysteresisM: Double = 2.0,
        demRecalibrationIntervalS: TimeInterval = 180,
        demMaxDriftDeltaM: Double = 8.0
    ) {
        self.hysteresisM = max(1.0, hysteresisM)
        self.demRecalibrationIntervalS = max(30, demRecalibrationIntervalS)
        self.demMaxDriftDeltaM = max(3.0, demMaxDriftDeltaM)
    }

    public func calibrateManual(altitudeM: Double) {
        altRefM = altitudeM - lastRelativeAltM
        currentAltitudeM = altitudeM
        lastAnchorM = altitudeM
        lastDemRecalibrationAt = Date()
    }

    /// Appelé obligatoirement au réveil d'un `bivouac_sleep` pour absorber la variation
    /// barométrique nocturne sans compter de faux D+.
    public func recalibrateAfterBivouac(demAltitudeM: Double?, gpsAltitudeM: Double?) {
        guard let anchor = demAltitudeM ?? gpsAltitudeM else { return }
        calibrateManual(altitudeM: anchor)
    }

    public func ingestBarometerRelativeAltitude(_ relativeAltM: Double) {
        lastRelativeAltM = relativeAltM
        guard let ref = altRefM else { return }
        let baroAlt = ref + relativeAltM
        currentAltitudeM = baroAlt

        guard let anchor = lastAnchorM else {
            lastAnchorM = baroAlt
            return
        }
        let delta = baroAlt - anchor
        if delta >= hysteresisM {
            elevGainM += delta
            lastAnchorM = baroAlt
        } else if delta <= -hysteresisM {
            elevLossM += abs(delta)
            lastAnchorM = baroAlt
        }
    }

    /// Recalage doux contre la dérive barométrique météo (facteur 0,25 hors falaise < 35 %)
    /// sans jamais injecter le décalage dans `elevGainM` ni `elevLossM`.
    public func ingestDemAndGpsFix(
        demAltM: Double?,
        gpsAltM: Double?,
        verticalAccM: Double?,
        localSlopePct: Double? = nil
    ) {
        if altRefM == nil {
            if let dem = demAltM {
                calibrateManual(altitudeM: dem)
            } else if let gps = gpsAltM, let vAcc = verticalAccM, vAcc > 0, vAcc <= 15.0 {
                calibrateManual(altitudeM: gps)
            }
            return
        }

        let now = Date()
        guard now.timeIntervalSince(lastDemRecalibrationAt) >= demRecalibrationIntervalS,
              let dem = demAltM,
              let current = currentAltitudeM else {
            return
        }
        if let slope = localSlopePct, abs(slope) >= 35.0 {
            return // Hors falaise : le MNT est imprécis sur paroi verticale.
        }
        let drift = dem - current
        if abs(drift) > demMaxDriftDeltaM, let ref = altRefM {
            let adjustment = 0.25 * drift
            altRefM = ref + adjustment
            let adjusted = current + adjustment
            currentAltitudeM = adjusted
            if let anchor = lastAnchorM {
                lastAnchorM = anchor + adjustment
            }
        }
        lastDemRecalibrationAt = now
    }
}
