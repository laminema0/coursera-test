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
    let feedRepository: FeedRepository
    let eventsRepository: EventsRepository
    let sourcesRepository: SourcesRepository

    init(
        configuration: AppConfiguration,
        apiClient: APIClientProtocol,
        keyValueStore: KeyValueStore,
        feedRepository: FeedRepository,
        eventsRepository: EventsRepository,
        sourcesRepository: SourcesRepository
    ) {
        self.configuration = configuration
        self.apiClient = apiClient
        self.keyValueStore = keyValueStore
        self.feedRepository = feedRepository
        self.eventsRepository = eventsRepository
        self.sourcesRepository = sourcesRepository
    }

    static func live(configuration: AppConfiguration = .current) -> AppContainer {
        let apiClient = APIClient(baseURL: configuration.apiBaseURL)
        let feedRepository: FeedRepository = configuration.useMockData
            ? MockFeedRepository()
            : LiveFeedRepository(apiClient: apiClient)
        let eventsRepository: EventsRepository = configuration.useMockData
            ? MockEventsRepository()
            : LiveEventsRepository(apiClient: apiClient)
        let sourcesRepository: SourcesRepository = configuration.useMockData
            ? MockSourcesRepository()
            : LiveSourcesRepository(apiClient: apiClient)
        return AppContainer(
            configuration: configuration,
            apiClient: apiClient,
            keyValueStore: UserDefaultsStore(),
            feedRepository: feedRepository,
            eventsRepository: eventsRepository,
            sourcesRepository: sourcesRepository
        )
    }

    /// Used by SwiftUI previews and tests: no network, no disk.
    static func preview() -> AppContainer {
        let configuration = AppConfiguration.preview
        return AppContainer(
            configuration: configuration,
            apiClient: APIClient(baseURL: configuration.apiBaseURL),
            keyValueStore: InMemoryKeyValueStore(),
            feedRepository: MockFeedRepository(delay: .zero),
            eventsRepository: MockEventsRepository(delay: .zero),
            sourcesRepository: MockSourcesRepository()
        )
    }
}
