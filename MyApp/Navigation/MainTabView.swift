import SwiftUI

struct MainTabView: View {
    enum Tab: Hashable {
        case news, sources, settings
    }

    @State private var selection: Tab = .news
    @State private var newsRouter = Router()
    @State private var sourcesRouter = Router()
    @State private var settingsRouter = Router()

    var body: some View {
        TabView(selection: $selection) {
            NewsTab(router: newsRouter)
                .tabItem { Label("News", systemImage: "newspaper") }
                .tag(Tab.news)

            NavigationStack(path: $sourcesRouter.path) {
                SourcesView()
                    .withAppRoutes()
            }
            .environment(sourcesRouter)
            .tabItem { Label("Sources", systemImage: "antenna.radiowaves.left.and.right") }
            .tag(Tab.sources)

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
