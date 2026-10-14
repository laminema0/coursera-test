import CoreNetworking
import Foundation

protocol EventsRepository: Sendable {
    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse
}

struct LiveEventsRepository: EventsRepository {
    let apiClient: APIClientProtocol
    var limit = 200

    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        var query = [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "sort", value: "importance")]
        if let status {
            query.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        return try await apiClient.send(Endpoint<EventsResponse>(path: "events", queryItems: query))
    }
}

/// Sample events covering every status, for previews and mock mode.
struct MockEventsRepository: EventsRepository {
    var delay: Duration = .milliseconds(400)

    func fetchEvents(status: VerificationStatus?) async throws -> EventsResponse {
        try await Task.sleep(for: delay)
        let events = Self.sample.filter { status == nil || $0.verification.status == status }
        return EventsResponse(generatedAt: .now, events: events)
    }

    static let sample: [NewsEvent] = {
        func article(_ id: String, _ source: String, _ title: String, minutesAgo: Double) -> EventOrigin.Article {
            EventOrigin.Article(
                id: id, title: title, url: URL(string: "https://example.com/\(id)")!,
                sourceId: source, sourceName: source, publishedAt: .now.addingTimeInterval(-minutesAgo * 60)
            )
        }
        // Sample-data builder: many defaulted parameters keep each sample readable.
        // swiftlint:disable:next function_parameter_count
        func event(
            _ id: String, _ title: String, _ status: VerificationStatus, reason: String,
            confirming: Int, disputing: Int = 0, primary: Int = 0, tier1: Int = 0, signals: Int = 0,
            numbers: [NumberSummary] = [], statements: [StatementSummary] = [], origins: [EventOrigin]
        ) -> NewsEvent {
            NewsEvent(
                id: id, title: title, firstSeenAt: .now.addingTimeInterval(-7_200), lastUpdatedAt: .now.addingTimeInterval(-300),
                keyTerms: [], importance: Double(confirming), breaking: status == .confirmed || status == .corroborated,
                newOriginsLastHour: 0, firstReport: nil, verification: Verification(
                    status: status, reason: reason, confirming: confirming, disputing: disputing,
                    primary: primary, tier1: tier1, signals: signals, stateMediaOwnCountry: 0
                ),
                numbers: numbers, chatterOnly: [], statements: statements, coverage: nil, origins: origins
            )
        }
        let killed = NumberSummary(
            kind: .killed, min: 5, max: 15,
            mostReported: .init(value: 14, origins: 2),
            latestOfficial: .init(value: 15, at: .now.addingTimeInterval(-600), sourceId: "dw-en"),
            timeline: [],
            chatter: [ChatterValue(value: 20, mentions: 3)]
        )
        return [
            event(
                "quake", "Turkey earthquake: Strong quake hits Malatya province", .confirmed,
                reason: "Confirmed by an official source, plus 5 independent sources.",
                confirming: 6, primary: 1, tier1: 3, signals: 1, numbers: [killed],
                origins: [EventOrigin(key: "primary:usgs", kind: .primary, tier: "primary", articles: [
                    article("q1", "USGS", "M 6.1 earthquake – 20 km S of Malatya, Turkey", minutesAgo: 120)
                ])]
            ),
            event(
                "shooting", "Police: 3 dead, 8 injured in Columbus mall shooting", .corroborated,
                reason: "4 independent sources report it, 2 with strong editorial standards.",
                confirming: 4, tier1: 2, signals: 1,
                origins: [EventOrigin(key: "outlet:npr", kind: .outlet, tier: "1", articles: [
                    article("s1", "NPR", "Police: 3 dead, 8 injured in Columbus mall shooting", minutesAgo: 30)
                ])]
            ),
            event(
                "minister", "Finance ministry denies minister said country would default", .disputed,
                reason: "2 independent sources report it; 1 reports a denial or calls it false.",
                confirming: 2, disputing: 1, tier1: 1,
                statements: [StatementSummary(speaker: "Finance minister Karl Weber", asserts: 2, denies: 0, confirms: 0)],
                origins: []
            ),
            event(
                "port", "Explosion reported at Riverside port", .reported,
                reason: "Only one independent source so far (others may be copies).", confirming: 1, signals: 2, origins: []
            ),
            event(
                "rumor", "Reports of power outage across the capital", .unverified,
                reason: "Only social media posts so far. Not confirmed by any news or official source.",
                confirming: 0, signals: 3, origins: []
            )
        ]
    }()
}
