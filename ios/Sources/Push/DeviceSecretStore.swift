import Foundation
import Security

/// Where the device secret lives, which is not UserDefaults.
///
/// The secret is the handset. The server issues it once, the app keeps it,
/// and offering it is what says "the phone that registered before is this
/// phone" — a push token cannot do that job, because Apple issues a different
/// one for the sandbox and the production gateway, so the same iPhone moving
/// from an Xcode build to TestFlight arrives looking brand new. See
/// registerDevice in services/push.ts.
///
/// It was in UserDefaults, and deleting the app wipes UserDefaults. So every
/// reinstall came back a stranger: a new device row, and — because
/// game_participants.device_id is how a guest with no account is recognised
/// coming back — a new seat in the room beside the old one. Nine device rows
/// for four handsets, and a room that grew a card for everybody on the day
/// they all updated.
///
/// The Keychain survives app deletion, which is the one property needed here
/// and the only reason to prefer it. Two deliberate choices:
///
///   - kSecAttrAccessibleAfterFirstUnlock, not WhenUnlocked. Registration can
///     run from a token callback while the phone is sitting locked in a
///     pocket, and WhenUnlocked would fail there — silently, since nothing
///     about push notifications is on screen at that moment.
///
///   - NOT synchronizable. An iCloud-synced secret would hand the same handset
///     identity to every device on the account, which is this exact bug
///     inverted: two phones claiming one row, one seat, one tile in the
///     recording. The secret is about a handset, so it stays on the handset.
enum DeviceSecretStore {
    private static let service = "xyz.guessthelist.push"
    private static let account = "device-secret"
    /// The old home, read once so nobody loses the seat they already have.
    private static let legacyKey = "gtl.push.secret"

    static func load() -> String? {
        if let keyed = read() { return keyed }
        // Migration, and it only ever runs once per install: a phone that has
        // registered before keeps its row and its seat instead of being told
        // it is new. Removed from UserDefaults afterwards so there is one
        // answer to this question rather than two that can disagree.
        guard let legacy = UserDefaults.standard.string(forKey: legacyKey) else { return nil }
        save(legacy)
        UserDefaults.standard.removeObject(forKey: legacyKey)
        return legacy
    }

    static func save(_ secret: String?) {
        guard let secret, !secret.isEmpty else { return clear() }
        guard let data = secret.data(using: .utf8) else { return }
        // Update in place where there is something to update, because
        // SecItemAdd on an existing item is errSecDuplicateItem rather than an
        // overwrite.
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecSuccess { return }

        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(item as CFDictionary, nil)
        if status != errSecSuccess {
            // Worth a line and not worth more. The app works without this —
            // the next registration simply looks like a new phone, which is
            // the behaviour that existed before this file.
            print("push: could not store device secret (\(status))")
        }
    }

    static func clear() {
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ] as CFDictionary)
        UserDefaults.standard.removeObject(forKey: legacyKey)
    }

    private static func read() -> String? {
        var result: CFTypeRef?
        let status = SecItemCopyMatching([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ] as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
