import Foundation

// Mirrors GET /v1/sources (backend/src/server.ts).

struct SourcesResponse: Decodable, Equatable, Sendable {
    let sources: [NewsSourceInfo]
}

struct NewsSourceInfo: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    let name: String
    /// "1", "2", "primary" or "signal".
    let tier: String
    /// Sources with the same owner are not independent of each other.
    let owner: String
    let country: String
    let stateFunded: Bool
    let healthy: Bool
    let lastSuccessAt: Date?
    let trackRecord: TrackRecord?

    struct TrackRecord: Decodable, Hashable, Sendable {
        let eventsSettled: Int
        let numbersChecked: Int
        let numbersClose: Int
        let numbersHigh: Int
        let numbersLow: Int
        let disputedOrRetracted: Int

        /// Share of first-reported numbers within 10 % of the final official figure, once there is enough data.
        var earlyAccuracy: Double? {
            numbersChecked >= 5 ? Double(numbersClose) / Double(numbersChecked) : nil
        }
    }
}
