import CoreNetworking
import Foundation
import Observation

/// One tier group on the sources screen.
struct SourceSection: Identifiable, Equatable {
    let tier: String
    let sources: [NewsSourceInfo]

    var id: String { tier }
    var title: String { NewsSourceInfo.tierGroupTitle(tier) }
}

@MainActor
@Observable
final class SourcesViewModel {
    enum State: Equatable {
        case idle
        case loading
        case loaded([NewsSourceInfo])
        case failed(String)
    }

    private(set) var state: State = .idle
    /// Filters by name, owner or country.
    var searchText = ""
    private let repository: SourcesRepository

    init(repository: SourcesRepository) {
        self.repository = repository
    }

    private var sources: [NewsSourceInfo] {
        if case .loaded(let sources) = state { return sources }
        return []
    }

    /// Official sources first, then tier 1, tier 2 and social signals; alphabetical inside a tier.
    var sections: [SourceSection] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        let matching = sources.filter { query.isEmpty || $0.matches(query) }
        let grouped = Dictionary(grouping: matching, by: \.tier)
        let known = NewsSourceInfo.tierOrder.filter { grouped[$0] != nil }
        let others = grouped.keys.filter { !NewsSourceInfo.tierOrder.contains($0) }.sorted()
        return (known + others).map { tier in
            let sorted = (grouped[tier] ?? []).sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            return SourceSection(tier: tier, sources: sorted)
        }
    }

    var unhealthyCount: Int {
        sources.filter { !$0.healthy }.count
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
        // Keep showing the list during pull-to-refresh.
        if !isLoaded {
            state = .loading
        }
        do {
            state = .loaded(try await repository.fetchSources().sources)
        } catch is CancellationError {
            // Screen went away; keep the current state.
        } catch let error as APIError {
            state = .failed(error.userMessage)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

extension NewsSourceInfo {
    static let tierOrder = ["primary", "1", "2", "signal"]

    /// Short tier label for a source row.
    var tierLabel: String {
        switch tier {
        case "primary": NSLocalizedString("Official", comment: "Source display text")
        case "1": NSLocalizedString("Tier 1", comment: "Source display text")
        case "2": NSLocalizedString("Tier 2", comment: "Source display text")
        case "signal": NSLocalizedString("Social signal", comment: "Source display text")
        default: tier.capitalized
        }
    }

    static func tierGroupTitle(_ tier: String) -> String {
        switch tier {
        case "primary": NSLocalizedString("Official sources", comment: "Source display text")
        case "1": NSLocalizedString("Tier 1 · strong editorial standards", comment: "Source display text")
        case "2": NSLocalizedString("Tier 2 · national and regional outlets", comment: "Source display text")
        case "signal": NSLocalizedString("Social signals · never counted as confirmation", comment: "Source display text")
        default: tier.capitalized
        }
    }

    /// Social signals are shown but never confirm a story.
    var countsAsConfirmation: Bool { tier != "signal" }

    func matches(_ query: String) -> Bool {
        [name, owner, country, id].contains { $0.localizedCaseInsensitiveContains(query) }
    }
}

extension NewsSourceInfo.TrackRecord {
    /// "75 % close" style percentage, only once there is enough data.
    func earlyAccuracyText(locale: Locale = .current) -> String? {
        earlyAccuracy.map { $0.formatted(.percent.precision(.fractionLength(0)).locale(locale)) }
    }
}
