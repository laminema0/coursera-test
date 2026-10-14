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

    static let sampleStories: [NewsStory] = (1...8).map(sampleStory)

    private static let reuters = XAuthor(
        id: "1", username: "Reuters", name: "Reuters", profileImageUrl: nil, verified: true, verifiedType: "business"
    )
    private static let associatedPress = XAuthor(
        id: "2", username: "AP", name: "The Associated Press", profileImageUrl: nil, verified: true, verifiedType: "business"
    )

    private static func samplePost(id: String, author: XAuthor, text: String, minutesAgo: Double) -> XPost {
        let permalink = URL(string: "https://x.com/\(author.username)/status/\(id)")!
        return XPost(
            id: id,
            text: text,
            createdAt: Date.now.addingTimeInterval(-minutesAgo * 60),
            lang: "en",
            possiblySensitive: false,
            permalink: permalink,
            author: author,
            metrics: XPostMetrics(likeCount: 120, repostCount: 40, replyCount: 12, quoteCount: 3)
        )
    }

    private static func sampleStory(_ index: Int) -> NewsStory {
        let step = Double(index)
        let posts: [XPost] = [
            samplePost(id: "\(index)01", author: reuters, text: "Breaking: sample news \(index) https://t.co/x", minutesAgo: step * 5),
            samplePost(id: "\(index)02", author: associatedPress, text: "More on sample news \(index) https://t.co/y", minutesAgo: step * 6)
        ]
        return NewsStory(
            id: "story-\(index)",
            url: URL(string: "https://example.com/news/\(index)")!,
            publisher: "example.com",
            title: "Sample headline \(index)",
            summary: "Short summary from the publisher's page for story \(index).",
            imageUrl: nil,
            firstSeenAt: Date.now.addingTimeInterval(-step * 600),
            lastActivityAt: Date.now.addingTimeInterval(-step * 300),
            posts: posts
        )
    }
}
