import SwiftUI

struct MainTabView: View {
    enum Tab: Hashable {
        case home, settings
    }

    @State private var selection: Tab = .home
    @State private var homeRouter = Router()
    @State private var settingsRouter = Router()

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack(path: $homeRouter.path) {
                HomeView()
                    .withAppRoutes()
            }
            .environment(homeRouter)
            .tabItem { Label("Home", systemImage: "house") }
            .tag(Tab.home)

            NavigationStack(path: $settingsRouter.path) {
                SettingsView()
                    .withAppRoutes()
            }
            .environment(settingsRouter)
            .tabItem { Label("Settings", systemImage: "gearshape") }
            .tag(Tab.settings)
        }
    }
}

#Preview {
    let container = AppContainer.preview()
    return MainTabView()
        .environment(container)
        .environment(AppState(store: container.keyValueStore))
}
