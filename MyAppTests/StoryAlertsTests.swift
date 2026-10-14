import CorePersistence
import Foundation
@testable import MyApp
import Testing

struct StoryAlertsTests {
    private static func event(_ id: String, _ status: VerificationStatus, breaking: Bool = false, importance: Double = 1) -> NewsEvent {
        let base = MockEventsRepository.sample[0]
        let verification = Verification(
            status: status, reason: "", confirming: 1, disputing: 0, primary: 0, tier1: 0, signals: 0, stateMediaOwnCountry: 0
        )
        return NewsEvent(
            id: id, title: "Story \(id)", firstSeenAt: base.firstSeenAt, lastUpdatedAt: base.lastUpdatedAt, keyTerms: [],
            importance: importance, breaking: breaking, newOriginsLastHour: 0, firstReport: nil, statusHistory: [],
            verification: verification, numbers: [], chatterOnly: [], statements: [], coverage: nil, origins: []
        )
    }

    @Test func firstRunOnlyRecords() {
        let events = [Self.event("a", .confirmed, breaking: true)]
        #expect(StoryAlertPlanner.alerts(for: events, previous: nil).isEmpty)
    }

    @Test func alertsOnNewBreakingConfirmedAndDisputed() {
        let before = AlertLedger(events: [
            Self.event("quiet", .reported),
            Self.event("rising", .corroborated),
            Self.event("doubt", .reported),
            Self.event("same", .confirmed, breaking: true)
        ])
        let now = [
            Self.event("quiet", .reported, breaking: true, importance: 3),
            Self.event("rising", .confirmed, importance: 5),
            Self.event("doubt", .disputed, importance: 4),
            Self.event("same", .confirmed, breaking: true, importance: 9)
        ]
        let alerts = StoryAlertPlanner.alerts(for: now, previous: before)
        #expect(alerts.map(\.eventId) == ["rising", "doubt", "quiet"], "most important first; nothing for unchanged stories")
        #expect(alerts.map(\.reason) == [.confirmed, .disputed, .breaking])
        #expect(alerts.first?.identifier == "story-rising-confirmed")
    }

    @Test func newStoryThatIsAlreadyConfirmedAlerts() {
        let alerts = StoryAlertPlanner.alerts(for: [Self.event("new", .confirmed)], previous: AlertLedger(events: []))
        #expect(alerts.map(\.reason) == [.confirmed])
    }

    @Test func alertsAreCapped() {
        let events = (1...6).map { Self.event("e\($0)", .reported, breaking: true, importance: Double($0)) }
        let alerts = StoryAlertPlanner.alerts(for: events, previous: AlertLedger(events: []))
        #expect(alerts.count == StoryAlertPlanner.maxAlerts)
        #expect(alerts.first?.eventId == "e6")
    }

    @Test func stateRecordsEvenWhenSwitchedOffAndPostsOnlyWhenOn() {
        let store = InMemoryKeyValueStore()
        let state = StoryAlertState(store: store)
        #expect(state.process([Self.event("a", .reported)]).isEmpty, "first run")
        #expect(state.process([Self.event("a", .confirmed)]).isEmpty, "switched off")
        store.set(true, forKey: StoryAlertState.enabledKey)
        #expect(state.process([Self.event("a", .confirmed)]).isEmpty, "already seen as confirmed")
        #expect(state.process([Self.event("a", .disputed)]).map(\.reason) == [.disputed])
    }

    @Test func backgroundUpdateCachesAndReturnsAlerts() async {
        let store = InMemoryKeyValueStore()
        store.set(true, forKey: StoryAlertState.enabledKey)
        store.set(AlertLedger(events: []), forKey: StoryAlertState.ledgerKey)
        let cache = InMemoryEventsCache()
        let update = BackgroundEventsUpdate(
            repository: MockEventsRepository(delay: .zero), cache: cache, alertState: StoryAlertState(store: store)
        )
        let alerts = await update.run()
        #expect(cache.load()?.events.count == MockEventsRepository.sample.count)
        #expect(alerts.count == StoryAlertPlanner.maxAlerts)
    }
}
