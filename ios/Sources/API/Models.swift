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
    /// What the badge should read when the number cannot speak for itself:
    /// "6,650", "17.1m". An authored round says so outright, because one
    /// formatting rule cannot serve river kilometres and country populations
    /// at once. Null on a football round, where the number always could.
    let display: String?
    let nationality: String?
    let photoUrl: String?
    /// Who this row is, so tapping it can open their career. Null on an
    /// answer with no footballer record, and on rows logged before the board
    /// carried ids — both simply do not open.
    let footballerId: Int?
    let tMs: Int
    /// Revealed by giving up rather than guessed. Optional so a phone running
    /// an older build than the server still decodes the board rather than
    /// failing the whole round.
    let missed: Bool?
    /// Counted by the host rather than found on the list. Optional so a phone
    /// on an older build than the server still decodes the board.
    let allowed: Bool?

    var wasMissed: Bool { missed == true }
    var wasAllowed: Bool { allowed == true }
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
        case .number(let d): return String(safeInt(d))
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
    /// Which game this round is. Optional so a phone on an older build than
    /// the server still decodes a board; absent means football, which is what
    /// every round was before there was a second category.
    let category: String?
    let metric: String

    var isFootball: Bool { (category ?? "football") == "football" }
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

struct AllowResult: Codable {
    let rank: Int
    let name: String
    let complete: Bool
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
    /// On a miss: the player the database knows by that name, if any.
    /// Optional so a phone on an older build than the server still decodes.
    let known: String?
    /// A miss whose name has just been queued for a Wikipedia lookup, and
    /// which can still land on THIS board and score. Optional so a phone on
    /// an older build than the server still decodes.
    let checking: Bool?
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

/// A round in the pool the host picks from. Named for the schedule it used to
/// come from; it is now any round of one category, and only Football has a
/// schedule at all — hence the optional date.
struct PoolRound: Codable, Identifiable, Equatable {
    let date: String?
    let roundId: Int
    let title: String
    let metric: String
    let category: String?

    var id: Int { roundId }
}

/// One of the games Tenable is made of. Served rather than hardcoded, so a new
/// category does not need an app release.
struct TenableCategory: Codable, Identifiable, Equatable {
    let slug: String
    let label: String
    let description: String
    let rounds: Int

    var id: String { slug }
}

// MARK: - Player card

// The same payload the web game's player modal reads, from
// GET /api/footballers/:id/card. That route predates the apps and speaks
// snake_case, so the keys are spelled out rather than renamed server-side —
// the web client decodes it as it stands and changing it would break there.
struct CardStint: Codable, Equatable {
    let years: String
    let club: String
    let apps: Int?
    let goals: Int?
    let stintType: String

    enum CodingKeys: String, CodingKey {
        case years, club, apps, goals
        case stintType = "stint_type"
    }

    var isInternational: Bool { stintType == "international" }

    /// Wikipedia marks a loan with a leading arrow and/or a "(loan)" suffix,
    /// and a trial with "(trial)". The row shows the club and the tag apart,
    /// so strip them off the name rather than printing it raw.
    var parts: (name: String, tag: String?) {
        let loan = club.hasPrefix("→") || club.range(of: "(loan)", options: .caseInsensitive) != nil
        let trial = club.range(of: "(trial)", options: .caseInsensitive) != nil
        var name = club
        if let r = name.range(of: "^→\\s*", options: .regularExpression) { name.removeSubrange(r) }
        while let r = name.range(of: "\\s*\\((loan|trial)\\)", options: [.regularExpression, .caseInsensitive]) {
            name.removeSubrange(r)
        }
        return (name.trimmingCharacters(in: .whitespaces), loan ? "loan" : trial ? "trial" : nil)
    }

    /// "47 (18)", or just the appearances when the goals are unknown.
    var appsGoals: String {
        let a = apps ?? 0
        return goals != nil ? "\(a) (\(goals!))" : "\(a)"
    }
}

struct FootballerCard: Codable, Equatable {
    let id: Int
    let name: String
    let fullName: String?
    let born: String?
    let birthplace: String?
    let heightCm: Int?
    let position: String?
    let nationality: String?
    let stints: [CardStint]

    enum CodingKeys: String, CodingKey {
        case id, name, born, birthplace, position, nationality, stints
        case fullName = "full_name"
        case heightCm = "height_cm"
    }

    var senior: [CardStint] { stints.filter { !$0.isInternational } }
    var international: [CardStint] { stints.filter(\.isInternational) }

    /// "26 June 1991" — the long form the web modal shows, not the ISO date
    /// the database stores.
    var bornLong: String? {
        guard let born else { return nil }
        let iso = DateFormatter()
        iso.dateFormat = "yyyy-MM-dd"
        iso.locale = Locale(identifier: "en_GB")
        guard let date = iso.date(from: String(born.prefix(10))) else { return born }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_GB")
        out.dateFormat = "d MMMM yyyy"
        return out.string(from: date)
    }
}
