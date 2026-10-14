import CoreNetworking
import Foundation

protocol FeedRepository: Sendable {
    /// - Parameter since: `generatedAt` of the previous response, to receive removals since then.
    func fetchFeed(since: Date?) async throws -> FeedResponse
}

struct LiveFeedRepository: FeedRepository {
    let apiClient: APIClientProtocol
    var limit = 100

    func fetchFeed(since: Date?) async throws -> FeedResponse {
        var query = [URLQueryItem(name: "limit", value: String(limit))]
        if let since {
            query.append(URLQueryItem(name: "since", value: since.ISO8601Format()))
        }
        return try await apiClient.send(Endpoint<FeedResponse>(path: "feed", queryItems: query))
    }
}

struct MockFeedRepository: FeedRepository {
    var delay: Duration = .milliseconds(400)

    func fetchFeed(since: Date?) async throws -> FeedResponse {
        try await Task.sleep(for: delay)
        return FeedResponse(generatedAt: .now, stories: Self.sampleStories, removedPostIds: [])
    }

    static let sampleStories: [NewsStory] = {
        let reuters = XAuthor(
            id: "1", username: "Reuters", name: "Reuters", profileImageUrl: nil, verified: true, verifiedType: "business"
        )
        let associatedPress = XAuthor(
            id: "2", username: "AP", name: "The Associated Press", profileImageUrl: nil, verified: true, verifiedType: "business"
        )
        func post(_ id: String, _ author: XAuthor, _ text: String, minutesAgo: Double) -> XPost {
            XPost(
                id: id,
                text: text,
                createdAt: .now.addingTimeInterval(-minutesAgo * 60),
                lang: "en",
                possiblySensitive: false,
                permalink: URL(string: "https://x.com/\(author.username)/status/\(id)")!,
                author: author,
                metrics: XPostMetrics(likeCount: 120, repostCount: 40, replyCount: 12, quoteCount: 3)
            )
        }
        return (1...8).map { index in
            NewsStory(
                id: "story-\(index)",
                url: URL(string: "https://example.com/news/\(index)")!,
                publisher: "example.com",
                title: "Sample headline \(index)",
                summary: "Short summary from the publisher's page for story \(index).",
                imageUrl: nil,
                firstSeenAt: .now.addingTimeInterval(Double(-index) * 600),
                lastActivityAt: .now.addingTimeInterval(Double(-index) * 300),
                posts: [
                    post("\(index)01", reuters, "Breaking: sample news \(index) https://t.co/x", minutesAgo: Double(index) * 5),
                    post("\(index)02", associatedPress, "More on sample news \(index) https://t.co/y", minutesAgo: Double(index) * 6)
                ]
            )
        }
    }()
}
