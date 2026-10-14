import SwiftUI

/// Small uppercase tag, e.g. "official", "counted once", "not counted".
public struct TagLabel: View {
    public enum Style: Sendable {
        case neutral, official, warning, chatter
    }

    private let text: Text
    private let style: Style

    public init(_ key: LocalizedStringKey, style: Style = .neutral) {
        self.text = Text(key)
        self.style = style
    }

    public init(verbatim text: String, style: Style = .neutral) {
        self.text = Text(verbatim: text)
        self.style = style
    }

    private var color: Color {
        switch style {
        case .neutral: .dsTextSecondary
        case .official: .dsStatusConfirmed
        case .warning: .dsStatusDisputed
        case .chatter: .dsChatter
        }
    }

    public var body: some View {
        text
            .textCase(.uppercase)
            .font(.dsTag)
            .foregroundStyle(color)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).strokeBorder(color.opacity(0.45)))
    }
}

/// Lays children out in a row, or in a column at accessibility text sizes so nothing gets cut off.
public struct AdaptiveStack<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    private let spacing: CGFloat
    private let content: Content

    public init(spacing: CGFloat = Spacing.xs, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    public var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: spacing))
        layout { content }
    }
}

/// Uppercase section title used on detail screens.
public struct SectionEyebrow: View {
    private let text: Text

    public init(_ key: LocalizedStringKey) {
        self.text = Text(key)
    }

    public init(verbatim text: String) {
        self.text = Text(verbatim: text)
    }

    public var body: some View {
        text
            .textCase(.uppercase)
            .font(.dsTag)
            .foregroundStyle(Color.dsTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}

public extension View {
    /// Bordered card. `dashed` marks unverified content (social posts, chatter).
    func dsCard(dashed: Bool = false, tint: Color = .dsSeparator) -> some View {
        modifier(CardModifier(dashed: dashed, tint: tint))
    }
}

private struct CardModifier: ViewModifier {
    let dashed: Bool
    let tint: Color

    func body(content: Content) -> some View {
        content
            .padding(Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.dsSecondaryBackground.opacity(dashed ? 0.5 : 1), in: shape)
            .overlay(shape.strokeBorder(tint, style: StrokeStyle(lineWidth: 1, dash: dashed ? [5, 4] : [])))
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: Spacing.md) {
        SectionEyebrow("Sources")
        HStack {
            TagLabel("Official", style: .official)
            TagLabel("Counted once")
            TagLabel("Not counted", style: .chatter)
        }
        Text("Verified card").dsCard()
        Text("On social media: 20 (3×)").foregroundStyle(Color.dsChatter).dsCard(dashed: true, tint: .dsChatter)
    }
    .padding()
}
