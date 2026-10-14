import Foundation

// Display helpers for events. Foundation only, so they are unit-tested on Linux too.

enum DisplayText {
    /// "14", "6.1", "1,200". Whole numbers have no decimals; others one decimal.
    static func number(_ value: Double, locale: Locale = .current) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)).locale(locale))
    }

    /// "1 source", "3 sources".
    static func count(_ count: Int, _ singular: String, _ plural: String) -> String {
        "\(count) \(count == 1 ? singular : plural)"
    }
}

extension CountKind {
    var label: String {
        switch self {
        case .killed: NSLocalizedString("Killed", comment: "Event display text")
        case .injured: NSLocalizedString("Injured", comment: "Event display text")
        case .missing: NSLocalizedString("Missing", comment: "Event display text")
        case .arrested: NSLocalizedString("Arrested", comment: "Event display text")
        case .evacuated: NSLocalizedString("Evacuated", comment: "Event display text")
        case .displaced: NSLocalizedString("Displaced", comment: "Event display text")
        case .magnitude: NSLocalizedString("Magnitude", comment: "Event display text")
        case .unknown: NSLocalizedString("Other figure", comment: "Event display text")
        }
    }
}

extension EventOrigin.Kind {
    /// Official sources first, social posts last (they never count).
    static let displayOrder: [EventOrigin.Kind] = [.primary, .wire, .outlet, .signal]

    var label: String {
        switch self {
        case .primary: NSLocalizedString("Official source", comment: "Event display text")
        case .wire: NSLocalizedString("Wire agency", comment: "Event display text")
        case .outlet: NSLocalizedString("News outlet", comment: "Event display text")
        case .signal: NSLocalizedString("Social posts", comment: "Event display text")
        }
    }

    var groupTitle: String {
        switch self {
        case .primary: NSLocalizedString("Official", comment: "Event display text")
        case .wire: NSLocalizedString("Wire agencies", comment: "Event display text")
        case .outlet: NSLocalizedString("News outlets", comment: "Event display text")
        case .signal: NSLocalizedString("Social posts", comment: "Event display text")
        }
    }

    /// Social posts are early signals only; they never confirm anything.
    var isCounted: Bool { self != .signal }
}

extension EventOrigin {
    /// "BBC News" or "BBC News + 2 more" when several publishers carry the same origin (e.g. a wire story).
    var displayName: String {
        var names: [String] = []
        for article in articles where !names.contains(article.sourceName) {
            names.append(article.sourceName)
        }
        guard let first = names.first else { return key }
        return names.count > 1 ? "\(first) + \(names.count - 1) more" : first
    }
}

struct OriginGroup: Identifiable, Hashable {
    let kind: EventOrigin.Kind
    let origins: [EventOrigin]

    var id: EventOrigin.Kind { kind }
}

extension NumberSummary {
    /// "5–15" when sources disagree, nil when they all report the same value.
    func rangeText(locale: Locale = .current) -> String? {
        guard isRange else { return nil }
        return "\(DisplayText.number(min, locale: locale))–\(DisplayText.number(max, locale: locale))"
    }

    /// One row per source, value and time (a publisher's several feeds can carry the same report).
    var uniqueTimeline: [Report] {
        var seen = Set<String>()
        return timeline.filter { seen.insert("\($0.sourceId)|\($0.value)|\($0.at.timeIntervalSince1970)").inserted }
    }
}

extension NumberSummary.Report {
    /// "at least", "about"… Empty for exact values.
    var qualifierText: String {
        switch qualifier {
        case "atLeast": NSLocalizedString("at least", comment: "Event display text")
        case "moreThan": NSLocalizedString("more than", comment: "Event display text")
        case "upTo": NSLocalizedString("up to", comment: "Event display text")
        case "about": NSLocalizedString("about", comment: "Event display text")
        default: ""
        }
    }

    var isFromWitnesses: Bool { attribution == "witness" }
}

extension Array where Element == ChatterValue {
    /// "20 (3×), 50 (1×)".
    func chatterText(locale: Locale = .current) -> String {
        map { "\(DisplayText.number($0.value, locale: locale)) (\($0.mentions)×)" }.joined(separator: ", ")
    }
}

extension NewsEvent {
    /// Casualty figures first, magnitude last.
    var orderedNumbers: [NumberSummary] {
        numbers.filter { $0.kind != .magnitude } + numbers.filter { $0.kind == .magnitude }
    }

    var originGroups: [OriginGroup] {
        EventOrigin.Kind.displayOrder.compactMap { kind in
            let matching = origins.filter { $0.kind == kind }
            return matching.isEmpty ? nil : OriginGroup(kind: kind, origins: matching)
        }
    }

    /// "6 independent · 1 official · 1 disputing · 2 social".
    var tallySummary: String {
        let check = verification
        let comment = "Event tally, e.g. 6 independent · 1 official"
        var parts = [String(format: NSLocalizedString("%ld independent", comment: comment), check.confirming)]
        if check.primary > 0 { parts.append(String(format: NSLocalizedString("%ld official", comment: comment), check.primary)) }
        if check.disputing > 0 { parts.append(String(format: NSLocalizedString("%ld disputing", comment: comment), check.disputing)) }
        if check.signals > 0 { parts.append(String(format: NSLocalizedString("%ld social", comment: comment), check.signals)) }
        return parts.joined(separator: " · ")
    }

    /// Source name for a source id, taken from this event's articles.
    func sourceName(for sourceId: String) -> String {
        for origin in origins {
            if let article = origin.articles.first(where: { $0.sourceId == sourceId }) {
                return article.sourceName
            }
        }
        return sourceId
    }
}

extension URL {
    /// SFSafariViewController only accepts http(s) URLs.
    var isWebURL: Bool {
        guard let scheme = scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }
}
