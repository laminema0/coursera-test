import SwiftUI
import UIKit

/// The six trust levels an event can have, from "only social posts" to "an official source says so".
/// The app maps its own model onto this so the design system stays free of app types.
public enum TrustStatus: String, CaseIterable, Identifiable, Sendable {
    case unverified, reported, corroborated, confirmed, disputed, retracted

    public var id: String { rawValue }

    /// Short name shown on badges and read by VoiceOver.
    public var label: String {
        switch self {
        case .unverified: String(localized: "Unverified")
        case .reported: String(localized: "Reported")
        case .corroborated: String(localized: "Corroborated")
        case .confirmed: String(localized: "Confirmed")
        case .disputed: String(localized: "Disputed")
        case .retracted: String(localized: "Retracted")
        }
    }

    /// What the status means, for legends and onboarding.
    public var explanation: String {
        switch self {
        case .unverified:
            String(localized: "Only social posts, or only state media of the country involved.")
        case .reported:
            String(localized: "One independent source, or two from outlets with weaker standards.")
        case .corroborated:
            String(localized: "Three or more independent sources, or two including a strong-standards outlet or wire.")
        case .confirmed:
            String(localized: "An official source reports it: USGS, a government, the UN.")
        case .disputed:
            String(localized: "An independent source reports a denial or calls it false.")
        case .retracted:
            String(localized: "A news or official source published a correction or retraction.")
        }
    }

    /// Semantic color for the status. Adapts to light and dark mode.
    public var color: Color {
        switch self {
        case .unverified: .dsStatusUnverified
        case .reported: .dsStatusReported
        case .corroborated: .dsStatusCorroborated
        case .confirmed: .dsStatusConfirmed
        case .disputed: .dsStatusDisputed
        case .retracted: .dsStatusRetracted
        }
    }

    /// Unverified is drawn as a hollow dot: nothing backs it yet.
    public var isHollow: Bool { self == .unverified }
}

/// Status and "unverified chatter" colors. Light values are darkened a little from the web demo
/// so small text keeps enough contrast on white.
public extension Color {
    static let dsStatusUnverified = Color(light: 0x6B7380, dark: 0x8D96A5)
    static let dsStatusReported = Color(light: 0xA36A00, dark: 0xE3A92A)
    static let dsStatusCorroborated = Color(light: 0x1F8A4C, dark: 0x3FBF72)
    static let dsStatusConfirmed = Color(light: 0x0F6FB8, dark: 0x4AA6F0)
    static let dsStatusDisputed = Color(light: 0xCC2F2F, dark: 0xFF6B6B)
    static let dsStatusRetracted = Color(light: 0x3D3F46, dark: 0xB3B6BF)
    /// Numbers that appear only in social posts. Always shown apart from verified figures.
    static let dsChatter = Color(light: 0x7A4DB3, dark: 0xB48CF0)

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
