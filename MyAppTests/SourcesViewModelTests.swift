import CoreNetworking
import Foundation
@testable import MyApp
import Testing

private struct StubSourcesRepository: SourcesRepository {
    let result: Result<[NewsSourceInfo], Error>

    func fetchSources() async throws -> SourcesResponse {
        SourcesResponse(sources: try result.get())
    }
}

@MainActor
struct SourcesViewModelTests {
    private static func source(_ id: String, tier: String, owner: String = "x", healthy: Bool = true) -> NewsSourceInfo {
        NewsSourceInfo(
            id: id, name: id.capitalized, tier: tier, owner: owner, country: "GB",
            stateFunded: false, healthy: healthy, lastSuccessAt: nil, trackRecord: nil
        )
    }

    private let sources = [
        source("reddit", tier: "signal"),
        source("npr", tier: "1", owner: "npr"),
        source("bbc", tier: "1", owner: "bbc", healthy: false),
        source("usgs", tier: "primary"),
        source("local", tier: "2"),
        source("odd", tier: "beta")
    ]

    @Test func groupsByTierOfficialFirst() async {
        let viewModel = SourcesViewModel(repository: StubSourcesRepository(result: .success(sources)))
        await viewModel.load()
        #expect(viewModel.sections.map(\.tier) == ["primary", "1", "2", "signal", "beta"])
        #expect(viewModel.sections[1].sources.map(\.id) == ["bbc", "npr"], "alphabetical inside a tier")
        #expect(viewModel.unhealthyCount == 1)
    }

    @Test func searchMatchesNameAndOwner() async {
        let viewModel = SourcesViewModel(repository: StubSourcesRepository(result: .success(sources)))
        await viewModel.load()
        viewModel.searchText = "BBC "
        #expect(viewModel.sections.flatMap(\.sources).map(\.id) == ["bbc"])
        viewModel.searchText = "nothing-like-this"
        #expect(viewModel.sections.isEmpty)
    }

    @Test func failureShowsUserMessage() async {
        let error = APIError.httpStatus(code: 503, body: Data())
        let viewModel = SourcesViewModel(repository: StubSourcesRepository(result: .failure(error)))
        await viewModel.load()
        #expect(viewModel.state == .failed(error.userMessage))
    }

    @Test func tierLabelsAndAccuracy() {
        #expect(Self.source("a", tier: "primary").tierLabel == "Official")
        #expect(Self.source("a", tier: "signal").countsAsConfirmation == false)
        let record = NewsSourceInfo.TrackRecord(
            eventsSettled: 10, numbersChecked: 8, numbersClose: 6, numbersHigh: 1, numbersLow: 1, disputedOrRetracted: 0
        )
        #expect(record.earlyAccuracyText(locale: Locale(identifier: "en_US")) == "75%")
        let thin = NewsSourceInfo.TrackRecord(
            eventsSettled: 1, numbersChecked: 1, numbersClose: 1, numbersHigh: 0, numbersLow: 0, disputedOrRetracted: 0
        )
        #expect(thin.earlyAccuracyText() == nil)
    }
}
