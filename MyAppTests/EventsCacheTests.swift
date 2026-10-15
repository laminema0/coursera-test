import CoreNetworking
import Foundation
@testable import MyApp
import Testing

private struct FailingEventsRepository: EventsRepository {
    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        throw APIError.transport(.notConnectedToInternet)
    }
}

private struct FixedEventsRepository: EventsRepository {
    let events: [NewsEvent]

    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        EventsResponse(generatedAt: Date(timeIntervalSince1970: 2_000), events: events)
    }
}

private final class CountingFailingRepository: EventsRepository, @unchecked Sendable {
    // @unchecked: access to `count` is guarded by `lock`.
    private let lock = NSLock()
    private var count = 0

    var calls: Int { lock.withLock { count } }

    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        lock.withLock { count += 1 }
        throw APIError.transport(.notConnectedToInternet)
    }
}

@MainActor
struct EventsCacheTests {
    private let sample = EventsResponse(generatedAt: Date(timeIntervalSince1970: 1_000), events: MockEventsRepository.sample)

    @Test func fileCacheRoundTripsTheAPIFormat() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("events-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let cache = FileEventsCache(fileURL: url)
        #expect(cache.load() == nil)

        cache.save(sample)
        let loaded = try #require(cache.load())
        #expect(loaded.events.map(\.id) == sample.events.map(\.id))
        #expect(loaded.events.first?.verification == sample.events.first?.verification)
        #expect(loaded.events.first?.numbers.map(\.mostReported) == sample.events.first?.numbers.map(\.mostReported))
        let savedAt = try #require(sample.events.first?.lastUpdatedAt.timeIntervalSince1970)
        let loadedAt = try #require(loaded.events.first?.lastUpdatedAt.timeIntervalSince1970)
        #expect(abs(savedAt - loadedAt) < 0.001, "dates keep millisecond precision")

        let json = try String(contentsOf: url, encoding: .utf8)
        #expect(json.contains("\"state_media_own_country\""), "snake_case like the API")
    }

    @Test func offlineLaunchShowsCachedEventsWithTheirTime() async {
        let store = EventsStore(repository: FailingEventsRepository(), cache: InMemoryEventsCache(sample))
        await store.loadIfNeeded()
        #expect(store.phase == .loaded)
        #expect(store.events.count == sample.events.count)
        #expect(store.lastUpdated == sample.generatedAt)
        #expect(store.lastError != nil, "the list shows an offline banner")
    }

    @Test func successfulRefreshReplacesAndSavesTheCache() async {
        let cache = InMemoryEventsCache(sample)
        let fresh = Array(MockEventsRepository.sample.prefix(1))
        let store = EventsStore(repository: FixedEventsRepository(events: fresh), cache: cache)
        await store.loadIfNeeded()
        #expect(store.events.map(\.id) == fresh.map(\.id))
        #expect(store.isShowingCachedEvents == false)
        #expect(cache.load()?.generatedAt == Date(timeIntervalSince1970: 2_000))
    }

    @Test func refreshIfStaleSkipsRecentFetches() async {
        let clock = TestClock()
        let store = EventsStore(repository: FixedEventsRepository(events: []), cache: nil, now: clock.read)
        await store.refresh()
        let first = store.lastFetchedAt
        clock.advance(by: 10)
        await store.refreshIfStale(maxAge: 30)
        #expect(store.lastFetchedAt == first, "fetched 10 s ago: still fresh")
        clock.advance(by: 30)
        await store.refreshIfStale(maxAge: 30)
        #expect(store.lastFetchedAt != first)
    }

    @Test func failedLaunchFetchIsNotRepeatedAtOnce() async {
        let clock = TestClock()
        let repository = CountingFailingRepository()
        let store = EventsStore(repository: repository, cache: InMemoryEventsCache(sample), now: clock.read)
        await store.loadIfNeeded()
        await store.refreshIfStale(maxAge: 30)
        #expect(repository.calls == 1, "offline launch: one request, not two")
    }
}

/// A clock the test moves by hand.
final class TestClock: @unchecked Sendable {
    // @unchecked: access to `current` is guarded by `lock`.
    private let lock = NSLock()
    private var current = Date(timeIntervalSince1970: 0)

    func read() -> Date {
        lock.withLock { current }
    }

    func advance(by seconds: TimeInterval) {
        lock.withLock { current = current.addingTimeInterval(seconds) }
    }
}
