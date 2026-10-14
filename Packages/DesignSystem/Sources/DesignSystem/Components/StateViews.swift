import SwiftUI

public struct LoadingView: View {
    private let message: LocalizedStringKey

    public init(_ message: LocalizedStringKey = "Loading…") {
        self.message = message
    }

    public var body: some View {
        VStack(spacing: Spacing.sm) {
            ProgressView()
            Text(message)
                .font(.dsCaption)
                .foregroundStyle(Color.dsTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }
}

public struct ErrorStateView: View {
    private let message: String
    private let retry: (() -> Void)?

    public init(message: String, retry: (() -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        ContentUnavailableView {
            Label("Something went wrong", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            if let retry {
                Button("Try Again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

#Preview("Loading") { LoadingView() }
#Preview("Error") { ErrorStateView(message: "You appear to be offline.") {} }
