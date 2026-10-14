import Foundation
import OSLog

/// Central place for loggers. Add a category per subsystem area.
/// View logs in Console.app, filtered by subsystem.
public enum Log {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.example.myapp"

    public static let app = Logger(subsystem: subsystem, category: "app")
    public static let network = Logger(subsystem: subsystem, category: "network")
    public static let persistence = Logger(subsystem: subsystem, category: "persistence")
    public static let ui = Logger(subsystem: subsystem, category: "ui")
}
