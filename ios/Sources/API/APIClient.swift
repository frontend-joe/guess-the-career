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
        var errorDescription: String? { message }

        /// A seat that no longer exists, as opposed to a bad network moment.
        var isGone: Bool { status == 403 || status == 404 }
    }

    private static let decoder: JSONDecoder = JSONDecoder()
    private static let encoder: JSONEncoder = JSONEncoder()

    private static func request(
        _ method: String,
        _ path: String,
        body: (any Encodable)? = nil,
        bearer: String? = nil
    ) async throws -> Data {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        if let bearer { req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? decoder.decode(ServerError.self, from: data))?.error
                ?? "Request failed (\(status))"
            throw Failure(message: message, status: status)
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

    // MARK: - Rooms

    static func createRoom(accessToken: String, name: String?) async throws -> JoinedRoom {
        // Omit the key rather than sending null. Swift's synthesised encoder
        // writes an explicit null for a nil Optional, which is a different
        // thing on the wire from "absent" and not every schema treats them
        // alike.
        try await post("api/rooms", body: name.map { ["name": $0] } ?? [:], bearer: accessToken)
    }

    static func joinRoom(code: String, displayName: String) async throws -> JoinedRoom {
        try await post("api/rooms/\(code)/join", body: ["displayName": displayName, "platform": "ios"])
    }

    static func roomState(seat: Seat) async throws -> RoomState {
        try await get("api/rooms/\(seat.code)/state", bearer: seat.token)
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

    static func hint(seat: Seat, instanceId: Int, rank: Int) async throws -> TakenHint {
        try await post(
            "api/rooms/\(seat.code)/hint",
            body: ["instanceId": instanceId, "rank": rank], bearer: seat.token
        )
    }

    static func leave(seat: Seat) async throws {
        _ = try await request("POST", "api/rooms/\(seat.code)/leave", bearer: seat.token)
    }

    static func endRoom(seat: Seat) async throws {
        _ = try await request("POST", "api/rooms/\(seat.code)/end", bearer: seat.token)
    }

    static func scheduledRounds() async throws -> [ScheduledRound] {
        try await get("api/tenable/schedule/rounds")
    }

    struct FrozenRound: Decodable {
        let instanceId: Int
        let title: String
        let status: String
    }

    private struct GuessBody: Encodable {
        let instanceId: Int
        let clientGuessId: String
        let raw: String
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
