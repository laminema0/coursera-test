import DesignSystem
import SwiftUI

/// Everything known about one story: status, counts, numbers, statements, history and sources.
struct EventDetailView: View {
    let event: NewsEvent
    /// Present inside the News tab; previews can leave it out.
    @Environment(EventsStore.self) private var store: EventsStore?
    @Environment(\.openURL) private var openURL
    @State private var browserLink: BrowserLink?

    /// The newest version from the store, so the screen updates after a refresh.
    private var shown: NewsEvent { store?.event(id: event.id) ?? event }

    var body: some View {
        ScrollView {
            EventDetailContent(event: shown, open: open)
                .padding(Spacing.md)
        }
        .background(Color.dsBackground)
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store?.refresh() }
        .task { await store?.autoRefresh(every: .seconds(60)) }
        .sheet(item: $browserLink) { link in
            SafariView(url: link.url)
                .ignoresSafeArea()
        }
        .accessibilityIdentifier("event.detail")
    }

    private func open(_ url: URL) {
        if url.isWebURL {
            browserLink = BrowserLink(url: url)
        } else {
            openURL(url)
        }
    }
}

private struct EventDetailContent: View {
    let event: NewsEvent
    let open: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            EventHeader(event: event)
            TallyGrid(verification: event.verification)
            if !event.numbers.isEmpty || !event.chatterOnly.isEmpty {
                EventNumbersSection(event: event)
            }
            if !event.statements.isEmpty {
                StatementsSection(statements: event.statements)
            }
            if !event.statusHistory.isEmpty {
                StatusHistorySection(history: event.statusHistory)
            }
            EventSourcesSection(event: event, open: open)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct EventHeader: View {
    let event: NewsEvent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            AdaptiveStack {
                VerificationBadge(event.verification.status.trust, reason: event.verification.reason)
                if event.breaking {
                    BreakingMarker()
                }
            }
            Text(event.title)
                .font(.dsStoryTitleLarge)
                .accessibilityAddTraits(.isHeader)
            Text(event.verification.reason)
                .font(.dsBody)
            if let first = event.firstReport {
                Text("First reported by \(first.sourceName) at \(first.at, format: .dateTime.hour().minute())")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
            if let coverage = event.coverage {
                Text("Covered by \(coverage.outlets) outlets in \(coverage.countries) countries. Wide coverage is not confirmation.")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Independent / official / disputing / social, as plain counts (never a percentage).
private struct TallyGrid: View {
    let verification: Verification

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Grid(horizontalSpacing: 1, verticalSpacing: 1) {
                GridRow {
                    TallyCell(value: verification.confirming, label: "independent sources")
                    TallyCell(value: verification.primary, label: "official", tint: .dsStatusConfirmed)
                }
                GridRow {
                    TallyCell(value: verification.disputing, label: "disputing", tint: .dsStatusDisputed)
                    TallyCell(value: verification.signals, label: "social (not counted)", tint: .dsChatter)
                }
            }
            .background(Color.dsSeparator)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).strokeBorder(Color.dsSeparator))
            if verification.stateMediaOwnCountry > 0 {
                Text("\(verification.stateMediaOwnCountry) state-funded outlets reporting on their own country are shown but not counted.")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
        }
    }
}

private struct TallyCell: View {
    let value: Int
    let label: LocalizedStringKey
    var tint: Color = .dsTextPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.dsFigureSmall)
                .foregroundStyle(value > 0 ? tint : Color.dsTextSecondary)
            Text(label)
                .font(.dsCaption)
                .foregroundStyle(Color.dsTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(Color.dsBackground)
        .accessibilityElement(children: .combine)
    }
}

private struct StatementsSection: View {
    let statements: [StatementSummary]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionEyebrow("Who said what")
            ForEach(statements, id: \.self) { statement in
                StatementRow(statement: statement)
            }
        }
    }
}

private struct StatementRow: View {
    let statement: StatementSummary

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text(statement.speaker)
                .font(.dsHeadline)
            AdaptiveStack {
                if statement.asserts > 0 {
                    TagLabel("Said · ^[\(statement.asserts) source](inflect: true)")
                }
                if statement.denies > 0 {
                    TagLabel("Denied · ^[\(statement.denies) source](inflect: true)", style: .warning)
                }
                if statement.confirms > 0 {
                    TagLabel("Confirmed · ^[\(statement.confirms) source](inflect: true)", style: .official)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Status changes over time, oldest first, as a vertical timeline.
private struct StatusHistorySection: View {
    let history: [StatusChange]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionEyebrow("Status over time")
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(history.enumerated()), id: \.offset) { index, change in
                    StatusHistoryRow(change: change, isLast: index == history.count - 1)
                }
            }
        }
    }
}

private struct StatusHistoryRow: View {
    let change: StatusChange
    let isLast: Bool
    @ScaledMetric(relativeTo: .footnote) private var timeWidth: CGFloat = 52

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            VStack(spacing: 0) {
                StatusDot(change.status.trust, size: 12)
                    .padding(.top, 3)
                Rectangle()
                    .fill(isLast ? Color.clear : Color.dsSeparator)
                    .frame(width: 2)
                    .frame(maxHeight: .infinity)
            }
            Text(change.at, format: .dateTime.hour().minute())
                .font(.dsMono)
                .foregroundStyle(Color.dsTextSecondary)
                .frame(minWidth: timeWidth, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: change.status.trust.label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(change.status.trust.color)
                if change.confirming > 0 {
                    Text("\(change.confirming) independent")
                        .font(.dsCaption)
                        .foregroundStyle(Color.dsTextSecondary)
                }
            }
            .padding(.bottom, isLast ? 0 : Spacing.md)
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview("Detail") {
    NavigationStack {
        EventDetailView(event: MockEventsRepository.sample[0])
    }
}

#Preview("Detail – disputed, dark") {
    NavigationStack {
        EventDetailView(event: MockEventsRepository.sample[2])
    }
    .preferredColorScheme(.dark)
}

#Preview("Detail – large text") {
    NavigationStack {
        EventDetailView(event: MockEventsRepository.sample[1])
    }
    .dynamicTypeSize(.accessibility3)
}
