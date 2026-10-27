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

struct RoomState: Codable, Equatable {
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    let hostUserId: Int
    let participants: [RoomParticipant]
    let round: RoomRound?
}

// What create and join return: the state, plus the seat you were given.
struct JoinedRoom: Codable {
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    let hostUserId: Int
    let participants: [RoomParticipant]
    let round: RoomRound?
    let participantId: Int
    let participantToken: String

    var state: RoomState {
        RoomState(
            code: code, status: status, stateVersion: stateVersion,
            livekitRoom: livekitRoom, hostUserId: hostUserId,
            participants: participants, round: round
        )
    }
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
