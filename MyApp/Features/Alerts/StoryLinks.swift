import Observation
import SwiftUI
import UIKit
import UserNotifications

/// The story a tapped notification asked to open. The News tab consumes it.
@MainActor
@Observable
final class StoryLinks {
    static let shared = StoryLinks()

    var pendingEventId: String?
}

/// Receives notification taps (also on a cold launch) and hands the story to `StoryLinks`.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let eventId = response.notification.request.content.userInfo["eventId"] as? String else { return }
        await MainActor.run {
            StoryLinks.shared.pendingEventId = eventId
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
