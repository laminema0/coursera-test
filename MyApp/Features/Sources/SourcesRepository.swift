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

struct MockSourcesRepository: SourcesRepository {
    func fetchSources() async throws -> SourcesResponse {
        SourcesResponse(sources: [
            NewsSourceInfo(
                id: "bbc-world", name: "BBC News – World", tier: "1", owner: "bbc", country: "GB",
                stateFunded: false, healthy: true, lastSuccessAt: .now, trackRecord: .init(
                    eventsSettled: 40, numbersChecked: 12, numbersClose: 9, numbersHigh: 0, numbersLow: 3, disputedOrRetracted: 1
                )
            ),
            NewsSourceInfo(
                id: "usgs-quakes", name: "USGS – Earthquakes", tier: "primary", owner: "usgs", country: "US",
                stateFunded: false, healthy: true, lastSuccessAt: .now, trackRecord: nil
            )
        ])
    }
}
