import CoreLogging
import SwiftUI

@main
struct MyAppApp: App {
    @State private var container: AppContainer
    @State private var appState: AppState

    init() {
        let container = AppContainer.live()
        _container = State(initialValue: container)
        _appState = State(initialValue: AppState(store: container.keyValueStore))
        let environment = container.configuration.environment.rawValue
        Log.app.info("Launched in \(environment, privacy: .public) environment")
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(container)
                .environment(appState)
        }
    }
}
