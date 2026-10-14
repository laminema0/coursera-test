import CoreNetworking
import Foundation
import Observation

/// Holds the current news feed and keeps it in sync with the backend.
/// UI will observe this later; for now it is the data layer only.
@MainActor
@Observable
final class FeedStore {
    private(set) var stories: [NewsStory] = []
    private(set) var lastSyncedAt: Date?
    private(set) var lastError: String?
    private(set) var isSyncing = false

    private let repository: FeedRepository

    init(repository: FeedRepository) {
        self.repository = repository
    }

    func sync() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            let response = try await repository.fetchFeed(since: lastSyncedAt)
            apply(response)
            lastError = nil
        } catch is CancellationError {
            return
        } catch let error as APIError {
            lastError = error.userMessage
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// The server's list is authoritative. Removed post ids are also applied, so that any
    /// on-device copies (cache, bookmarks in later phases) drop posts that were deleted on X.
    func apply(_ response: FeedResponse) {
        let removed = Set(response.removedPostIds)
        stories = response.stories.compactMap { story in
            let posts = story.posts.filter { !removed.contains($0.id) }
            return posts.isEmpty ? nil : story.replacingPosts(posts)
        }
        lastSyncedAt = response.generatedAt
    }
}

private extension NewsStory {
    func replacingPosts(_ posts: [XPost]) -> NewsStory {
        NewsStory(
            id: id, url: url, publisher: publisher, title: title, summary: summary, imageUrl: imageUrl,
            firstSeenAt: firstSeenAt, lastActivityAt: lastActivityAt, posts: posts
        )
    }
}
