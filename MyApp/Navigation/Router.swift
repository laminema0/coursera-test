import Observation
import SwiftUI

/// All push destinations in the app. Add a case per new screen.
enum AppRoute: Hashable {
    case itemDetail(Item)
    case about
    case eventDetail(NewsEvent)
    case sources
    case statusGuide
}

/// Owns the navigation stack for one tab.
@MainActor
@Observable
final class Router {
    var path = NavigationPath()

    func push(_ route: AppRoute) {
        path.append(route)
    }

    func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
    }

    func popToRoot() {
        path = NavigationPath()
    }
}

extension View {
    /// Maps every `AppRoute` to its screen. Attach once inside each `NavigationStack`.
    func withAppRoutes() -> some View {
        navigationDestination(for: AppRoute.self) { route in
            switch route {
            case .itemDetail(let item):
                ItemDetailView(item: item)
            case .about:
                AboutView()
            case .eventDetail(let event):
                EventDetailView(event: event)
            case .sources:
                SourcesView()
            case .statusGuide:
                StatusGuideView()
            }
        }
    }
}
