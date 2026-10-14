import CoreNetworking
import Foundation
import Observation

/// Holds the current verified events. Data layer only; screens come in the UI phase.
@MainActor
@Observable
final class EventsStore {
    private(set) var events: [NewsEvent] = []
    private(set) var lastUpdated: Date?
    private(set) var lastError: String?
    private(set) var isLoading = false
    var statusFilter: VerificationStatus?

    private let repository: EventsRepository

    init(repository: EventsRepository) {
        self.repository = repository
    }

    /// Events grouped by status, most trustworthy first. Disputed and retracted stay visible on purpose.
    var eventsByStatus: [(status: VerificationStatus, events: [NewsEvent])] {
        let order: [VerificationStatus] = [.confirmed, .corroborated, .reported, .unverified, .disputed, .retracted]
        return order.compactMap { status in
            let matching = events.filter { $0.verification.status == status }
            return matching.isEmpty ? nil : (status, matching)
        }
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await repository.fetchEvents(status: statusFilter)
            events = response.events
            lastUpdated = response.generatedAt
            lastError = nil
        } catch is CancellationError {
            return
        } catch let error as APIError {
            lastError = error.userMessage
        } catch {
            lastError = error.localizedDescription
        }
    }
}
