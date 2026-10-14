import DesignSystem
import SafariServices
import SwiftUI

extension VerificationStatus {
    /// The design-system status used for colors, badges and legends.
    var trust: TrustStatus {
        switch self {
        case .unverified: .unverified
        case .reported: .reported
        case .corroborated: .corroborated
        case .confirmed: .confirmed
        case .disputed: .disputed
        case .retracted: .retracted
        }
    }
}

/// A link to open in the in-app browser.
struct BrowserLink: Identifiable {
    let url: URL

    var id: String { url.absoluteString }
}

/// Opens publisher articles in SFSafariViewController, so readers stay in the app and land on the source.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// Explains the six statuses. Shown from the News toolbar and from Settings.
struct StatusGuideView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                Text("Every story shows how many independent sources back it. The color tells you how far it got.")
                    .font(.dsBody)
                StatusLegend()
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    SectionEyebrow("What counts")
                    Text("Feeds with the same owner count once. Copies of one wire story count once, as the wire.")
                    Text("Social posts appear early as unverified chatter but never count as confirmation.")
                        .foregroundStyle(Color.dsChatter)
                }
                .font(.dsCaption)
            }
            .padding(Spacing.md)
        }
        .navigationTitle("What the Colors Mean")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview("Status guide") {
    NavigationStack { StatusGuideView() }
}
