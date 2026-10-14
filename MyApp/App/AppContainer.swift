import CoreNetworking
import CorePersistence
import Foundation
import Observation

/// Dependency container. Built once at launch and injected through the SwiftUI environment.
/// Add new services here; features receive only the protocols they need.
@MainActor
@Observable
final class AppContainer {
    let configuration: AppConfiguration
    let apiClient: APIClientProtocol
    let keyValueStore: KeyValueStore
    let homeRepository: HomeRepository

    init(
        configuration: AppConfiguration,
        apiClient: APIClientProtocol,
        keyValueStore: KeyValueStore,
        homeRepository: HomeRepository
    ) {
        self.configuration = configuration
        self.apiClient = apiClient
        self.keyValueStore = keyValueStore
        self.homeRepository = homeRepository
    }

    static func live(configuration: AppConfiguration = .current) -> AppContainer {
        let apiClient = APIClient(baseURL: configuration.apiBaseURL)
        let homeRepository: HomeRepository = configuration.useMockData
            ? MockHomeRepository()
            : LiveHomeRepository(apiClient: apiClient)
        return AppContainer(
            configuration: configuration,
            apiClient: apiClient,
            keyValueStore: UserDefaultsStore(),
            homeRepository: homeRepository
        )
    }

    /// Used by SwiftUI previews and tests: no network, no disk.
    static func preview() -> AppContainer {
        let configuration = AppConfiguration.preview
        return AppContainer(
            configuration: configuration,
            apiClient: APIClient(baseURL: configuration.apiBaseURL),
            keyValueStore: InMemoryKeyValueStore(),
            homeRepository: MockHomeRepository(delay: .zero)
        )
    }
}
