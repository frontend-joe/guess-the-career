import UIKit
import UserNotifications

/// The one thing SwiftUI has no equivalent for.
///
/// Remote notifications are still delivered to a UIApplicationDelegate and to
/// a UNUserNotificationCenterDelegate, with no SwiftUI modifier that replaces
/// either, so the app keeps a delegate for these four callbacks and nothing
/// else. Everything they learn is handed straight to PushStore.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set here rather than when permission is asked for, because a
        // notification tapped while the app was NOT running is delivered
        // moments after launch — and only to a delegate that was already in
        // place. Setting it later loses exactly the tap that matters most.
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in PushStore.shared.received(deviceToken: deviceToken) }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in PushStore.shared.failedToRegister(error) }
    }

    /// Somebody tapped the notification.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        guard let invite = PushStore.invite(from: userInfo) else { return }
        await MainActor.run { PushStore.shared.pendingInvite = invite }
    }

    /// Arrived while the app was open and on screen.
    ///
    /// Shown anyway. The alternative is swallowing it, and the one case this
    /// happens in is the case it must not be swallowed in: you are sitting in
    /// a game that has stopped working, looking at the screen, and somebody
    /// has just started a new one for you to come to.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
