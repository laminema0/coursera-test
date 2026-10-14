import CoreNetworking
import Foundation

/// Data source for the Home feature. View models depend on this protocol only.
protocol HomeRepository: Sendable {
    func fetchItems() async throws -> [Item]
}

struct LiveHomeRepository: HomeRepository {
    let apiClient: APIClientProtocol

    func fetchItems() async throws -> [Item] {
        try await apiClient.send(Endpoint<[Item]>(path: "items"))
    }
}

struct MockHomeRepository: HomeRepository {
    var delay: Duration = .milliseconds(600)

    func fetchItems() async throws -> [Item] {
        try await Task.sleep(for: delay)
        return (1...20).map {
            Item(id: "\($0)", title: "Item \($0)", subtitle: "Sample description for item \($0)")
        }
    }
}
