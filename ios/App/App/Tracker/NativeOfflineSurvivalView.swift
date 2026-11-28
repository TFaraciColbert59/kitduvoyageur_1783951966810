import SwiftUI

/// Vue SwiftUI native de survie hors-ligne (Correctif Pre-Mortem B1).
/// S'affiche automatiquement si WKWebView échoue à charger `CAPACITOR_SERVER_URL`
/// en zone blanche 48 h+ après un kill Jetsam : permet de contrôler la sortie en cours
/// et d'ouvrir la Fiche Secours SOS 112 / SMS 114 / WGS84-UTM / Refuge proche 100 % offline.
public struct NativeOfflineSurvivalView: View {
    @State private var snapshot: [String: Any] = LkdvNativeTrackerEngine.shared.snapshotDict()
    @State private var showSosPanel: Bool = false

    public var onRetryWebView: (() -> Void)?

    public init(onRetryWebView: (() -> Void)? = nil) {
        self.onRetryWebView = onRetryWebView
    }

    public var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                HStack {
                    Label("Mode Survie Hors-Ligne", systemImage: "wifi.slash")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(red: 118/255, green: 80/255, blue: 20/255))
                    Spacer()
                    if let onRetryWebView {
                        Button("Réessayer") { onRetryWebView() }
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .padding(.horizontal)

                if (snapshot["active"] as? Bool) == true {
                    VStack(spacing: 14) {
                        Text((snapshot["canonicalSlug"] as? String ?? "Sortie").uppercased())
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                        HStack(spacing: 24) {
                            metricTile(
                                title: "Distance",
                                value: String(format: "%.2f km", (snapshot["distanceM"] as? Double ?? 0) / 1000.0)
                            )
                            metricTile(
                                title: "D+",
                                value: "+\(Int(snapshot["elevGainM"] as? Double ?? 0)) m"
                            )
                            metricTile(
                                title: "Altitude",
                                value: "\(Int(snapshot["altitudeM"] as? Double ?? 0)) m"
                            )
                        }
                        HStack(spacing: 12) {
                            let isPaused = (snapshot["domainState"] as? String) != "recording"
                            Button(isPaused ? "Reprendre" : "Pause") {
                                snapshot = isPaused
                                    ? LkdvNativeTrackerEngine.shared.resumeSession()
                                    : LkdvNativeTrackerEngine.shared.pauseSession(manual: true)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 34/255, green: 97/255, blue: 72/255))
                            .frame(minHeight: 54)

                            Button("Repère") {
                                snapshot = LkdvNativeTrackerEngine.shared.addWaypoint(kind: "note", label: "Repère offline")
                            }
                            .buttonStyle(.bordered)
                            .frame(minHeight: 54)
                        }
                    }
                    .padding()
                    .background(Color(red: 251/255, green: 250/255, blue: 246/255))
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .padding(.horizontal)
                }

                Button {
                    showSosPanel.toggle()
                } label: {
                    Label("Fiche Secours SOS · 112 / 114 / WGS84", systemImage: "sos.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 168/255, green: 68/255, blue: 58/255))
                .padding(.horizontal)

                if showSosPanel {
                    sosCard
                }
                Spacer()
            }
            .padding(.top, 20)
        }
    }

    private var sosCard: some View {
        let lat = snapshot["lat"] as? Double
        let lng = snapshot["lng"] as? Double
        let alt = snapshot["altitudeM"] as? Double
        let refuge = LkdvNativeTrackerEngine.shared.nearestOfflineRefuge()
        let coordText = (lat != nil && lng != nil)
            ? String(format: "%.5f° N, %.5f° E", lat!, lng!)
            : "Position GPS en acquisition..."
        let smsBody = "URGENCE LKDV · \(coordText) · Alt \(Int(alt ?? 0))m"

        return VStack(alignment: .leading, spacing: 10) {
            Text(coordText)
                .font(.system(size: 24, weight: .bold, design: .monospaced))
            Text("Altitude : \(Int(alt ?? 0)) m")
                .font(.subheadline.monospacedDigit())
            if let refuge {
                Text("Refuge proche : \(refuge.name) (\(Int(refuge.altM ?? 0)) m)")
                    .font(.subheadline)
            }
            HStack(spacing: 12) {
                if let telUrl = URL(string: "tel://112") {
                    Link("Appeler 112", destination: telUrl)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color(red: 168/255, green: 68/255, blue: 58/255))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                if let encoded = smsBody.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                   let smsUrl = URL(string: "sms:114&body=\(encoded)") {
                    Link("SMS 114", destination: smsUrl)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color(red: 23/255, green: 64/255, blue: 44/255))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .padding(.horizontal)
    }

    private func metricTile(title: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3.weight(.bold)).monospacedDigit()
        }
    }
}
