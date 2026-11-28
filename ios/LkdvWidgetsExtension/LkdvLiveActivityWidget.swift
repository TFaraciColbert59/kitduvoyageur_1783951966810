import ActivityKit
import WidgetKit
import SwiftUI

@main
struct LkdvWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LkdvLiveActivityWidget()
    }
}

struct LkdvLiveActivityWidget: Widget {
    private let forestAction = Color(red: 34/255, green: 97/255, blue: 72/255)
    private let forestPrimary = Color(red: 23/255, green: 64/255, blue: 44/255)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LkdvLiveActivityAttributes.self) { context in
            LkdvLockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: context.attributes.sfSymbol)
                            .foregroundStyle(forestAction)
                        Text(context.attributes.sport)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatDuration(seconds: context.state.movingS))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        if let phase = context.state.phaseLabel, !phase.isEmpty {
                            Text(phase)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(forestAction)
                        }
                        if let instruction = context.state.nextManeuverInstruction, !instruction.isEmpty {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.turn.up.right")
                                    .font(.caption)
                                    .foregroundStyle(forestAction)
                                Text(instruction).font(.caption.weight(.semibold)).lineLimit(1)
                                Spacer()
                                if let dist = context.state.nextManeuverDistanceM {
                                    Text(formatManeuverDistance(meters: dist))
                                        .font(.caption).monospacedDigit().foregroundStyle(.secondary)
                                }
                            }
                        }
                        HStack {
                            slotView(
                                label: context.state.primarySlot?.label ?? "Distance",
                                value: context.state.primarySlot?.value ?? String(format: "%.1f km", context.state.distanceM / 1000)
                            )
                            Spacer()
                            slotView(
                                label: context.state.secondarySlot?.label ?? "D+",
                                value: context.state.secondarySlot?.value ?? "+\(Int(context.state.elevGainM)) m"
                            )
                            if let slot3 = context.state.expandedSlot3 {
                                Spacer()
                                slotView(label: slot3.label, value: slot3.value)
                            }
                        }
                        if #available(iOS 17.0, *) {
                            // Jamais de bouton "Arrêter" sur le Lock Screen / Dynamic Island (sécurité poche).
                            HStack(spacing: 10) {
                                Button(intent: TogglePauseActivityIntent(sessionId: context.attributes.sessionId)) {
                                    Label(context.state.paused ? "Reprendre" : "Pause", systemImage: context.state.paused ? "play.fill" : "pause.fill")
                                        .font(.caption.weight(.semibold))
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(forestAction)

                                Button(intent: AddWaypointActivityIntent(sessionId: context.attributes.sessionId)) {
                                    Label("Repère", systemImage: "mappin.and.ellipse")
                                        .font(.caption.weight(.semibold))
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.offRoute ? "exclamationmark.triangle.fill" : context.attributes.sfSymbol)
                    .foregroundStyle(context.state.offRoute ? Color.orange : forestAction)
            } compactTrailing: {
                Text(context.state.primarySlot?.value ?? String(format: "%.1f km", context.state.distanceM / 1000))
                    .font(.caption2.weight(.semibold))
                    .monospacedDigit()
            } minimal: {
                Image(systemName: context.attributes.sfSymbol)
                    .foregroundStyle(forestAction)
            }
        }
    }

    private func slotView(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.headline.weight(.bold)).monospacedDigit().foregroundStyle(forestPrimary)
        }
    }

    private func formatManeuverDistance(meters: Double) -> String {
        meters >= 1000 ? String(format: "%.1f km", meters / 1000) : "\(Int(max(0, meters.rounded()))) m"
    }

    private func formatDuration(seconds: Double) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return h > 0 ? String(format: "%02d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }
}

struct LkdvLockScreenLiveActivityView: View {
    let context: ActivityViewContext<LkdvLiveActivityAttributes>

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 14) {
                Image(systemName: context.attributes.sfSymbol)
                    .font(.system(size: 26))
                    .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.attributes.sport)
                        .font(.headline)
                        .foregroundStyle(Color(red: 23/255, green: 43/255, blue: 36/255))
                    Text(context.state.phaseLabel ?? (context.state.paused ? "En pause" : "En cours"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(context.state.primarySlot?.value ?? String(format: "%.1f km", context.state.distanceM / 1000))
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(Color(red: 23/255, green: 64/255, blue: 44/255))
                    Text(context.state.secondarySlot?.value ?? "+\(Int(context.state.elevGainM)) m D+")
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            if #available(iOS 17.0, *) {
                HStack(spacing: 10) {
                    Button(intent: TogglePauseActivityIntent(sessionId: context.attributes.sessionId)) {
                        Label(context.state.paused ? "Reprendre" : "Pause", systemImage: context.state.paused ? "play.fill" : "pause.fill")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 34/255, green: 97/255, blue: 72/255))

                    Button(intent: AddWaypointActivityIntent(sessionId: context.attributes.sessionId)) {
                        Label("Repère", systemImage: "mappin.and.ellipse")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(Color(red: 251/255, green: 250/255, blue: 246/255).opacity(0.96))
    }
}
