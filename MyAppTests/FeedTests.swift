import CoreNetworking
import Foundation
@testable import MyApp
import Testing

private final class RecordingFeedRepository: FeedRepository, @unchecked Sendable {
    // @unchecked: only touched from the main actor in these tests.
    var responses: [FeedResponse]
    private(set) var sinceValues: [Date?] = []

    init(responses: [FeedResponse]) {
        self.responses = responses
    }

    func fetchFeed(since: Date?) async throws -> FeedResponse {
        sinceValues.append(since)
        return responses.removeFirst()
    }
}

@MainActor
struct FeedTests {
    private static let json = """
    {
      "generated_at": "2026-10-14T10:00:00.123Z",
      "stories": [{
        "id": "abc", "url": "https://reuters.com/a", "publisher": "reuters.com",
        "title": "Quake", "summary": "Details", "image_url": "https://img.test/a.jpg",
        "first_seen_at": "2026-10-14T09:00:00.000Z", "last_activity_at": "2026-10-14T09:30:00.000Z",
        "posts": [{
          "id": "101", "text": "Quake hits https://t.co/1", "created_at": "2026-10-14T09:30:00.000Z",
          "lang": "en", "possibly_sensitive": false, "permalink": "https://x.com/Reuters/status/101",
          "author": { "id": "u1", "username": "Reuters", "name": "Reuters", "verified": true },
          "metrics": { "like_count": 1, "repost_count": 2, "reply_count": 3, "quote_count": 4 }
        }]
      }],
      "removed_post_ids": ["99"]
    }
    """

    @Test func decodesBackendFeed() throws {
        let feed = try JSONDecoder.api.decode(FeedResponse.self, from: Data(Self.json.utf8))
        let story = try #require(feed.stories.first)
        #expect(story.imageUrl == URL(string: "https://img.test/a.jpg"))
        #expect(story.posts.first?.author.username == "Reuters")
        #expect(story.posts.first?.metrics?.repostCount == 2)
        #expect(feed.removedPostIds == ["99"])
    }

    @Test func syncPassesPreviousTimestampAndDropsRemovedPosts() async throws {
        let first = try JSONDecoder.api.decode(FeedResponse.self, from: Data(Self.json.utf8))
        let second = FeedResponse(
            generatedAt: first.generatedAt.addingTimeInterval(60),
            stories: first.stories,
            removedPostIds: ["101"]
        )
        let repository = RecordingFeedRepository(responses: [first, second])
        let store = FeedStore(repository: repository)

        await store.sync()
        #expect(store.stories.count == 1)

        await store.sync()
        #expect(repository.sinceValues == [nil, first.generatedAt])
        #expect(store.stories.isEmpty, "story whose only post was removed disappears")
    }
}
