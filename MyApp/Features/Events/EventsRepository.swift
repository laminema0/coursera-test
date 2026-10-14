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
}
