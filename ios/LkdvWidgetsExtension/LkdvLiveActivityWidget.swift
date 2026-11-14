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
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LkdvLiveActivityAttributes.self) { context in
            LkdvLockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "figure.hiking")
                            .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
                        Text(context.attributes.sport.capitalized)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatDuration(seconds: context.state.movingS))
                        .font(.subheadline)
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Distance").font(.caption2).foregroundStyle(.secondary)
                            Text(String(format: "%.1f km", context.state.distanceM / 1000))
                                .font(.headline)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("D+").font(.caption2).foregroundStyle(.secondary)
                            Text("\(Int(context.state.elevGainM)) m")
                                .font(.headline)
                        }
                        if context.state.offRoute {
                            Spacer()
                            Text("Hors trace")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.hiking")
                    .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
            } compactTrailing: {
                Text(String(format: "%.1f km", context.state.distanceM / 1000))
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .monospacedDigit()
            } minimal: {
                Image(systemName: "figure.hiking")
                    .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
            }
        }
    }

    private func formatDuration(seconds: Double) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%02d:%02d:%02d", h, m, s) }
        return String(format: "%02d:%02d", m, s)
    }
}

struct LkdvLockScreenLiveActivityView: View {
    let context: ActivityViewContext<LkdvLiveActivityAttributes>

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "figure.hiking")
                .font(.system(size: 28))
                .foregroundStyle(Color(red: 34/255, green: 97/255, blue: 72/255))
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.sport.capitalized)
                    .font(.headline)
                    .foregroundStyle(Color(red: 23/255, green: 43/255, blue: 36/255))
                Text(context.state.paused ? "En pause" : "En cours")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f km", context.state.distanceM / 1000))
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(Color(red: 23/255, green: 64/255, blue: 44/255))
                Text("\(Int(context.state.elevGainM)) m D+")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Color(red: 251/255, green: 250/255, blue: 246/255).opacity(0.95))
    }
}
