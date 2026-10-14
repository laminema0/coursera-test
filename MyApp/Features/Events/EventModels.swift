import Foundation

// Mirrors GET /v1/events (backend/src/events-api.ts). Codable so the last response can be cached on disk;
// the cache writes the same snake_case JSON the API sends.

struct EventsResponse: Codable, Equatable, Sendable {
    let generatedAt: Date
    let events: [NewsEvent]
}

/// One real-world incident, with every independent source that reported it.
struct NewsEvent: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let title: String
    let firstSeenAt: Date
    let lastUpdatedAt: Date
    let keyTerms: [String]
    /// Higher = more important right now (sources, momentum, casualties, official alerts, recency).
    let importance: Double
    /// Developing story: new in the last 6 hours and still gaining sources or carrying official/casualty news.
    let breaking: Bool
    let newOriginsLastHour: Int
    /// Earliest report from a news or official source (social posts excluded).
    let firstReport: FirstReport?
    /// How the status changed over time, oldest first (⚪ → 🟡 → 🟢 → ✅ …).
    let statusHistory: [StatusChange]
    let verification: Verification
    let numbers: [NumberSummary]
    /// Numbers that so far appear only in social posts (unverified chatter).
    let chatterOnly: [ChatterOnly]
    let statements: [StatementSummary]
    /// Worldwide coverage (GDELT): how far the story has spread. Not confirmation.
    let coverage: Coverage?
    let origins: [EventOrigin]
}

struct StatusChange: Codable, Hashable, Sendable {
    let status: VerificationStatus
    let at: Date
    let confirming: Int
}

struct FirstReport: Codable, Hashable, Sendable {
    let sourceId: String
    let sourceName: String
    let at: Date
}

struct Coverage: Codable, Hashable, Sendable {
    let outlets: Int
    let countries: Int
    let firstSeenAt: Date?
    let checkedAt: Date
}

enum VerificationStatus: String, Codable, Hashable, Sendable, CaseIterable {
    case unverified, reported, corroborated, confirmed, disputed, retracted

    /// Unknown values from a newer backend are shown as unverified (the safe choice).
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = VerificationStatus(rawValue: raw) ?? .unverified
    }
}

struct Verification: Codable, Hashable, Sendable {
    let status: VerificationStatus
    /// Plain-language reason, e.g. "4 independent sources report it, 2 with strong editorial standards."
    let reason: String
    let confirming: Int
    let disputing: Int
    let primary: Int
    let tier1: Int
    let signals: Int
    /// State-funded outlets reporting on their own country. Shown, but not counted as independent confirmation.
    let stateMediaOwnCountry: Int
}

enum CountKind: String, Codable, Hashable, Sendable {
    case killed, injured, missing, arrested, evacuated, displaced, magnitude, unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CountKind(rawValue: raw) ?? .unknown
    }
}

struct NumberSummary: Codable, Hashable, Sendable {
    struct MostReported: Codable, Hashable, Sendable {
        let value: Double
        /// How many independent sources report this value as their latest.
        let origins: Int
    }

    struct Official: Codable, Hashable, Sendable {
        let value: Double
        let at: Date
        let sourceId: String
    }

    struct Report: Codable, Hashable, Sendable {
        let value: Double
        let qualifier: String
        let attribution: String
        let official: Bool
        let sourceId: String
        let at: Date
    }

    let kind: CountKind
    let min: Double
    let max: Double
    let mostReported: MostReported
    let latestOfficial: Official?
    let timeline: [Report]
    /// Numbers social posts mention for this kind (unverified), most mentioned first.
    let chatter: [ChatterValue]

    var isRange: Bool { min != max }
}

struct ChatterValue: Codable, Hashable, Sendable {
    let value: Double
    let mentions: Int
}

struct ChatterOnly: Codable, Hashable, Sendable {
    let kind: CountKind
    let values: [ChatterValue]
}

struct StatementSummary: Codable, Hashable, Sendable {
    let speaker: String
    let asserts: Int
    let denies: Int
    let confirms: Int
}

/// One independent origin (an outlet, a wire agency, an official body, or social signals).
struct EventOrigin: Codable, Hashable, Sendable {
    enum Kind: String, Codable, Hashable, Sendable {
        case primary, wire, outlet, signal
    }

    struct Article: Identifiable, Codable, Hashable, Sendable {
        let id: String
        let title: String
        let url: URL
        let sourceId: String
        let sourceName: String
        let publishedAt: Date
    }

    let key: String
    let kind: Kind
    let tier: String
    let articles: [Article]
}
