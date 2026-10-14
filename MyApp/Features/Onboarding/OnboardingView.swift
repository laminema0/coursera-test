import DesignSystem
import SwiftUI

struct OnboardingView: View {
    private struct Page: Identifiable {
        let id = UUID()
        let symbol: String
        let title: LocalizedStringKey
        let message: LocalizedStringKey
        var showsLegend = false
    }

    private let pages: [Page] = [
        Page(
            symbol: "newspaper",
            title: "Breaking News You Can Check",
            message: "Every story shows how many independent sources back it, and changes as new reports come in."
        ),
        Page(
            symbol: "circle.lefthalf.filled",
            title: "Colors Show Trust",
            message: "Grey means only social posts so far. Blue means an official source confirmed it.",
            showsLegend: true
        ),
        Page(
            symbol: "person.2.wave.2",
            title: "Social Posts Never Count",
            message: "Posts appear early as unverified chatter, in purple. Thirty copies of one wire story count once."
        ),
        Page(
            symbol: "lock.shield",
            title: "Free and Private",
            message: "No account, no tracking. Articles open at the publisher."
        )
    ]

    let onFinish: () -> Void
    @State private var index = 0

    var body: some View {
        VStack(spacing: Spacing.lg) {
            TabView(selection: $index) {
                ForEach(Array(pages.enumerated()), id: \.element.id) { offset, page in
                    OnboardingPage(symbol: page.symbol, title: page.title, message: page.message, showsLegend: page.showsLegend)
                        .tag(offset)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(index == pages.count - 1 ? "Get Started" : "Next") {
                if index < pages.count - 1 {
                    withAnimation { index += 1 }
                } else {
                    onFinish()
                }
            }
            .buttonStyle(.primary)
            .padding(.horizontal, Spacing.lg)
            .accessibilityIdentifier("onboarding.primaryButton")
        }
        .padding(.bottom, Spacing.lg)
        .background(Color.dsBackground)
    }
}

private struct OnboardingPage: View {
    let symbol: String
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    let showsLegend: Bool

    var body: some View {
        // Scrolls so the legend fits at large text sizes.
        ScrollView {
            VStack(spacing: Spacing.md) {
                Image(systemName: symbol)
                    .font(.system(size: showsLegend ? 48 : 72))
                    .foregroundStyle(Color.dsBrand)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.dsLargeTitle)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.dsBody)
                    .foregroundStyle(Color.dsTextSecondary)
                    .multilineTextAlignment(.center)
                if showsLegend {
                    StatusLegend()
                        .padding(.top, Spacing.xs)
                }
            }
            .padding(Spacing.xl)
            .padding(.bottom, Spacing.xl)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

#Preview {
    OnboardingView {}
}

#Preview("Dark, large text") {
    OnboardingView {}
        .preferredColorScheme(.dark)
        .dynamicTypeSize(.accessibility1)
}
