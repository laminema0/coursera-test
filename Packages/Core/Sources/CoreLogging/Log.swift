import Foundation
#if canImport(OSLog)
import OSLog
#endif

/// Central place for loggers. Add a category per subsystem area.
/// View logs in Console.app, filtered by subsystem.
public enum Log {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.example.myapp"

    public static let app = Logger(subsystem: subsystem, category: "app")
    public static let network = Logger(subsystem: subsystem, category: "network")
    public static let persistence = Logger(subsystem: subsystem, category: "persistence")
    public static let ui = Logger(subsystem: subsystem, category: "ui")
}

#if !canImport(OSLog)
/// Minimal stand-in for `os.Logger` on platforms without OSLog (Linux CI, server-side Swift).
/// Supports the same call sites, including `\(value, privacy: .public)`.
public struct Logger: Sendable {
    public struct Privacy: Sendable {
        public static let `public` = Privacy()
        public static let `private` = Privacy()
    }

    public struct Message: ExpressibleByStringInterpolation, Sendable {
        public struct StringInterpolation: StringInterpolationProtocol {
            var text = ""
            public init(literalCapacity: Int, interpolationCount: Int) {}
            public mutating func appendLiteral(_ literal: String) { text += literal }
            public mutating func appendInterpolation<T>(_ value: T, privacy: Privacy = .private) { text += "\(value)" }
        }

        let text: String
        public init(stringLiteral value: String) { text = value }
        public init(stringInterpolation: StringInterpolation) { text = stringInterpolation.text }
    }

    private let label: String

    public init(subsystem: String, category: String) {
        label = "\(subsystem).\(category)"
    }

    public func debug(_ message: Message) { write("debug", message) }
    public func info(_ message: Message) { write("info", message) }
    public func error(_ message: Message) { write("error", message) }

    private func write(_ level: String, _ message: Message) {
        FileHandle.standardError.write(Data("[\(label)] \(level): \(message.text)\n".utf8))
    }
}
#endif
