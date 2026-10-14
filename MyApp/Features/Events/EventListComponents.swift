import DesignSystem
import SwiftUI

/// One story in the list: status, breaking marker, history trail, headline and source counts.
struct EventRow: View {
    let event: NewsEvent

    private var status: TrustStatus { event.verification.status.trust }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            RoundedRectangle(cornerRadius: 2)
                .fill(status.color)
                .frame(width: 4)
                .frame(maxHeight: .infinity)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                AdaptiveStack {
                    VerificationBadge(status, reason: event.verification.reason)
                    if event.breaking {
                        BreakingMarker()
                    }
                    if event.statusHistory.count > 1 {
                        StatusTrail(event.statusHistory.map(\.status.trust))
                    }
                }
                Text(event.title)
                    .font(.dsStoryTitle)
                    .foregroundStyle(Color.dsTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(verbatim: event.tallySummary)
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
                Text("Updated \(event.lastUpdatedAt, format: .relative(presentation: .named))")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
        }
        .padding(.vertical, Spacing.xxs)
        .accessibilityElement(children: .combine)
    }
}

/// Horizontal status filter with counts. "All" plus every status that has stories.
struct StatusFilterBar: View {
    @Environment(EventsStore.self) private var store
    @Binding var selection: VerificationStatus?

    private var statuses: [VerificationStatus] {
        EventsStore.displayOrder.filter { (store.statusCounts[$0] ?? 0) > 0 || selection == $0 }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                FilterChip(title: String(localized: "All"), count: store.events.count, status: nil, isSelected: selection == nil) {
                    selection = nil
                }
                ForEach(statuses, id: \.self) { status in
                    FilterChip(
                        title: status.trust.label,
                        count: store.statusCounts[status] ?? 0,
                        status: status.trust,
                        isSelected: selection == status
                    ) {
                        selection = selection == status ? nil : status
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.xs)
        }
        .background(.bar)
        .accessibilityIdentifier("events.filter")
    }
}

private struct FilterChip: View {
    let title: String
    let count: Int
    let status: TrustStatus?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.xxs) {
                if let status {
                    StatusDot(status)
                }
                Text(verbatim: title)
                    .font(.subheadline)
                Text("\(count)")
                    .font(.dsMono)
                    .foregroundStyle(Color.dsTextSecondary)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 6)
            .background(Capsule().fill(isSelected ? Color.dsTextPrimary.opacity(0.08) : Color.dsSecondaryBackground))
            .overlay(Capsule().strokeBorder(isSelected ? Color.dsTextPrimary : Color.dsSeparator, lineWidth: isSelected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("\(title), \(count) stories"))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview("Rows") {
    List(MockEventsRepository.sample) { event in
        EventRow(event: event)
    }
}
