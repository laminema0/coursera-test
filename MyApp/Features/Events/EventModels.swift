import Foundation

// Mirrors GET /v1/events (backend/src/events-api.ts).

struct EventsResponse: Decodable, Equatable, Sendable {
    let generatedAt: Date
    let events: [NewsEvent]
}

/// One real-world incident, with every independent source that reported it.
struct NewsEvent: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    let title: String
    let firstSeenAt: Date
    let lastUpdatedAt: Date
    let keyTerms: [String]
    let verification: Verification
    let numbers: [NumberSummary]
    let statements: [StatementSummary]
    let origins: [EventOrigin]
}

enum VerificationStatus: String, Decodable, Hashable, Sendable, CaseIterable {
    case unverified, reported, corroborated, confirmed, disputed, retracted

    /// Unknown values from a newer backend are shown as unverified (the safe choice).
    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = VerificationStatus(rawValue: raw) ?? .unverified
    }
}

struct Verification: Decodable, Hashable, Sendable {
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

enum CountKind: String, Decodable, Hashable, Sendable {
    case killed, injured, missing, arrested, evacuated, displaced, magnitude, unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CountKind(rawValue: raw) ?? .unknown
    }
}

struct NumberSummary: Decodable, Hashable, Sendable {
    struct MostReported: Decodable, Hashable, Sendable {
        let value: Double
        /// How many independent sources report this value as their latest.
        let origins: Int
    }

    struct Official: Decodable, Hashable, Sendable {
        let value: Double
        let at: Date
        let sourceId: String
    }

    struct Report: Decodable, Hashable, Sendable {
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

    var isRange: Bool { min != max }
}

struct StatementSummary: Decodable, Hashable, Sendable {
    let speaker: String
    let asserts: Int
    let denies: Int
    let confirms: Int
}

/// One independent origin (an outlet, a wire agency, an official body, or social signals).
struct EventOrigin: Decodable, Hashable, Sendable {
    enum Kind: String, Decodable, Hashable, Sendable {
        case primary, wire, outlet, signal
    }

    struct Article: Identifiable, Decodable, Hashable, Sendable {
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
