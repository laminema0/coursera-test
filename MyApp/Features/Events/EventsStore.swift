import CoreNetworking
import Foundation
import Observation

/// One status group in the events list.
struct EventSection: Identifiable, Equatable {
    let status: VerificationStatus
    let events: [NewsEvent]

    var id: VerificationStatus { status }
}

/// Holds the current verified events and keeps them fresh.
@MainActor
@Observable
final class EventsStore {
    /// What the list screen should show.
    enum Phase: Equatable {
        case loading
        case failed(String)
        case empty
        case loaded
    }

    /// Most trustworthy first. Disputed and retracted stay visible on purpose.
    static let displayOrder: [VerificationStatus] = [.confirmed, .corroborated, .reported, .unverified, .disputed, .retracted]

    private(set) var events: [NewsEvent] = []
    private(set) var lastUpdated: Date?
    private(set) var lastError: String?
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    /// When this device last fetched successfully (local clock), for "refresh if stale".
    private(set) var lastFetchedAt: Date?
    /// True while the list shows the cached copy from an earlier session.
    private(set) var isShowingCachedEvents = false
    /// Sent to the server. The list screen filters locally instead, so its counts stay complete.
    var statusFilter: VerificationStatus?

    private let repository: EventsRepository
    private let cache: EventsCaching?
    private let now: @Sendable () -> Date

    init(repository: EventsRepository, cache: EventsCaching? = nil, now: @escaping @Sendable () -> Date = { .now }) {
        self.repository = repository
        self.cache = cache
        self.now = now
    }

    var phase: Phase {
        if !events.isEmpty { return .loaded }
        if let lastError { return .failed(lastError) }
        return hasLoaded ? .empty : .loading
    }

    /// Events grouped by status, most trustworthy first.
    var eventsByStatus: [(status: VerificationStatus, events: [NewsEvent])] {
        sections(filter: nil).map { ($0.status, $0.events) }
    }

    /// Sections for the list, optionally limited to one status. Server order (importance) is kept inside a section.
    func sections(filter: VerificationStatus?) -> [EventSection] {
        Self.displayOrder.compactMap { status in
            guard filter == nil || filter == status else { return nil }
            let matching = events.filter { $0.verification.status == status }
            return matching.isEmpty ? nil : EventSection(status: status, events: matching)
        }
    }

    /// Number of events per status, for the filter chips.
    var statusCounts: [VerificationStatus: Int] {
        Dictionary(grouping: events, by: \.verification.status).mapValues(\.count)
    }

    var breakingCount: Int {
        events.filter(\.breaking).count
    }

    /// The latest version of an event, so an open detail screen updates after a refresh.
    func event(id: String) -> NewsEvent? {
        events.first { $0.id == id }
    }

    /// Shows the cached copy at once, then loads fresh events. Later calls do nothing until `refresh()`.
    func loadIfNeeded() async {
        guard !hasLoaded else { return }
        if events.isEmpty, let cached = cache?.load() {
            events = cached.events
            lastUpdated = cached.generatedAt
            isShowingCachedEvents = true
        }
        await refresh()
    }

    /// Refreshes when the last successful fetch is older than `maxAge` seconds (e.g. back from the background).
    func refreshIfStale(maxAge: TimeInterval) async {
        if let lastFetchedAt, now().timeIntervalSince(lastFetchedAt) < maxAge { return }
        await refresh()
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await repository.fetchEvents(status: statusFilter)
            events = response.events
            lastUpdated = response.generatedAt
            lastFetchedAt = now()
            lastError = nil
            hasLoaded = true
            isShowingCachedEvents = false
            if statusFilter == nil {
                cache?.save(response)
            }
        } catch is CancellationError {
            return
        } catch let error as APIError {
            lastError = error.userMessage
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Refreshes every `interval` until the calling task is cancelled (e.g. the screen disappears).
    func autoRefresh(every interval: Duration) async {
        while !Task.isCancelled {
            do {
                try await Task.sleep(for: interval)
            } catch {
                return
            }
            await refresh()
        }
    }
}
