import CoreNetworking
import Foundation
import Observation

@MainActor
@Observable
final class HomeViewModel {
    enum State: Equatable {
        case idle
        case loading
        case loaded([Item])
        case failed(String)
    }

    private(set) var state: State = .idle
    private let repository: HomeRepository

    init(repository: HomeRepository) {
        self.repository = repository
    }

    private var isLoaded: Bool {
        if case .loaded = state { return true }
        return false
    }

    func load() async {
        guard !isLoaded else { return }
        await refresh()
    }

    func refresh() async {
        // Keep showing loaded content during pull-to-refresh.
        if !isLoaded {
            state = .loading
        }
        do {
            state = .loaded(try await repository.fetchItems())
        } catch is CancellationError {
            // View disappeared; keep the current state.
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
