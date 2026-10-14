import SwiftUI

/// A small status dot. Unverified is hollow; every other status is filled.
public struct StatusDot: View {
    private let status: TrustStatus
    @ScaledMetric private var size: CGFloat

    public init(_ status: TrustStatus, size: CGFloat = 10) {
        self.status = status
        _size = ScaledMetric(wrappedValue: size, relativeTo: .caption)
    }

    public var body: some View {
        Circle()
            .fill(status.isHollow ? Color.clear : status.color)
            .overlay(Circle().strokeBorder(status.color, lineWidth: max(1.5, size / 5)))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// Status pill: colored dot plus the status name. VoiceOver reads the status and the reason.
public struct VerificationBadge: View {
    private let status: TrustStatus
    private let reason: String?

    public init(_ status: TrustStatus, reason: String? = nil) {
        self.status = status
        self.reason = reason
    }

    public var body: some View {
        HStack(spacing: Spacing.xxs) {
            StatusDot(status, size: 8)
            Text(verbatim: status.label)
                .textCase(.uppercase)
                .font(.dsTag)
                .lineLimit(1)
        }
        .foregroundStyle(status.color)
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, 3)
        .background(status.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(status.color.opacity(0.45)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Status: \(status.label)"))
        .accessibilityValue(Text(reason ?? status.explanation))
    }
}

/// "Breaking" marker for developing stories.
public struct BreakingMarker: View {
    public init() {}

    public var body: some View {
        Text("BREAKING")
            .font(.dsTag)
            .foregroundStyle(Color.dsStatusDisputed)
            .accessibilityLabel(Text("Breaking news"))
    }
}

/// Compact status history: ○ › ● › ●. Shows the latest steps when the history is long.
public struct StatusTrail: View {
    private let steps: [TrustStatus]
    private let maxSteps: Int

    public init(_ steps: [TrustStatus], maxSteps: Int = 6) {
        self.steps = steps
        self.maxSteps = maxSteps
    }

    private var visible: [TrustStatus] { Array(steps.suffix(maxSteps)) }

    public var body: some View {
        HStack(spacing: 3) {
            if steps.count > maxSteps {
                Text("…").font(.dsCaption).foregroundStyle(Color.dsTextSecondary)
            }
            ForEach(Array(visible.enumerated()), id: \.offset) { index, status in
                if index > 0 {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 7, weight: .bold))
                        .foregroundStyle(Color.dsTextSecondary)
                }
                StatusDot(status, size: 8)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Status history"))
        .accessibilityValue(Text(steps.map(\.label).joined(separator: ", then ")))
    }
}

/// One row per status with its meaning. Used in onboarding and the status guide.
public struct StatusLegend: View {
    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            ForEach(TrustStatus.legendOrder) { status in
                StatusLegendRow(status: status)
            }
        }
    }
}

private struct StatusLegendRow: View {
    let status: TrustStatus

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
            StatusDot(status, size: 12)
            VStack(alignment: .leading, spacing: 2) {
                Text(status.label)
                    .font(.dsHeadline)
                    .foregroundStyle(status.color)
                Text(status.explanation)
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

public extension TrustStatus {
    /// From least to most trusted, then the warning states.
    static let legendOrder: [TrustStatus] = [.unverified, .reported, .corroborated, .confirmed, .disputed, .retracted]
}

#Preview("Badges") {
    VStack(alignment: .leading, spacing: Spacing.sm) {
        ForEach(TrustStatus.allCases) { status in
            HStack {
                VerificationBadge(status)
                StatusTrail([.unverified, .reported, status])
            }
        }
        BreakingMarker()
    }
    .padding()
}

#Preview("Legend, dark") {
    StatusLegend()
        .padding()
        .preferredColorScheme(.dark)
}
