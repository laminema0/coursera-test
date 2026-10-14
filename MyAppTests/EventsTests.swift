import CoreNetworking
import Foundation
@testable import MyApp
import Testing

@MainActor
struct EventsTests {
    // Trimmed output of the backend's GET /v1/events for the earthquake fixture.
    private static let json = """
    {
      "generated_at": "2026-10-14T20:00:00.000Z",
      "events": [{
        "id": "e1", "title": "Turkey earthquake: Strong quake hits Malatya province",
        "first_seen_at": "2026-10-14T09:10:00.000Z", "last_updated_at": "2026-10-14T11:10:00.000Z",
        "key_terms": ["earthquake", "turkey", "malatya"], "importance": 9.4, "breaking": true, "new_origins_last_hour": 2,
        "first_report": { "source_id": "usgs", "source_name": "USGS", "at": "2026-10-14T09:10:00.000Z" },
        "verification": { "status": "confirmed", "reason": "Confirmed by an official source, plus 5 independent sources.",
          "confirming": 6, "disputing": 0, "primary": 1, "tier1": 3, "signals": 1, "state_media_own_country": 0 },
        "numbers": [{ "kind": "killed", "min": 5, "max": 15, "most_reported": { "value": 14, "origins": 2 },
          "latest_official": { "value": 15, "at": "2026-10-14T11:10:00.000Z", "source_id": "dw" },
          "timeline": [{ "value": 5, "qualifier": "atLeast", "attribution": "official", "official": true,
            "source_id": "bbc-world", "at": "2026-10-14T09:40:00.000Z" }], "chatter": [{ "value": 20, "mentions": 2 }] },
          { "kind": "magnitude", "min": 6.1, "max": 6.1, "most_reported": { "value": 6.1, "origins": 4 }, "timeline": [], "chatter": [] }],
        "chatter_only": [],
        "statements": [],
        "coverage": { "outlets": 87, "countries": 23, "first_seen_at": "2026-10-14T09:15:00.000Z",
          "checked_at": "2026-10-14T12:00:00.000Z" },
        "origins": [{ "key": "primary:usgs", "kind": "primary", "tier": "primary", "articles": [{
          "id": "a1", "title": "M 6.1 earthquake – 20 km S of Malatya, Turkey", "url": "https://earthquake.usgs.gov/x",
          "source_id": "usgs", "source_name": "USGS", "published_at": "2026-10-14T09:10:00.000Z" }] }]
      }, {
        "id": "e2", "title": "Something new", "first_seen_at": "2026-10-14T09:10:00Z", "last_updated_at": "2026-10-14T09:10:00Z",
        "key_terms": [], "importance": 1, "breaking": false, "new_origins_last_hour": 0,
        "verification": { "status": "some-future-status", "reason": "", "confirming": 0, "disputing": 0,
          "primary": 0, "tier1": 0, "signals": 1, "state_media_own_country": 0 }, "numbers": [],
        "chatter_only": [{ "kind": "missing", "values": [{ "value": 4, "mentions": 3 }] }], "statements": [], "origins": []
      }]
    }
    """

    @Test func decodesBackendEvents() throws {
        let response = try JSONDecoder.api.decode(EventsResponse.self, from: Data(Self.json.utf8))
        let quake = try #require(response.events.first)
        #expect(quake.verification.status == .confirmed)
        #expect(quake.numbers.first?.mostReported.value == 14)
        #expect(quake.numbers.first?.latestOfficial?.sourceId == "dw")
        #expect(quake.numbers.first?.isRange == true)
        #expect(quake.numbers.last?.kind == .magnitude)
        #expect(quake.origins.first?.kind == .primary)
        #expect(quake.coverage?.outlets == 87)
        #expect(quake.firstReport?.sourceName == "USGS")
        #expect(quake.breaking)
        #expect(quake.numbers.first?.chatter.first?.mentions == 2)
        #expect(response.events.last?.chatterOnly.first?.kind == .missing)
        #expect(response.events.last?.coverage == nil)
        #expect(response.events.last?.verification.status == .unverified, "unknown status falls back safely")
    }

    @Test func storeGroupsEventsByTrustLevel() async {
        let store = EventsStore(repository: MockEventsRepository(delay: .zero))
        await store.refresh()
        #expect(store.events.count == MockEventsRepository.sample.count)
        #expect(store.eventsByStatus.map { $0.status } == [.confirmed, .corroborated, .reported, .unverified, .disputed])
    }

    @Test func statusFilterIsSentToRepository() async {
        let store = EventsStore(repository: MockEventsRepository(delay: .zero))
        store.statusFilter = .disputed
        await store.refresh()
        #expect(store.events.map(\.id) == ["minister"])
    }
}
