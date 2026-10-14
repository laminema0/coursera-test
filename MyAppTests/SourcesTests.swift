import CoreNetworking
import Foundation
@testable import MyApp
import Testing

struct SourcesTests {
    @Test func decodesSourcesWithTrackRecord() throws {
        let json = """
        { "sources": [
          { "id": "bbc-world", "name": "BBC", "tier": "1", "owner": "bbc", "country": "GB", "state_funded": false,
            "healthy": true, "last_success_at": "2026-10-14T10:00:00.000Z",
            "track_record": { "events_settled": 20, "numbers_checked": 10, "numbers_close": 8, "numbers_high": 1,
              "numbers_low": 1, "disputed_or_retracted": 0 } },
          { "id": "new", "name": "New", "tier": "signal", "owner": "reddit", "country": "INT", "state_funded": false, "healthy": false }
        ] }
        """
        let response = try JSONDecoder.api.decode(SourcesResponse.self, from: Data(json.utf8))
        #expect(response.sources.first?.trackRecord?.earlyAccuracy == 0.8)
        #expect(response.sources.last?.trackRecord == nil)
        #expect(response.sources.last?.lastSuccessAt == nil)
    }

    @Test func accuracyNeedsEnoughData() {
        let record = NewsSourceInfo.TrackRecord(
            eventsSettled: 3, numbersChecked: 2, numbersClose: 2, numbersHigh: 0, numbersLow: 0, disputedOrRetracted: 0
        )
        #expect(record.earlyAccuracy == nil)
    }
}
