import Foundation
@testable import MyApp
import Testing

struct EventPresentationTests {
    private let english = Locale(identifier: "en_US")

    private func event(_ id: String) throws -> NewsEvent {
        try #require(MockEventsRepository.sample.first { $0.id == id })
    }

    @Test func formatsNumbers() {
        #expect(DisplayText.number(14, locale: english) == "14")
        #expect(DisplayText.number(6.1, locale: english) == "6.1")
        #expect(DisplayText.number(1_200, locale: english) == "1,200")
        #expect(DisplayText.count(1, "source", "sources") == "1 source")
        #expect(DisplayText.count(3, "source", "sources") == "3 sources")
    }

    @Test func numberCardFacts() throws {
        let quake = try event("quake")
        let killed = try #require(quake.orderedNumbers.first)
        #expect(killed.kind == .killed)
        #expect(quake.orderedNumbers.last?.kind == .magnitude, "magnitude goes last")
        #expect(killed.rangeText(locale: english) == "5–15")
        #expect(quake.orderedNumbers.last?.rangeText(locale: english) == nil)
        #expect(killed.chatter.chatterText(locale: english) == "20 (3×), 50 (1×)")
        #expect(killed.timeline.first?.qualifierText == "at least")
    }

    @Test func timelineDropsDuplicateRows() {
        let at = Date(timeIntervalSince1970: 100)
        let row = NumberSummary.Report(value: 3, qualifier: "exact", attribution: "media", official: false, sourceId: "bbc", at: at)
        let other = NumberSummary.Report(value: 4, qualifier: "exact", attribution: "media", official: false, sourceId: "bbc", at: at)
        let summary = NumberSummary(
            kind: .killed, min: 3, max: 4, mostReported: .init(value: 3, origins: 1), latestOfficial: nil,
            timeline: [row, row, other], chatter: []
        )
        #expect(summary.uniqueTimeline == [row, other])
    }

    @Test func originsAreGroupedOfficialFirstSocialLast() throws {
        let quake = try event("quake")
        #expect(quake.originGroups.map(\.kind) == [.primary, .wire, .outlet, .signal])
        #expect(quake.originGroups.first { $0.kind == .outlet }?.origins.count == 3)
        #expect(EventOrigin.Kind.signal.isCounted == false)
        #expect(EventOrigin.Kind.wire.isCounted)
    }

    @Test func wireOriginNamesItsRepublishers() throws {
        let wire = try #require(try event("quake").origins.first { $0.kind == .wire })
        #expect(wire.displayName == "Reuters + 1 more")
        let empty = EventOrigin(key: "outlet:x", kind: .outlet, tier: "2", articles: [])
        #expect(empty.displayName == "outlet:x")
    }

    @Test func tallySummaryListsOnlyNonZeroParts() throws {
        #expect(try event("quake").tallySummary == "6 independent · 1 official · 2 social")
        #expect(try event("minister").tallySummary == "2 independent · 1 disputing")
        #expect(try event("rumor").tallySummary == "0 independent · 3 social")
    }

    @Test func sourceNamesComeFromArticles() throws {
        let quake = try event("quake")
        #expect(quake.sourceName(for: "dw-en") == "DW")
        #expect(quake.sourceName(for: "unknown-id") == "unknown-id")
    }

    @Test func onlyWebLinksOpenInSafari() throws {
        #expect(try #require(URL(string: "https://example.com")).isWebURL)
        #expect(try #require(URL(string: "HTTP://example.com")).isWebURL)
        #expect(try #require(URL(string: "mailto:a@example.com")).isWebURL == false)
    }

    @Test func sampleCoversEveryStatus() {
        let statuses = Set(MockEventsRepository.sample.map(\.verification.status))
        #expect(statuses == Set(VerificationStatus.allCases))
    }
}
