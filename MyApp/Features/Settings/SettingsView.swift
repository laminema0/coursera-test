import DesignSystem
import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(AppContainer.self) private var container
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router

    var body: some View {
        Form {
            StoryAlertsSection()

            Section("How It Works") {
                Button("What the Colors Mean") { router.push(.statusGuide) }
                Button("Sources") { router.push(.sources) }
                Button("About") { router.push(.about) }
            }

            Section {
                LabeledContent("Data") {
                    Text(container.configuration.useMockData ? "Sample data" : "Live")
                }
                if !container.configuration.useMockData {
                    LabeledContent("Server", value: container.configuration.apiBaseURL.absoluteString)
                        .textSelection(.enabled)
                }
                LabeledContent("Environment", value: container.configuration.environment.rawValue.capitalized)
            } header: {
                Text("Server")
            } footer: {
                Text("Debug builds show sample data. Other builds read the server set in Configs/*.xcconfig (API_BASE_URL).")
            }

            Section("Developer") {
                Button("Show Onboarding Again", role: .destructive) {
                    appState.hasCompletedOnboarding = false
                }
            }
        }
        .navigationTitle("Settings")
    }
}

/// The alerts switch. Notification permission is asked only when the user turns it on.
private struct StoryAlertsSection: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var isAsking = false
    @State private var wasDenied = false

    var body: some View {
        Section {
            Toggle("Breaking News Alerts", isOn: Binding(get: { appState.storyAlertsEnabled }, set: setEnabled))
                .disabled(isAsking)
                .accessibilityIdentifier("settings.alerts")
            if wasDenied {
                Button("Allow Notifications in Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                }
            }
        } header: {
            Text("Alerts")
        } footer: {
            Text("Get a notification when a story starts breaking, or becomes confirmed or disputed. "
                + "iOS decides when the app may check in the background, usually a few times an hour.")
        }
    }

    private func setEnabled(_ enabled: Bool) {
        guard enabled else {
            appState.storyAlertsEnabled = false
            return
        }
        isAsking = true
        Task {
            let granted = await StoryNotifier.requestPermission()
            appState.storyAlertsEnabled = granted
            wasDenied = !granted
            isAsking = false
        }
    }
}

struct AboutView: View {
    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "-"
        let build = info?["CFBundleVersion"] as? String ?? "-"
        return "\(short) (\(build))"
    }

    var body: some View {
        List {
            Section {
                Text("Breaking news with a trust status. Every story shows how many independent sources back it, "
                    + "and the status changes as new reports come in.")
                NavigationLink(value: AppRoute.statusGuide) {
                    Text("What the colors mean")
                }
            }
            Section("Privacy") {
                Text("No account, no tracking, no analytics. Articles open at the publisher; "
                    + "the app stores only a copy of the latest stories on this phone.")
            }
            Section {
                LabeledContent("Version", value: version)
            }
        }
        .navigationTitle("About")
    }
}

#Preview {
    let container = AppContainer.preview()
    return NavigationStack {
        SettingsView().withAppRoutes()
    }
    .environment(container)
    .environment(AppState(store: container.keyValueStore))
    .environment(Router())
}

#Preview("About") {
    NavigationStack {
        AboutView().withAppRoutes()
    }
}
