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

    /// Local notifications for breaking, confirmed and disputed stories. Off until the user turns it on.
    var storyAlertsEnabled: Bool {
        didSet { store.set(storyAlertsEnabled, forKey: StoryAlertState.enabledKey) }
    }

    init(store: KeyValueStore) {
        self.store = store
        self.hasCompletedOnboarding = store.bool(forKey: Keys.hasCompletedOnboarding)
        self.storyAlertsEnabled = store.bool(forKey: StoryAlertState.enabledKey)
    }
}
