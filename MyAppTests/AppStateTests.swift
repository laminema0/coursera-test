import CorePersistence
@testable import MyApp
import Testing

@MainActor
struct AppStateTests {
    @Test func onboardingFlagIsPersisted() {
        let store = InMemoryKeyValueStore()
        let state = AppState(store: store)
        #expect(state.hasCompletedOnboarding == false)

        state.hasCompletedOnboarding = true
        #expect(AppState(store: store).hasCompletedOnboarding)
    }
}
