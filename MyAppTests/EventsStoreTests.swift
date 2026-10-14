import CoreNetworking
import Foundation
@testable import MyApp
import Testing

/// Returns queued results in order; counts calls.
private final class ScriptedEventsRepository: EventsRepository, @unchecked Sendable {
    private let lock = NSLock()
    private var results: [Result<[NewsEvent], Error>]
    private(set) var calls = 0

    init(_ results: [Result<[NewsEvent], Error>]) {
        self.results = results
    }

    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        let result: Result<[NewsEvent], Error> = lock.withLock {
            calls += 1
            return results.count > 1 ? results.removeFirst() : results[0]
        }
        return EventsResponse(generatedAt: Date(timeIntervalSince1970: 0), events: try result.get())
    }
}

@MainActor
struct EventsStoreTests {
    private let sample = MockEventsRepository.sample

    @Test func phaseStartsLoadingThenLoaded() async {
        let store = EventsStore(repository: ScriptedEventsRepository([.success(sample)]))
        #expect(store.phase == .loading)
        await store.loadIfNeeded()
        #expect(store.phase == .loaded)
        #expect(store.lastUpdated == Date(timeIntervalSince1970: 0))
    }

    @Test func emptyResponseShowsEmptyPhase() async {
        let store = EventsStore(repository: ScriptedEventsRepository([.success([])]))
        await store.refresh()
        #expect(store.phase == .empty)
    }

    @Test func failureWithoutDataShowsError() async {
        let error = APIError.transport(.notConnectedToInternet)
        let store = EventsStore(repository: ScriptedEventsRepository([.failure(error)]))
        await store.refresh()
        #expect(store.phase == .failed(error.userMessage))
    }

    @Test func failedRefreshKeepsShownEvents() async {
        let error = APIError.transport(.timedOut)
        let store = EventsStore(repository: ScriptedEventsRepository([.success(sample), .failure(error)]))
        await store.refresh()
        await store.refresh()
        #expect(store.phase == .loaded, "old events stay visible")
        #expect(store.lastError == error.userMessage, "the list shows a banner instead")
    }

    @Test func loadIfNeededLoadsOnce() async {
        let repository = ScriptedEventsRepository([.success(sample)])
        let store = EventsStore(repository: repository)
        await store.loadIfNeeded()
        await store.loadIfNeeded()
        #expect(repository.calls == 1)
    }

    @Test func sectionsFollowTrustOrderAndFilter() async {
        let store = EventsStore(repository: ScriptedEventsRepository([.success(sample)]))
        await store.refresh()
        #expect(store.sections(filter: nil).map(\.status) == EventsStore.displayOrder)
        #expect(store.sections(filter: .disputed).map(\.status) == [.disputed])
        #expect(store.sections(filter: .disputed).first?.events.map(\.id) == ["minister"])
        #expect(store.statusCounts[.confirmed] == 1)
        #expect(store.statusCounts[.retracted] == 1)
        #expect(store.breakingCount == 2)
        #expect(store.event(id: "port")?.verification.status == .reported)
        #expect(store.event(id: "missing") == nil)
    }

    @Test func autoRefreshRepeatsUntilCancelled() async throws {
        let repository = ScriptedEventsRepository([.success(sample)])
        let store = EventsStore(repository: repository)
        let task = Task { await store.autoRefresh(every: .milliseconds(10)) }
        // Wait for two refreshes instead of a fixed time: busy CI machines can be slow.
        let deadline = ContinuousClock.now + .seconds(5)
        while repository.calls < 2 && ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        task.cancel()
        await task.value
        let callsAtCancel = repository.calls
        #expect(callsAtCancel >= 2)
        try await Task.sleep(for: .milliseconds(50))
        #expect(repository.calls == callsAtCancel, "no refresh after cancellation")
    }
}
