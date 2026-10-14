import CoreNetworking
import Foundation

protocol SourcesRepository: Sendable {
    func fetchSources() async throws -> SourcesResponse
}

struct LiveSourcesRepository: SourcesRepository {
    let apiClient: APIClientProtocol

    func fetchSources() async throws -> SourcesResponse {
        try await apiClient.send(Endpoint<SourcesResponse>(path: "sources"))
    }
}

/// Sample sources covering every tier, an unhealthy feed and a state-funded outlet.
struct MockSourcesRepository: SourcesRepository {
    func fetchSources() async throws -> SourcesResponse {
        SourcesResponse(sources: Self.sample)
    }

    static let sample: [NewsSourceInfo] = [
        NewsSourceInfo(
            id: "bbc-world", name: "BBC News – World", tier: "1", owner: "bbc", country: "GB",
            stateFunded: false, healthy: true, lastSuccessAt: .now, trackRecord: .init(
                eventsSettled: 40, numbersChecked: 12, numbersClose: 9, numbersHigh: 0, numbersLow: 3, disputedOrRetracted: 1
            )
        ),
        NewsSourceInfo(
            id: "usgs-quakes", name: "USGS – Earthquakes", tier: "primary", owner: "usgs", country: "US",
            stateFunded: false, healthy: true, lastSuccessAt: .now, trackRecord: nil
        ),
        NewsSourceInfo(
            id: "npr", name: "NPR News", tier: "1", owner: "npr", country: "US",
            stateFunded: false, healthy: true, lastSuccessAt: .now.addingTimeInterval(-600), trackRecord: .init(
                eventsSettled: 6, numbersChecked: 3, numbersClose: 3, numbersHigh: 0, numbersLow: 0, disputedOrRetracted: 0
            )
        ),
        NewsSourceInfo(
            id: "dw-en", name: "DW", tier: "1", owner: "dw", country: "DE",
            stateFunded: true, healthy: true, lastSuccessAt: .now.addingTimeInterval(-1_200), trackRecord: nil
        ),
        NewsSourceInfo(
            id: "riverside-herald", name: "Riverside Herald", tier: "2", owner: "herald-group", country: "US",
            stateFunded: false, healthy: false, lastSuccessAt: .now.addingTimeInterval(-14_400), trackRecord: nil
        ),
        NewsSourceInfo(
            id: "reddit-worldnews", name: "Reddit r/worldnews", tier: "signal", owner: "reddit", country: "INT",
            stateFunded: false, healthy: true, lastSuccessAt: .now, trackRecord: nil
        )
    ]
}
