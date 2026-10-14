@testable import CorePersistence
import Foundation
import Testing

struct KeyValueStoreTests {
    private struct Profile: Codable, Equatable {
        let name: String
    }

    @Test func inMemoryRoundTrip() {
        let store = InMemoryKeyValueStore()
        store.set(Profile(name: "Ada"), forKey: "profile")
        #expect(store.value(Profile.self, forKey: "profile") == Profile(name: "Ada"))
        store.set(Profile?.none, forKey: "profile")
        #expect(store.value(Profile.self, forKey: "profile") == nil)
    }

    @Test func userDefaultsRoundTrip() throws {
        let suite = "tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }

        let store = UserDefaultsStore(defaults: defaults)
        #expect(store.bool(forKey: "flag") == false)
        store.set(true, forKey: "flag")
        #expect(store.bool(forKey: "flag"))
    }
}
