import BackgroundTasks
import Foundation
import UserNotifications

/// Local notifications (no push server or paid developer account needed).
enum StoryNotifier {
    /// Asks once; iOS remembers the answer. Returns whether alerts may be shown.
    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        default:
            return (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        }
    }

    static func post(_ alerts: [StoryAlert]) async {
        let center = UNUserNotificationCenter.current()
        for alert in alerts {
            let content = UNMutableNotificationContent()
            content.title = alert.heading
            content.body = alert.title
            content.sound = .default
            content.threadIdentifier = "stories"
            content.userInfo = ["eventId": alert.eventId]
            try? await center.add(UNNotificationRequest(identifier: alert.identifier, content: content, trigger: nil))
        }
    }
}

/// Background app refresh: iOS wakes the app now and then (it decides when) to check for news.
enum BackgroundRefresh {
    /// Must match BGTaskSchedulerPermittedIdentifiers in project.yml.
    static let taskIdentifier = "com.example.myapp.refresh-events"

    /// Asks for the next wake-up in about 15 minutes. Call when the app goes to the background.
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func run(_ update: BackgroundEventsUpdate) async {
        schedule()
        let alerts = await update.run()
        await StoryNotifier.post(alerts)
    }
}
