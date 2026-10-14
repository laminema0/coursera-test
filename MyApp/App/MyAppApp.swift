import CoreLogging
import SwiftUI

@main
struct MyAppApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var container: AppContainer
    @State private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase

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
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                BackgroundRefresh.schedule()
            }
        }
        .backgroundTask(.appRefresh(BackgroundRefresh.taskIdentifier)) { [update = container.backgroundEventsUpdate] in
            await BackgroundRefresh.run(update)
        }
    }
}
