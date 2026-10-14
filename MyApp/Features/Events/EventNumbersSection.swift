import DesignSystem
import SwiftUI

/// Number claims: most reported (big), range, latest official, timeline; social chatter kept apart.
struct EventNumbersSection: View {
    let event: NewsEvent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionEyebrow("Numbers")
            ForEach(event.orderedNumbers, id: \.kind) { number in
                NumberCard(number: number, event: event)
            }
            ForEach(event.chatterOnly, id: \.kind) { chatter in
                ChatterOnlyCard(chatter: chatter)
            }
        }
    }
}

private struct NumberCard: View {
    let number: NumberSummary
    let event: NewsEvent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(verbatim: number.kind.label)
                .font(.dsHeadline)
            MostReportedFigure(value: number.mostReported)
            NumberFacts(number: number)
            if !number.uniqueTimeline.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    ForEach(number.uniqueTimeline, id: \.self) { report in
                        TimelineRow(report: report, sourceName: event.sourceName(for: report.sourceId))
                    }
                }
            }
            if !number.chatter.isEmpty {
                ChatterBox(text: String(localized: "On social media: \(number.chatter.chatterText()). Not counted."))
            }
        }
        .dsCard()
    }
}

private struct MostReportedFigure: View {
    let value: NumberSummary.MostReported

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: DisplayText.number(value.value))
                .font(.dsFigure)
            Text("most reported, by ^[\(value.origins) independent source](inflect: true)")
                .font(.dsCaption)
                .foregroundStyle(Color.dsTextSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct NumberFacts: View {
    let number: NumberSummary

    var body: some View {
        AdaptiveStack(spacing: Spacing.md) {
            if let range = number.rangeText() {
                Fact(label: "Range", value: range)
            }
            if let official = number.latestOfficial {
                Fact(label: "Latest official", value: DisplayText.number(official.value))
            }
        }
    }
}

private struct Fact: View {
    let label: LocalizedStringKey
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.xxs) {
            Text(label)
                .foregroundStyle(Color.dsTextSecondary)
            Text(verbatim: value)
                .font(.dsMono.weight(.semibold))
        }
        .font(.footnote)
        .accessibilityElement(children: .combine)
    }
}

/// One report: time, value, who said it.
private struct TimelineRow: View {
    let report: NumberSummary.Report
    let sourceName: String
    @ScaledMetric(relativeTo: .footnote) private var timeWidth: CGFloat = 46
    @ScaledMetric(relativeTo: .footnote) private var valueWidth: CGFloat = 90

    private var valueText: String {
        let value = DisplayText.number(report.value)
        return report.qualifierText.isEmpty ? value : "\(report.qualifierText) \(value)"
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
            Text(report.at, format: .dateTime.hour().minute())
                .foregroundStyle(Color.dsTextSecondary)
                .frame(minWidth: timeWidth, alignment: .leading)
            Text(verbatim: valueText)
                .fontWeight(.medium)
                .frame(minWidth: valueWidth, alignment: .trailing)
            Text(verbatim: sourceName)
                .foregroundStyle(Color.dsTextSecondary)
            if report.official {
                TagLabel("Official", style: .official)
            } else if report.isFromWitnesses {
                TagLabel("Witnesses")
            }
        }
        .font(.dsMono)
        .accessibilityElement(children: .combine)
    }
}

/// Unverified social-media numbers: dashed purple box, always labeled as unverified.
private struct ChatterBox: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            TagLabel("Unverified", style: .chatter)
            Text(verbatim: text)
                .font(.footnote)
                .foregroundStyle(Color.dsChatter)
                .fixedSize(horizontal: false, vertical: true)
        }
        .dsCard(dashed: true, tint: .dsChatter)
        .accessibilityElement(children: .combine)
    }
}

private struct ChatterOnlyCard: View {
    let chatter: ChatterOnly

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            AdaptiveStack {
                Text(verbatim: chatter.kind.label)
                    .font(.dsHeadline)
                TagLabel("No verified figure yet")
            }
            ChatterBox(text: String(localized: "Social posts mention \(chatter.values.chatterText()). Unverified."))
        }
        .dsCard()
    }
}

#Preview("Numbers") {
    ScrollView {
        EventNumbersSection(event: MockEventsRepository.sample[0])
            .padding()
    }
}
