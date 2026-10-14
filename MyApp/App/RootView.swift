import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.hasCompletedOnboarding {
                MainTabView()
                    .transition(.opacity)
            } else {
                OnboardingView {
                    appState.hasCompletedOnboarding = true
                }
                .transition(.opacity)
            }
        }
        .animation(.default, value: appState.hasCompletedOnboarding)
    }
}

#Preview {
    let container = AppContainer.preview()
    return RootView()
        .environment(container)
        .environment(AppState(store: container.keyValueStore))
}
