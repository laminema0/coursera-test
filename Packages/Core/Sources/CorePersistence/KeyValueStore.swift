import Foundation

/// Simple typed key-value storage. Use for preferences and small flags.
public protocol KeyValueStore: AnyObject, Sendable {
    func value<T: Codable>(_ type: T.Type, forKey key: String) -> T?
    func set<T: Codable>(_ value: T?, forKey key: String)
}

public extension KeyValueStore {
    func bool(forKey key: String) -> Bool {
        value(Bool.self, forKey: key) ?? false
    }
}

/// Backed by `UserDefaults`. Values are stored as JSON data.
public final class UserDefaultsStore: KeyValueStore, @unchecked Sendable {
    // @unchecked: UserDefaults is thread-safe.
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func value<T: Codable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    public func set<T: Codable>(_ value: T?, forKey key: String) {
        guard let value, let data = try? JSONEncoder().encode(value) else {
            defaults.removeObject(forKey: key)
            return
        }
        defaults.set(data, forKey: key)
    }
}

/// For tests and SwiftUI previews.
public final class InMemoryKeyValueStore: KeyValueStore, @unchecked Sendable {
    // @unchecked: access to `storage` is guarded by `lock`.
    private var storage: [String: Data] = [:]
    private let lock = NSLock()

    public init() {}

    public func value<T: Codable>(_ type: T.Type, forKey key: String) -> T? {
        lock.withLock { storage[key] }.flatMap { try? JSONDecoder().decode(T.self, from: $0) }
    }

    public func set<T: Codable>(_ value: T?, forKey key: String) {
        let data = value.flatMap { try? JSONEncoder().encode($0) }
        lock.withLock { storage[key] = data }
    }
}
