import SwiftUI

/// Text styles built on Dynamic Type, so they scale with the user's settings.
public extension Font {
    static let dsLargeTitle = Font.largeTitle.weight(.bold)
    static let dsTitle = Font.title2.weight(.semibold)
    static let dsHeadline = Font.headline
    static let dsBody = Font.body
    static let dsCaption = Font.caption
}
