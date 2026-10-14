import CoreNetworking
@testable import MyApp
import Testing

private struct StubHomeRepository: HomeRepository {
    let result: Result<[Item], Error>

    func fetchItems() async throws -> [Item] {
        try result.get()
    }
}

@MainActor
struct HomeViewModelTests {
    private let sample = [Item(id: "1", title: "One", subtitle: "First")]

    @Test func loadSuccessShowsItems() async {
        let viewModel = HomeViewModel(repository: StubHomeRepository(result: .success(sample)))
        await viewModel.load()
        #expect(viewModel.state == .loaded(sample))
    }

    @Test func loadFailureShowsUserMessage() async {
        let error = APIError.transport(.notConnectedToInternet)
        let viewModel = HomeViewModel(repository: StubHomeRepository(result: .failure(error)))
        await viewModel.load()
        #expect(viewModel.state == .failed(error.userMessage))
    }
}
