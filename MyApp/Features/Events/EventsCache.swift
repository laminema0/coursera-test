import CoreNetworking
import Foundation

/// Keeps the last events response so the app shows stories instantly on launch and while offline.
protocol EventsCaching: Sendable {
    func load() -> EventsResponse?
    func save(_ response: EventsResponse)
}

/// JSON file in the Caches directory. The system may delete it under storage pressure; that is fine.
struct FileEventsCache: EventsCaching {
    let fileURL: URL

    static func standard(fileManager: FileManager = .default) -> FileEventsCache {
        let directory = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first ?? fileManager.temporaryDirectory
        return FileEventsCache(fileURL: directory.appendingPathComponent("events-v1.json"))
    }

    func load() -> EventsResponse? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder.api.decode(EventsResponse.self, from: data)
    }

    func save(_ response: EventsResponse) {
        guard let data = try? JSONEncoder.api.encode(response) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}

/// For tests and previews.
final class InMemoryEventsCache: EventsCaching, @unchecked Sendable {
    // @unchecked: access to `stored` is guarded by `lock`.
    private let lock = NSLock()
    private var stored: EventsResponse?

    init(_ response: EventsResponse? = nil) {
        stored = response
    }

    func load() -> EventsResponse? {
        lock.withLock { stored }
    }

    func save(_ response: EventsResponse) {
        lock.withLock { stored = response }
    }
}

extension JSONEncoder {
    /// Writes JSON the way the API sends it, so `JSONDecoder.api` reads it back.
    static var api: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(date.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
        }
        return encoder
    }
}
