import Foundation

// Mirrors the backend's GET /v1/feed response (backend/src/feed.ts).
// The app never calls the X API directly; see docs/X-INTEGRATION.md.

struct FeedResponse: Decodable, Equatable, Sendable {
    let generatedAt: Date
    let stories: [NewsStory]
    /// Posts deleted on X or expired. They must be removed from anything stored on the device.
    let removedPostIds: [String]
}

/// One article, plus the X posts that shared it.
struct NewsStory: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    let url: URL
    let publisher: String
    let title: String?
    let summary: String?
    let imageUrl: URL?
    let firstSeenAt: Date
    let lastActivityAt: Date
    let posts: [XPost]
}

struct XPost: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    /// Must be shown unmodified (X display requirements).
    let text: String
    let createdAt: Date
    let lang: String?
    let possiblySensitive: Bool
    /// Link back to the post on x.com. Required attribution.
    let permalink: URL
    let author: XAuthor
    let metrics: XPostMetrics?
}

struct XAuthor: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    let username: String
    let name: String
    let profileImageUrl: URL?
    let verified: Bool
    let verifiedType: String?
}

struct XPostMetrics: Decodable, Hashable, Sendable {
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int
    let quoteCount: Int
}
