import Foundation

// Talks to Railway directly rather than through Netlify.
//
// The web client's requests are proxied by Netlify, which buffers and breaks
// streaming responses — a constraint documented at length in the server's
// backfill service. None of it applies here: the app dials the origin, so the
// proxy's behaviour is simply not in the path.
enum API {
    static let baseURL = URL(string: "https://server-production-2e32.up.railway.app")!

    struct Failure: LocalizedError {
        let message: String
        let status: Int
        /// Whether this answer came from our own server, rather than from
        /// something in front of it. See `isGone`.
        let fromServer: Bool
        var errorDescription: String? { message }

        /// A seat that no longer exists, as opposed to a bad network moment.
        ///
        /// The status code is not enough on its own, and trusting it threw
        /// four people out of a live game at once. A deploy restarts the
        /// container, and while it is down Railway's edge answers in its
        /// place — with a 404, which is also exactly what this server returns
        /// for a room that does not exist. So every device read "your room is
        /// gone", deleted the seat it was sitting in, and dropped to the
        /// lobby, over a room that was perfectly fine.
        ///
        /// Our 404 and the edge's 404 are the same number. What tells them
        /// apart is the header, which can only be set by a process the
        /// request actually reached.
        var isGone: Bool { fromServer && (status == 403 || status == 404) }
    }

    private static let decoder: JSONDecoder = JSONDecoder()
    private static let encoder: JSONEncoder = JSONEncoder()

    private static func request(
        _ method: String,
        _ path: String,
        body: (any Encodable)? = nil,
        bearer: String? = nil
    ) async throws -> Data {
        // Resolved as a relative URL rather than appended as a path
        // component: appendingPathComponent treats the whole string as ONE
        // component and escapes the reserved characters in it, so a path
        // carrying a query string became
        // "api/tenable/rounds%3Fcategory=geography" and 404ed.
        let url = URL(string: path, relativeTo: baseURL) ?? baseURL.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let bearer { req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? decoder.decode(ServerError.self, from: data))?.error
                ?? "Request failed (\(status))"
            throw Failure(
                message: message,
                status: status,
                fromServer: http?.value(forHTTPHeaderField: "x-gtl-server") != nil,
            )
        }
        return data
    }

    private static func get<T: Decodable>(_ path: String, bearer: String? = nil) async throws -> T {
        try decoder.decode(T.self, from: try await request("GET", path, bearer: bearer))
    }

    private static func post<T: Decodable>(
        _ path: String, body: (any Encodable)? = nil, bearer: String? = nil
    ) async throws -> T {
        try decoder.decode(T.self, from: try await request("POST", path, body: body, bearer: bearer))
    }

    private struct ServerError: Decodable { let error: String }

    // MARK: - Auth

    static func signIn(email: String, password: String) async throws -> TokenPair {
        // A fixed label rather than UIDevice.current.name: that is main-actor
        // isolated, and it is the person's device name, which has no business
        // leaving the phone just to label a token.
        try await post("api/auth/token", body: [
            "email": email, "password": password,
            "deviceLabel": "iPhone", "platform": "ios",
        ])
    }

    /// The signed-in host's own account, which is where the name on their
    /// video tile comes from.
    ///
    /// Only the one field, and optional: the server sends the whole user row
    /// and a brand new account's display name is whatever its email started
    /// with, which is a thing to offer for editing rather than a thing to
    /// rely on.
    struct Account: Decodable {
        let displayName: String?
        enum CodingKeys: String, CodingKey { case displayName = "display_name" }
    }

    static func account(accessToken: String) async throws -> Account {
        try await get("api/auth/me", bearer: accessToken)
    }

    static func setDisplayName(_ name: String, accessToken: String) async throws -> Account {
        try decoder.decode(Account.self, from: try await request(
            "PATCH", "api/auth/me", body: ["displayName": name], bearer: accessToken,
        ))
    }

    // MARK: - Rooms

    /// A struct rather than a dictionary because the body is no longer all
    /// strings, and `encodeIfPresent` gives the same "omit, do not null"
    /// behaviour the dictionary gave for free.
    private struct CreateRoomBody: Encodable {
        let name: String?
        let pushToken: String?
        let pushPlatform: String?
        let video: Bool
        let deviceSecret: String?

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encodeIfPresent(name, forKey: .name)
            try c.encodeIfPresent(pushToken, forKey: .pushToken)
            try c.encodeIfPresent(pushPlatform, forKey: .pushPlatform)
            try c.encode(video, forKey: .video)
            try c.encodeIfPresent(deviceSecret, forKey: .deviceSecret)
        }

        enum CodingKeys: String, CodingKey { case name, pushToken, pushPlatform, video, deviceSecret }
    }

    static func createRoom(
        accessToken: String, name: String?, pushToken: String? = nil, video: Bool = true,
        deviceSecret: String? = nil
    ) async throws -> JoinedRoom {
        // Omit a key rather than sending null. Swift's synthesised encoder
        // writes an explicit null for a nil Optional, which is a different
        // thing on the wire from "absent" and not every schema treats them
        // alike.
        //
        // `video` is always sent: it is a decision the host made, and an
        // absent key means "yes" on the server.
        let body = CreateRoomBody(
            name: name,
            // The host's own phone, so the server can keep it off the invite
            // list it is about to send. Without this you buzz your own pocket
            // every time you start a game.
            pushToken: pushToken,
            pushPlatform: pushToken == nil ? nil : "ios",
            video: video,
            // What this phone was called last time. A push token changes —
            // sandbox and production issue different ones, so a move to
            // TestFlight looks like a new handset — and this does not.
            deviceSecret: deviceSecret
        )
        return try await post("api/rooms", body: body, bearer: accessToken)
    }

    static func joinRoom(
        code: String, displayName: String, pushToken: String? = nil,
        deviceSecret: String? = nil
    ) async throws -> JoinedRoom {
        var body = ["displayName": displayName, "platform": "ios"]
        if let pushToken { body["pushToken"] = pushToken }
        // What this phone was called last time, so a token that has changed
        // underneath us does not cost the player their seat. See the server's
        // registerDevice.
        if let deviceSecret { body["deviceSecret"] = deviceSecret }
        return try await post("api/rooms/\(code)/join", body: body)
    }

    /// `typing` rides the poll because a game with no video call has no data
    /// channel to carry a typing dot, and this request is already being made
    /// at the right cadence. nil says nothing either way, for a room where
    /// LiveKit is doing the job.
    static func roomState(seat: Seat, typing: Bool? = nil) async throws -> RoomState {
        let query = typing.map { "?typing=\($0 ? 1 : 0)" } ?? ""
        return try await get("api/rooms/\(seat.code)/state\(query)", bearer: seat.token)
    }

    static func livekitCredentials(seat: Seat) async throws -> LivekitCredentials {
        try await get("api/rooms/\(seat.code)/livekit-token", bearer: seat.token)
    }

    static func freezeRound(seat: Seat, roundId: Int) async throws -> FrozenRound {
        try await post("api/rooms/\(seat.code)/rounds", body: ["roundId": roundId], bearer: seat.token)
    }

    static func startRound(seat: Seat, instanceId: Int) async throws -> RoomState {
        try await post("api/rooms/\(seat.code)/rounds/\(instanceId)/start", bearer: seat.token)
    }

    static func guess(seat: Seat, instanceId: Int, raw: String) async throws -> GuessResult {
        try await post(
            "api/rooms/\(seat.code)/guess",
            // The idempotency key is made here and travels with the attempt, so
            // a retry on a bad connection is scored once.
            body: GuessBody(instanceId: instanceId, clientGuessId: UUID().uuidString, raw: raw),
            bearer: seat.token
        )
    }

    static func hint(seat: Seat, instanceId: Int, rank: Int) async throws -> HintResult {
        try await post(
            "api/rooms/\(seat.code)/hint",
            body: ["instanceId": instanceId, "rank": rank], bearer: seat.token
        )
    }

    /// Host only, and only on a slot whose clue is already up.
    static func initials(seat: Seat, instanceId: Int, rank: Int) async throws -> InitialsResult {
        try await post(
            "api/rooms/\(seat.code)/initials",
            body: ["instanceId": instanceId, "rank": rank], bearer: seat.token
        )
    }

    static func leave(seat: Seat) async throws {
        _ = try await request("POST", "api/rooms/\(seat.code)/leave", bearer: seat.token)
    }

    /// Host only. The server revokes the seat and cuts their call.
    static func removePlayer(seat: Seat, participantId: Int) async throws {
        _ = try await request(
            "POST", "api/rooms/\(seat.code)/participants/\(participantId)/remove", bearer: seat.token)
    }

    /// Anyone can report anyone — including the host, which is the case that
    /// matters and the reason this is not routed through them.
    static func report(seat: Seat, participantId: Int, reason: String) async throws {
        _ = try await request(
            "POST", "api/rooms/\(seat.code)/participants/\(participantId)/report",
            body: ["reason": reason], bearer: seat.token)
    }

    static func endRoom(seat: Seat) async throws {
        _ = try await request("POST", "api/rooms/\(seat.code)/end", bearer: seat.token)
    }

    /// The games on offer. One call, so the picker can be built without any
    /// app-side knowledge of which categories exist.
    static func tenableCategories() async throws -> [TenableCategory] {
        try await get("api/tenable/categories")
    }

    /// The rounds of one category. Not the schedule: a room is not playing the
    /// day's round, it is playing whichever round the host picks, and the
    /// categories after Football have no schedule at all.
    static func roundPool(category: String) async throws -> [PoolRound] {
        try await get("api/tenable/rounds?category=\(category)")
    }

    /// A player's career, for the card opened by tapping a found row. No seat
    /// token: this is the same public route the web game reads, and the
    /// answer is already on screen by the time anyone can ask for it.
    ///
    /// It can be slow on a player nobody has ever opened — the route fills in
    /// the full name and birthplace from Wikipedia on first view and caches
    /// them. That is off the game's critical path, which is why this is a tap
    /// on a finished row and never anything the round waits for.
    static func footballerCard(id: Int) async throws -> FootballerCard {
        try await get("api/footballers/\(id)/card")
    }

    struct FrozenRound: Decodable {
        let instanceId: Int
        let title: String
        let status: String
    }

    /// The host's final say on a borderline answer: count it, in the player's
    /// own words, in the next free slot.
    static func allowGuess(seat: Seat, instanceId: Int, raw: String) async throws -> AllowResult {
        try await post(
            "api/rooms/\(seat.code)/allow",
            body: ["instanceId": AnyEncodable(instanceId), "raw": AnyEncodable(raw)],
            bearer: seat.token
        )
    }

    static func giveUp(seat: Seat, instanceId: Int) async throws -> GiveUpResult {
        try await post(
            "api/rooms/\(seat.code)/rounds/\(instanceId)/give-up",
            body: EmptyBody(),
            bearer: seat.token
        )
    }

    static func resolveReviews(seat: Seat) async throws -> ReviewResolution {
        try await post(
            "api/rooms/\(seat.code)/reviews/resolve",
            body: EmptyBody(),
            bearer: seat.token
        )
    }

    static func sendChat(seat: Seat, body text: String) async throws -> ChatResult {
        try await post(
            "api/rooms/\(seat.code)/chat",
            // Same idempotency contract as a guess: the key is made here and
            // travels with the attempt, so a retry posts once.
            body: ChatBody(clientMessageId: UUID().uuidString, body: text),
            bearer: seat.token
        )
    }

    // MARK: - Notifications

    struct PushRegistration: Decodable {
        let secret: String
        let muted: Bool
    }

    private struct Health: Decodable { let push: Bool? }

    /// Can the server actually send a notification?
    ///
    /// Asked before the permission prompt, because iOS gives exactly one
    /// chance at it — declined, it never reappears and the only way back is
    /// Settings. Spending that on a build whose server has no Apple key
    /// configured would burn it on a question that could not have worked
    /// whatever the answer. False on any error, which is the safe direction:
    /// not asking costs a delay, asking too early costs the prompt.
    static func pushAvailable() async -> Bool {
        guard let health: Health = try? await get("api/health") else { return false }
        return health.push == true
    }

    /// Register this phone, or tell the server its token changed.
    ///
    /// Exactly one of `secret` and `participantToken` is used: the secret
    /// where we have registered before, and otherwise the token of a game we
    /// are sitting in, which is the only proof of invitation a player with no
    /// account can offer. See routes/push.ts.
    static func registerPushDevice(
        token: String, secret: String?, participantToken: String?, displayName: String?
    ) async throws -> PushRegistration {
        var body: [String: String] = ["platform": "ios", "token": token]
        if let secret { body["secret"] = secret }
        if let displayName { body["displayName"] = displayName }
        return try await post("api/push/devices", body: body, bearer: participantToken)
    }

    private struct MuteBody: Encodable {
        let secret: String
        let muted: Bool
    }

    private struct MuteResult: Decodable { let muted: Bool }

    static func setPushMuted(secret: String, muted: Bool) async throws -> Bool {
        let result: MuteResult = try await post(
            "api/push/devices/mute", body: MuteBody(secret: secret, muted: muted)
        )
        return result.muted
    }

    private struct GuessBody: Encodable {
        let instanceId: Int
        let clientGuessId: String
        let raw: String
    }

    private struct EmptyBody: Encodable {}

    private struct ChatBody: Encodable {
        let clientMessageId: String
        let body: String
    }
}

/// A seat in a room: the code, plus the token that says which seat.
struct Seat: Codable, Equatable {
    let code: String
    let participantId: Int
    let token: String
}

// Erases the existential so a heterogeneous body can be encoded.
private struct AnyEncodable: Encodable {
    private let encodeTo: (Encoder) throws -> Void
    init(_ wrapped: any Encodable) { encodeTo = wrapped.encode(to:) }
    func encode(to encoder: Encoder) throws { try encodeTo(encoder) }
}
