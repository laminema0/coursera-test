import DesignSystem
import SwiftUI

/// Sources grouped by origin: official, wire agencies (counted once), news outlets, social posts (not counted).
struct EventSourcesSection: View {
    let event: NewsEvent
    let open: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            SectionEyebrow("Sources · \(event.origins.count) origins")
            if event.origins.isEmpty {
                Text("No sources yet.")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
            ForEach(event.originGroups) { group in
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(verbatim: group.kind.groupTitle)
                        .font(.subheadline.weight(.semibold))
                        .accessibilityAddTraits(.isHeader)
                    ForEach(group.origins, id: \.key) { origin in
                        OriginCard(origin: origin, open: open)
                    }
                }
            }
        }
    }
}

private struct OriginCard: View {
    let origin: EventOrigin
    let open: (URL) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            AdaptiveStack {
                Text(verbatim: origin.displayName)
                    .font(.dsHeadline)
                OriginTags(kind: origin.kind)
            }
            ForEach(origin.articles) { article in
                ArticleLink(article: article, open: open)
            }
        }
        .dsCard(dashed: !origin.kind.isCounted, tint: origin.kind.isCounted ? .dsSeparator : .dsChatter)
    }
}

private struct OriginTags: View {
    let kind: EventOrigin.Kind

    var body: some View {
        HStack(spacing: Spacing.xxs) {
            TagLabel(verbatim: kind.label, style: kind == .primary ? .official : .neutral)
            if kind == .wire {
                TagLabel("Counted once")
            }
            if !kind.isCounted {
                TagLabel("Not counted", style: .chatter)
            }
        }
    }
}

private struct ArticleLink: View {
    let article: EventOrigin.Article
    let open: (URL) -> Void

    var body: some View {
        Button {
            open(article.url)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(article.title)
                    .font(.subheadline)
                    .foregroundStyle(Color.dsBrand)
                    .multilineTextAlignment(.leading)
                Text("\(article.sourceName) · \(article.publishedAt, format: .dateTime.hour().minute())")
                    .font(.dsCaption)
                    .foregroundStyle(Color.dsTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint(Text("Opens the article"))
    }
}

#Preview("Sources") {
    ScrollView {
        EventSourcesSection(event: MockEventsRepository.sample[0]) { _ in }
            .padding()
    }
}
