import Foundation

// Mirrors of what the server sends. Kept deliberately close to
// server/src/services/gameRooms.ts and boardReplay.ts — when those change,
// these change with them, and a mismatch should fail to decode loudly rather
// than silently drop a field mid-game.

struct RoomParticipant: Codable, Identifiable, Equatable {
    let id: Int
    let displayName: String
    let role: String
    let slot: Int
    let present: Bool

    var isHost: Bool { role == "host" }
}

struct RevealedAnswer: Codable, Equatable {
    let rank: Int
    let name: String
    let value: Double
    let unit: String?
    let nationality: String?
    let photoUrl: String?
    let tMs: Int
    /// Revealed by giving up rather than guessed. Optional so a phone running
    /// an older build than the server still decodes the board rather than
    /// failing the whole round.
    let missed: Bool?

    var wasMissed: Bool { missed == true }
}

struct ReplayGuess: Codable, Equatable {
    let raw: String
    let verdict: String
    let matchedRank: Int?
    let tMs: Int
}

// A clue field can be a string, a number or null, so it needs a decoder of its
// own rather than a dictionary of one Swift type.
enum ClueValue: Codable, Equatable {
    case text(String)
    case number(Double)
    case missing

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .missing }
        else if let s = try? container.decode(String.self) { self = .text(s) }
        else if let d = try? container.decode(Double.self) { self = .number(d) }
        else { self = .missing }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .text(let s): try container.encode(s)
        case .number(let d): try container.encode(d)
        case .missing: try container.encodeNil()
        }
    }

    var display: String? {
        switch self {
        case .text(let s): return s.isEmpty ? nil : s
        case .number(let d): return String(Int(d))
        case .missing: return nil
        }
    }
}

struct TakenHint: Codable, Equatable {
    let rank: Int
    let clue: [String: ClueValue]?
    let tMs: Int
}

struct BoardState: Codable, Equatable {
    let title: String
    let target: Int
    let ordered: Bool
    let metric: String
    let impliedClues: [String]
    let revealed: [RevealedAnswer]
    let hints: [TakenHint]
    let guesses: [ReplayGuess]
}

struct RoomRound: Codable, Equatable {
    let instanceId: Int
    let seq: Int
    let status: String
    let startedAtMs: Int?
    let board: BoardState
    let blanks: [Int]

    var isLive: Bool { status == "live" }
    var isPending: Bool { status == "pending" }
}

// A typed message, for the player whose microphone or camera is not working.
// The display name is the one the server snapshotted when it was sent, not the
// sender's current one.
struct ChatMessage: Codable, Equatable, Identifiable {
    let id: Int
    let participantId: Int?
    let displayName: String
    let body: String
    let createdAt: String
}

struct RoomState: Codable, Equatable {
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    let hostUserId: Int
    /// The round picked and waiting to be started. Separate from `round`,
    /// which is what the board is showing — after a round finishes the board
    /// keeps its answers up while the host lines the next one up.
    let pendingInstanceId: Int?
    let participants: [RoomParticipant]
    let messages: [ChatMessage]
    let round: RoomRound?
}

// What create and join return: the state, plus the seat you were given.
struct JoinedRoom: Codable {
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    let hostUserId: Int
    let pendingInstanceId: Int?
    let participants: [RoomParticipant]
    let messages: [ChatMessage]
    let round: RoomRound?
    let participantId: Int
    let participantToken: String

    var state: RoomState {
        RoomState(
            code: code, status: status, stateVersion: stateVersion,
            livekitRoom: livekitRoom, hostUserId: hostUserId,
            pendingInstanceId: pendingInstanceId,
            participants: participants, messages: messages, round: round
        )
    }
}

// ACTION responses, which are not board state and must not borrow its types.
//
// These two used to decode into TakenHint and RevealedAnswer, both of which
// carry a non-optional `tMs` that only /state ever sends. Swift's synthesised
// Codable has no defaults, so the whole response failed with "The data
// couldn't be read because it is missing" — taking a clue and giving up both
// errored while working perfectly on the server. Android never showed it:
// kotlinx fills missing fields from its defaults.
struct HintResult: Codable {
    let rank: Int
    let clue: [String: ClueValue]?
    let stateVersion: Int
    let replayed: Bool
}

struct GiveUpResult: Codable {
    struct Revealed: Codable {
        let rank: Int
        let name: String
        let value: Double
        let unit: String?
    }

    let revealed: [Revealed]
    let stateVersion: Int
}

/// What came of looking up the names the game did not recognise.
struct ReviewResolution: Codable {
    let added: [String]
    let alreadyKnown: [String]
    let failed: [String]
}

struct ChatResult: Codable {
    let message: ChatMessage
    let stateVersion: Int
    let replayed: Bool
}

struct GuessResult: Codable {
    let verdict: String
    let rank: Int?
    let value: Double?
    let unit: String?
    let name: String?
    let replayed: Bool
    let stateVersion: Int
    let complete: Bool
}

struct LivekitCredentials: Codable {
    let url: String
    let roomName: String
    let identity: String
    let slot: Int
    let token: String
}

struct TokenPair: Codable {
    let accessToken: String
    let refreshToken: String
}

struct ScheduledRound: Codable, Identifiable, Equatable {
    let date: String
    let roundId: Int
    let title: String
    let metric: String

    var id: Int { roundId }
}
