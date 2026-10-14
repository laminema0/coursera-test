import SwiftUI

/// Semantic colors. They adapt to light/dark mode automatically.
/// Replace with brand colors from the design file when it is ready.
public extension Color {
    static let dsBackground = Color(uiColor: .systemBackground)
    static let dsSecondaryBackground = Color(uiColor: .secondarySystemBackground)
    static let dsTextPrimary = Color(uiColor: .label)
    static let dsTextSecondary = Color(uiColor: .secondaryLabel)
    static let dsSeparator = Color(uiColor: .separator)
    static let dsBrand = Color.accentColor
    static let dsSuccess = Color.green
    static let dsWarning = Color.orange
    static let dsError = Color.red
}
