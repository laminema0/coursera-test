import DesignSystem
import SwiftUI

struct SettingsView: View {
    @Environment(AppContainer.self) private var container
    @Environment(AppState.self) private var appState
    @Environment(Router.self) private var router

    var body: some View {
        Form {
            Section("General") {
                Button("About") { router.push(.about) }
            }

            Section("Developer") {
                LabeledContent("Environment", value: container.configuration.environment.rawValue.capitalized)
                LabeledContent("API", value: container.configuration.apiBaseURL.host() ?? "-")
                LabeledContent("Mock Data", value: container.configuration.useMockData ? "On" : "Off")
                Button("Show Onboarding Again", role: .destructive) {
                    appState.hasCompletedOnboarding = false
                }
            }
        }
        .navigationTitle("Settings")
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
            LabeledContent("Version", value: version)
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
