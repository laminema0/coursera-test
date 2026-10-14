import CorePersistence
import Foundation
import Observation

/// App-wide state that drives the root of the UI.
@MainActor
@Observable
final class AppState {
    private enum Keys {
        static let hasCompletedOnboarding = "hasCompletedOnboarding"
    }

    private let store: KeyValueStore

    var hasCompletedOnboarding: Bool {
        didSet { store.set(hasCompletedOnboarding, forKey: Keys.hasCompletedOnboarding) }
    }

    init(store: KeyValueStore) {
        self.store = store
        self.hasCompletedOnboarding = store.bool(forKey: Keys.hasCompletedOnboarding)
    }
}
