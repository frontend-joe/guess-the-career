import Foundation
import UIKit
import UserNotifications

/// Notifications, from the phone's side.
///
/// The server's half of this is services/push.ts; this half owns three facts.
/// The APNs device token, which Apple hands over asynchronously and reissues
/// without warning. The device secret, handed back once by the server and the
/// credential for every later call. And the invite a tapped notification is
/// asking us to open.
///
/// Registration is deliberately tied to having a seat. The people being
/// notified have no accounts — that is the point of joining with a code and a
/// typed name — so "a game you are in right now" is the only proof of
/// invitation the app can offer, and the server asks for exactly that on a
/// first registration. In practice this costs nothing: you join one game by
/// link, as always, and from then on the games come to you.
@Observable
@MainActor
final class PushStore {
    static let shared = PushStore()

    /// Set by a tapped notification, consumed by the app's scene, which hands
    /// it to the same `handleInvite` a tapped link goes through. The round
    /// trip through a URL rather than a bare code is on purpose: there is one
    /// path into a room and this is not a second one.
    var pendingInvite: URL?

    private(set) var deviceToken: String?
    private(set) var secret: String? { didSet { Defaults.secret = secret } }
    private(set) var muted: Bool = false { didSet { Defaults.muted = muted } }

    private var registering = false

    private init() {
        secret = Defaults.secret
        muted = Defaults.muted
    }

    // MARK: - Permission

    /// Ask once, at the moment the answer means something.
    ///
    /// Called when you enter a room, because that is the first point where
    /// "we'll tell you when the next one starts" explains itself. Asking on a
    /// cold launch, before the person has seen what the app is, spends the one
    /// chance iOS gives you — a declined prompt never reappears, and the only
    /// way back is Settings.
    func enableIfNeeded() async {
        guard !Defaults.hasAsked else {
            // Already asked, so re-register silently if we are allowed to. A
            // token is per-install, and this is what picks it up again after
            // the app was deleted and put back.
            if await isAuthorized() { UIApplication.shared.registerForRemoteNotifications() }
            return
        }
        // Not asked until the server can actually deliver one. See
        // API.pushAvailable(); the flag is set only once we commit to asking,
        // so a build that runs before the credentials exist asks later rather
        // than never.
        guard await API.pushAvailable() else { return }
        Defaults.hasAsked = true
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            guard granted else { return }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            // A refusal is not an error worth showing anybody. The app works.
            print("push: authorization failed: \(error)")
        }
    }

    func isAuthorized() async -> Bool {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus == .authorized ||
            settings.authorizationStatus == .provisional
    }

    // MARK: - The token

    /// Apple has handed us a token. It arrives as bytes and APNs wants the hex.
    func received(deviceToken data: Data) {
        let hex = data.map { String(format: "%02x", $0) }.joined()
        guard hex != deviceToken else { return }
        deviceToken = hex
        Task { await sync() }
    }

    func failedToRegister(_ error: Error) {
        // Routine in the Simulator, which has no push support at all, and so
        // not worth surfacing. Real devices fail here when the app is signed
        // without the push entitlement, which is worth seeing in a log.
        print("push: registration failed: \(error)")
    }

    /// Tell the server our token, if we are in a position to be believed.
    ///
    /// Safe to call as often as anything changes: with a secret it is an
    /// update, and without one it needs a seat, so it simply waits until the
    /// next time somebody joins a game.
    func sync() async {
        guard let token = deviceToken, !registering else { return }
        if secret == nil && SeatStore.load() == nil { return }
        registering = true
        defer { registering = false }
        do {
            let result = try await API.registerPushDevice(
                token: token,
                secret: secret,
                participantToken: secret == nil ? SeatStore.load()?.token : nil,
                displayName: Defaults.displayName
            )
            secret = result.secret
            muted = result.muted
        } catch let failure as API.Failure where failure.status == 404 {
            // The server has never heard of this secret — the database was
            // rebuilt, or this is a restored backup. Drop it and register from
            // scratch next time there is a seat to prove ourselves with.
            secret = nil
        } catch {
            print("push: register failed: \(error)")
        }
    }

    /// Remember the name this phone's owner plays under, so the server can say
    /// whose phone a token belongs to without guessing.
    func noteDisplayName(_ name: String) {
        guard !name.isEmpty, name != Defaults.displayName else { return }
        Defaults.displayName = name
        Task { await sync() }
    }

    /// The token to hand to create/join, so a host's own phone is known to the
    /// server before it sends the invite that must skip it.
    var tokenForJoin: String? { deviceToken }

    /// A secret the server handed back on a create or join, which is the first
    /// registration for a host — they hold a user session, not the participant
    /// token `sync()` would otherwise need.
    func adopt(secret handed: String?) {
        guard let handed, handed != secret else { return }
        secret = handed
    }

    // MARK: - Being left alone

    func setMuted(_ value: Bool) async {
        guard let secret else { return }
        let previous = muted
        muted = value
        do {
            muted = try await API.setPushMuted(secret: secret, muted: value)
        } catch {
            muted = previous
            print("push: mute failed: \(error)")
        }
    }

    // MARK: - Arrival

    /// What a notification is asking us to open. Apple's own keys are ignored;
    /// `code` is ours, put there by services/push.ts.
    static func invite(from userInfo: [AnyHashable: Any]) -> URL? {
        guard let code = userInfo["code"] as? String, !code.isEmpty else { return nil }
        return URL(string: "https://guessthelist.xyz/join/\(code)")
    }
}

/// Small enough to keep beside the store rather than in its own file, and
/// deliberately not part of SeatStore: a push token outlives a seat, which is
/// the whole reason it is persisted separately.
private enum Defaults {
    private static let secretKey = "gtl.push.secret"
    private static let mutedKey = "gtl.push.muted"
    private static let askedKey = "gtl.push.asked"
    private static let nameKey = "gtl.push.name"

    static var secret: String? {
        get { UserDefaults.standard.string(forKey: secretKey) }
        set {
            if let newValue { UserDefaults.standard.set(newValue, forKey: secretKey) }
            else { UserDefaults.standard.removeObject(forKey: secretKey) }
        }
    }

    static var muted: Bool {
        get { UserDefaults.standard.bool(forKey: mutedKey) }
        set { UserDefaults.standard.set(newValue, forKey: mutedKey) }
    }

    static var hasAsked: Bool {
        get { UserDefaults.standard.bool(forKey: askedKey) }
        set { UserDefaults.standard.set(newValue, forKey: askedKey) }
    }

    static var displayName: String? {
        get { UserDefaults.standard.string(forKey: nameKey) }
        set { UserDefaults.standard.set(newValue, forKey: nameKey) }
    }
}
