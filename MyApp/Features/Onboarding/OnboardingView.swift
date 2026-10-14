import DesignSystem
import SwiftUI

struct OnboardingView: View {
    private struct Page: Identifiable {
        let id = UUID()
        let symbol: String
        let title: LocalizedStringKey
        let message: LocalizedStringKey
    }

    private let pages: [Page] = [
        Page(symbol: "sparkles", title: "Welcome", message: "A short line that explains the main value of the app."),
        Page(symbol: "bolt.fill", title: "Fast", message: "Describe the second key benefit here."),
        Page(symbol: "lock.shield", title: "Private", message: "Explain how user data is protected.")
    ]

    let onFinish: () -> Void
    @State private var index = 0

    var body: some View {
        VStack(spacing: Spacing.lg) {
            TabView(selection: $index) {
                ForEach(Array(pages.enumerated()), id: \.element.id) { offset, page in
                    VStack(spacing: Spacing.md) {
                        Image(systemName: page.symbol)
                            .font(.system(size: 72))
                            .foregroundStyle(Color.dsBrand)
                            .accessibilityHidden(true)
                        Text(page.title).font(.dsLargeTitle)
                        Text(page.message)
                            .font(.dsBody)
                            .foregroundStyle(Color.dsTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(Spacing.xl)
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

#Preview {
    OnboardingView {}
}
