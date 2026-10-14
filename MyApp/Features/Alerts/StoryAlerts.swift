import CorePersistence
import Foundation

/// A local notification about a story: it started breaking, or became confirmed or disputed.
struct StoryAlert: Equatable, Sendable {
    enum Reason: String, Sendable {
        case breaking, confirmed, disputed
    }

    let eventId: String
    let title: String
    let reason: Reason

    /// Stable per story and reason, so a repeated alert replaces the old one.
    var identifier: String { "story-\(eventId)-\(reason.rawValue)" }

    var heading: String {
        switch reason {
        case .breaking: NSLocalizedString("Breaking", comment: "Notification title")
        case .confirmed: NSLocalizedString("Confirmed by an official source", comment: "Notification title")
        case .disputed: NSLocalizedString("Disputed", comment: "Notification title")
        }
    }
}

/// What the app last saw of each story, to notice changes between fetches.
struct AlertLedger: Codable, Equatable, Sendable {
    struct Entry: Codable, Equatable, Sendable {
        let status: VerificationStatus
        let breaking: Bool
    }

    var entries: [String: Entry] = [:]

    init(events: [NewsEvent]) {
        for event in events {
            entries[event.id] = Entry(status: event.verification.status, breaking: event.breaking)
        }
    }
}

enum StoryAlertPlanner {
    /// At most this many notifications per fetch, most important stories first.
    static let maxAlerts = 3

    /// Alerts for changes since `previous`. The first run (no ledger yet) only records what it sees.
    static func alerts(for events: [NewsEvent], previous: AlertLedger?) -> [StoryAlert] {
        guard let previous else { return [] }
        let sorted = events.sorted { $0.importance > $1.importance }
        let alerts = sorted.compactMap { event -> StoryAlert? in
            let before = previous.entries[event.id]
            let status = event.verification.status
            if status == .confirmed || status == .disputed, before?.status != status {
                return StoryAlert(eventId: event.id, title: event.title, reason: status == .confirmed ? .confirmed : .disputed)
            }
            if event.breaking, before?.breaking != true {
                return StoryAlert(eventId: event.id, title: event.title, reason: .breaking)
            }
            return nil
        }
        return Array(alerts.prefix(maxAlerts))
    }
}

/// The alerts switch and ledger, kept in the key-value store.
struct StoryAlertState: Sendable {
    static let enabledKey = "storyAlertsEnabled"
    static let ledgerKey = "storyAlertLedger"

    let store: KeyValueStore

    var isEnabled: Bool { store.bool(forKey: Self.enabledKey) }

    /// Records the latest events and returns the alerts to post (none while alerts are switched off).
    func process(_ events: [NewsEvent]) -> [StoryAlert] {
        let previous = store.value(AlertLedger.self, forKey: Self.ledgerKey)
        let alerts = StoryAlertPlanner.alerts(for: events, previous: previous)
        store.set(AlertLedger(events: events), forKey: Self.ledgerKey)
        return isEnabled ? alerts : []
    }
}

/// One background refresh: fetch, cache, and work out which alerts to post.
struct BackgroundEventsUpdate: Sendable {
    let repository: EventsRepository
    let cache: EventsCaching
    let alertState: StoryAlertState

    func run() async -> [StoryAlert] {
        guard let response = try? await repository.fetchEvents(status: nil) else { return [] }
        cache.save(response)
        return alertState.process(response.events)
    }
}
