import SwiftUI

/// Text styles built on Dynamic Type, so they scale with the user's settings.
public extension Font {
    static let dsLargeTitle = Font.largeTitle.weight(.bold)
    static let dsTitle = Font.title2.weight(.semibold)
    static let dsHeadline = Font.headline
    static let dsBody = Font.body
    static let dsCaption = Font.caption
    /// Story headlines: a serif face, like a news page.
    static let dsStoryTitle = Font.system(.title3, design: .serif).weight(.semibold)
    static let dsStoryTitleLarge = Font.system(.title2, design: .serif).weight(.semibold)
    /// Small uppercase labels (badges, tags, section eyebrows).
    static let dsTag = Font.caption2.weight(.semibold).monospaced()
    /// Large figures such as the most-reported death toll.
    static let dsFigure = Font.system(.largeTitle, design: .monospaced).weight(.medium)
    /// Medium figures (tallies).
    static let dsFigureSmall = Font.system(.title2, design: .monospaced).weight(.medium)
    /// Times and values in timelines.
    static let dsMono = Font.footnote.monospacedDigit()
}
