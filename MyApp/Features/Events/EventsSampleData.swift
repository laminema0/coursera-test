import Foundation

// Sample events for previews and mock mode: one per status, with history, numbers, chatter,
// statements and every kind of origin. Built with small helpers to keep type checking fast.

extension MockEventsRepository {
    static let sample: [NewsEvent] = [
        SampleEvents.quake(),
        SampleEvents.shooting(),
        SampleEvents.minister(),
        SampleEvents.port(),
        SampleEvents.rumor(),
        SampleEvents.bridge()
    ]
}

private enum SampleEvents {
    static func ago(_ minutes: Double) -> Date {
        Date.now.addingTimeInterval(-minutes * 60)
    }

    static func article(_ id: String, _ sourceId: String, _ source: String, _ title: String, minutesAgo: Double) -> EventOrigin.Article {
        EventOrigin.Article(
            id: id, title: title, url: URL(string: "https://example.com/\(id)")!,
            sourceId: sourceId, sourceName: source, publishedAt: ago(minutesAgo)
        )
    }

    static func origin(_ kind: EventOrigin.Kind, _ key: String, tier: String, _ articles: [EventOrigin.Article]) -> EventOrigin {
        EventOrigin(key: key, kind: kind, tier: tier, articles: articles)
    }

    static func step(_ status: VerificationStatus, minutesAgo: Double, confirming: Int) -> StatusChange {
        StatusChange(status: status, at: ago(minutesAgo), confirming: confirming)
    }

    static func report(
        _ value: Double, _ qualifier: String, _ sourceId: String, minutesAgo: Double, official: Bool = false
    ) -> NumberSummary.Report {
        NumberSummary.Report(
            value: value, qualifier: qualifier, attribution: official ? "official" : "media",
            official: official, sourceId: sourceId, at: ago(minutesAgo)
        )
    }

    struct Draft {
        var id: String
        var title: String
        var status: VerificationStatus
        var reason: String
        var confirming = 0
        var disputing = 0
        var primary = 0
        var tier1 = 0
        var signals = 0
        var breaking = false
        var history: [StatusChange] = []
        var firstReport: FirstReport?
        var numbers: [NumberSummary] = []
        var chatterOnly: [ChatterOnly] = []
        var statements: [StatementSummary] = []
        var coverage: Coverage?
        var origins: [EventOrigin] = []

        func build() -> NewsEvent {
            let verification = Verification(
                status: status, reason: reason, confirming: confirming, disputing: disputing,
                primary: primary, tier1: tier1, signals: signals, stateMediaOwnCountry: 0
            )
            return NewsEvent(
                id: id, title: title, firstSeenAt: history.first?.at ?? ago(120), lastUpdatedAt: ago(5),
                keyTerms: [], importance: Double(confirming), breaking: breaking,
                newOriginsLastHour: breaking ? 2 : 0, firstReport: firstReport, statusHistory: history,
                verification: verification, numbers: numbers, chatterOnly: chatterOnly,
                statements: statements, coverage: coverage, origins: origins
            )
        }
    }

    static func quake() -> NewsEvent {
        var draft = Draft(
            id: "quake", title: "Turkey earthquake: Strong quake hits Malatya province", status: .confirmed,
            reason: "Confirmed by an official source, plus 5 independent sources."
        )
        draft.confirming = 6
        draft.primary = 1
        draft.tier1 = 3
        draft.signals = 2
        draft.breaking = true
        draft.history = [step(.unverified, minutesAgo: 125, confirming: 0), step(.confirmed, minutesAgo: 120, confirming: 1)]
        draft.firstReport = FirstReport(sourceId: "usgs", sourceName: "USGS", at: ago(120))
        draft.numbers = [quakeKilled(), quakeMagnitude()]
        draft.coverage = Coverage(outlets: 87, countries: 23, firstSeenAt: ago(115), checkedAt: ago(10))
        draft.origins = quakeOrigins()
        return draft.build()
    }

    static func quakeKilled() -> NumberSummary {
        let timeline = [
            report(5, "atLeast", "bbc-world", minutesAgo: 90, official: true),
            report(14, "atLeast", "npr", minutesAgo: 40),
            report(14, "atLeast", "reuters", minutesAgo: 35),
            report(15, "exact", "dw-en", minutesAgo: 10, official: true)
        ]
        return NumberSummary(
            kind: .killed, min: 5, max: 15,
            mostReported: .init(value: 14, origins: 2),
            latestOfficial: .init(value: 15, at: ago(10), sourceId: "dw-en"),
            timeline: timeline,
            chatter: [ChatterValue(value: 20, mentions: 3), ChatterValue(value: 50, mentions: 1)]
        )
    }

    static func quakeMagnitude() -> NumberSummary {
        NumberSummary(
            kind: .magnitude, min: 6.1, max: 6.1, mostReported: .init(value: 6.1, origins: 4),
            latestOfficial: .init(value: 6.1, at: ago(120), sourceId: "usgs"),
            timeline: [report(6.1, "exact", "usgs", minutesAgo: 120, official: true)], chatter: []
        )
    }

    static func quakeOrigins() -> [EventOrigin] {
        [
            origin(.primary, "primary:usgs", tier: "primary", [
                article("q1", "usgs", "USGS", "M 6.1 earthquake – 20 km S of Malatya, Turkey", minutesAgo: 120)
            ]),
            origin(.wire, "wire:reuters", tier: "1", [
                article("q2", "reuters", "Reuters", "Strong earthquake shakes eastern Turkey", minutesAgo: 35),
                article("q3", "abc-au", "ABC News (AU)", "Strong earthquake shakes eastern Turkey — Reuters", minutesAgo: 30)
            ]),
            origin(.outlet, "outlet:bbc", tier: "1", [
                article("q4", "bbc-world", "BBC News – World", "Turkey earthquake: at least five dead in Malatya", minutesAgo: 90)
            ]),
            origin(.outlet, "outlet:dw", tier: "1", [
                article("q5", "dw-en", "DW", "Turkey quake death toll rises to 15", minutesAgo: 10)
            ]),
            origin(.outlet, "outlet:npr", tier: "1", [
                article("q6", "npr", "NPR", "Quake in Turkey kills at least 14", minutesAgo: 40)
            ]),
            origin(.signal, "signal:reddit", tier: "signal", [
                article("q7", "reddit-worldnews", "Reddit r/worldnews", "Huge quake just now in Malatya??", minutesAgo: 124)
            ])
        ]
    }

    static func shooting() -> NewsEvent {
        var draft = Draft(
            id: "shooting", title: "Police: 3 dead, 8 injured in Columbus mall shooting", status: .corroborated,
            reason: "4 independent sources report it, 2 with strong editorial standards."
        )
        draft.confirming = 4
        draft.tier1 = 2
        draft.signals = 1
        draft.breaking = true
        draft.history = [
            step(.unverified, minutesAgo: 70, confirming: 0),
            step(.reported, minutesAgo: 55, confirming: 1),
            step(.corroborated, minutesAgo: 30, confirming: 3)
        ]
        draft.firstReport = FirstReport(sourceId: "wosu", sourceName: "WOSU", at: ago(55))
        draft.numbers = [
            NumberSummary(
                kind: .killed, min: 3, max: 3, mostReported: .init(value: 3, origins: 4), latestOfficial: nil,
                timeline: [report(3, "exact", "npr", minutesAgo: 30)], chatter: []
            ),
            NumberSummary(
                kind: .injured, min: 6, max: 8, mostReported: .init(value: 8, origins: 3), latestOfficial: nil,
                timeline: [report(6, "atLeast", "wosu", minutesAgo: 55), report(8, "exact", "npr", minutesAgo: 30)],
                chatter: [ChatterValue(value: 12, mentions: 2)]
            )
        ]
        draft.origins = [
            origin(.wire, "wire:ap", tier: "1", [
                article("s1", "ap", "AP", "3 killed in shooting at Ohio mall, police say", minutesAgo: 28)
            ]),
            origin(.outlet, "outlet:npr", tier: "1", [
                article("s2", "npr", "NPR", "Police: 3 dead, 8 injured in Columbus mall shooting", minutesAgo: 30)
            ]),
            origin(.outlet, "outlet:wosu", tier: "2", [
                article("s3", "wosu", "WOSU", "Shots fired at Easton mall, several hurt", minutesAgo: 55)
            ]),
            origin(.signal, "signal:reddit", tier: "signal", [
                article("s4", "reddit-columbus", "Reddit r/Columbus", "Anyone know what's happening at Easton?", minutesAgo: 70)
            ])
        ]
        return draft.build()
    }

    static func minister() -> NewsEvent {
        var draft = Draft(
            id: "minister", title: "Finance ministry denies minister said country would default", status: .disputed,
            reason: "2 independent sources report it; 1 reports a denial or calls it false."
        )
        draft.confirming = 2
        draft.disputing = 1
        draft.tier1 = 1
        draft.history = [step(.reported, minutesAgo: 100, confirming: 1), step(.disputed, minutesAgo: 45, confirming: 2)]
        draft.statements = [
            StatementSummary(speaker: "Finance minister Karl Weber", asserts: 2, denies: 0, confirms: 0),
            StatementSummary(speaker: "Finance ministry", asserts: 0, denies: 1, confirms: 0)
        ]
        draft.origins = [
            origin(.outlet, "outlet:guardian", tier: "1", [
                article("m1", "guardian-world", "The Guardian", "Minister hints at default in closed meeting", minutesAgo: 100)
            ]),
            origin(.outlet, "outlet:euronews", tier: "2", [
                article("m2", "euronews", "Euronews", "Ministry: reports of default remarks are false", minutesAgo: 45)
            ])
        ]
        return draft.build()
    }

    static func port() -> NewsEvent {
        var draft = Draft(
            id: "port", title: "Explosion reported at Riverside port", status: .reported,
            reason: "Only one independent source so far (others may be copies)."
        )
        draft.confirming = 1
        draft.signals = 2
        draft.history = [step(.unverified, minutesAgo: 25, confirming: 0), step(.reported, minutesAgo: 15, confirming: 1)]
        draft.chatterOnly = [ChatterOnly(kind: .missing, values: [ChatterValue(value: 4, mentions: 3)])]
        draft.origins = [
            origin(.outlet, "outlet:local", tier: "2", [
                article("p1", "riverside-herald", "Riverside Herald", "Blast heard at Riverside port, smoke visible", minutesAgo: 15)
            ]),
            origin(.signal, "signal:reddit", tier: "signal", [
                article("p2", "reddit-news", "Reddit r/news", "Massive explosion at the port, 4 workers missing", minutesAgo: 25)
            ])
        ]
        return draft.build()
    }

    static func rumor() -> NewsEvent {
        var draft = Draft(
            id: "rumor", title: "Reports of power outage across the capital", status: .unverified,
            reason: "Only social media posts so far. Not confirmed by any news or official source."
        )
        draft.signals = 3
        draft.history = [step(.unverified, minutesAgo: 8, confirming: 0)]
        draft.origins = [
            origin(.signal, "signal:bluesky", tier: "signal", [
                article("r1", "bluesky", "Bluesky", "Whole city dark right now?", minutesAgo: 8)
            ])
        ]
        return draft.build()
    }

    static func bridge() -> NewsEvent {
        var draft = Draft(
            id: "bridge", title: "Outlet withdraws report of bridge collapse on A9", status: .retracted,
            reason: "A news source published a correction: the bridge was closed, not collapsed."
        )
        draft.confirming = 1
        draft.history = [
            step(.reported, minutesAgo: 300, confirming: 1),
            step(.retracted, minutesAgo: 200, confirming: 1)
        ]
        draft.origins = [
            origin(.outlet, "outlet:regional", tier: "2", [
                article("b1", "regional-news", "Regional News", "Correction: A9 bridge closed, not collapsed", minutesAgo: 200)
            ])
        ]
        return draft.build()
    }
}
