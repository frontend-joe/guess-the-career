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
    /// They have not walked out. Says nothing about whether anybody is
    /// holding the phone — see `active`.
    let present: Bool
    /// Their app asked the server for the state inside the last minute, so
    /// they are in the room in the sense that matters: able to hear you.
    ///
    /// Optional, and absent reads as "not known to be here" rather than
    /// failing the decode, so an app that reaches a server older than the
    /// field shows a room with no rings instead of no room.
    let active: Bool?

    var isHost: Bool { role == "host" }

    var isActive: Bool { active == true }
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
    /// The stat behind the rank, so a near miss can say what it was beaten
    /// by. Optional for the same reason `byParticipantId` is: a round played
    /// before the server logged it has none, and the chip just shows the
    /// placing on its own.
    let value: Double?
    let unit: String?
    let tMs: Int
    /// Who said it. The log has recorded this since guessing stopped being the
    /// host's alone; the apps simply were not reading it. Optional so a phone
    /// on an older build than the server still decodes the board, and because
    /// a round played before this was logged has none.
    let byParticipantId: Int?
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
    /// The answer's initials, once the host has spent a second clue on them.
    /// Optional rather than absent-means-empty: a phone on an older build
    /// than the server still decodes a board, and nil means "not given away"
    /// rather than "this round cannot".
    let initials: String?
    let tMs: Int
}

/// A player the database had never heard of until somebody in this room named
/// them.
///
/// The rarest thing that happens in a round, and the game used to draw it
/// exactly like any other correct answer. It arrives in the board fold rather
/// than as a broadcast, so the recording shows the moment too.
struct Discovery: Codable, Equatable {
    let name: String
    let rank: Int
    let tMs: Int
    let byParticipantId: Int?
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
    /// The most recent name this round taught the database. Optional so a
    /// phone on an older build than the server still decodes a board.
    let discovery: Discovery?
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
    /// Participant ids mid-guess, as the server last heard. Only populated
    /// for a game with no video call, where the poll is the only transport a
    /// typing dot has; absent otherwise, and absent from an older server.
    var typing: [Int]?
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    /// Whether this game is a video call. Set by the host at creation and
    /// never changed; false means nobody ever dials LiveKit. Optional so a
    /// phone talking to a server older than the flag still decodes a room,
    /// and absent means yes — which is what every room used to be.
    let video: Bool?
    let hostUserId: Int
    /// The round picked and waiting to be started. Separate from `round`,
    /// which is what the board is showing — after a round finishes the board
    /// keeps its answers up while the host lines the next one up.
    let pendingInstanceId: Int?
    let participants: [RoomParticipant]
    let messages: [ChatMessage]
    let round: RoomRound?
    /// A renewed token for the seat this snapshot was fetched with, so sitting
    /// in a room keeps the seat alive. Optional because only /state sends it —
    /// create and join hand the seat over whole, and Swift's synthesised
    /// Codable has no defaults to fall back on.
    let participantToken: String?
}

// What create and join return: the state, plus the seat you were given.
struct JoinedRoom: Codable {
    let code: String
    let status: String
    let stateVersion: Int
    let livekitRoom: String
    let video: Bool?
    let hostUserId: Int
    let pendingInstanceId: Int?
    let participants: [RoomParticipant]
    let messages: [ChatMessage]
    let round: RoomRound?
    let participantId: Int
    let participantToken: String
    /// Handed back when the call carried a push token, and the device's
    /// credential from then on. Absent when notifications are not set up.
    let deviceSecret: String?

    var state: RoomState {
        RoomState(
            code: code, status: status, stateVersion: stateVersion,
            livekitRoom: livekitRoom, video: video, hostUserId: hostUserId,
            pendingInstanceId: pendingInstanceId,
            participants: participants, messages: messages, round: round,
            participantToken: nil
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

struct InitialsResult: Codable {
    let rank: Int
    let initials: String
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
    /// How big a pool the round draws its ten from.
    let answerCount: Int?
    /// "easy" / "medium" / "hard", decided by the server from `answerCount`.
    ///
    /// Served rather than worked out here so that two apps cannot label the
    /// same round two different ways. Optional, and a string rather than an
    /// enum, because a value this app has never heard of must not fail the
    /// whole list's decode.
    let difficulty: String?
    /// How many times this round has been played, in any room. Optional so a
    /// build older than the field still decodes.
    let playedCount: Int?
    /// When it was last played, as a UTC `YYYY-MM-DD HH:MM:SS` from SQLite.
    let lastPlayedAt: String?

    var id: Int { roundId }

    var played: Bool { (playedCount ?? 0) > 0 }

    /// The badge, or nothing at all when the server did not say.
    var grade: RoundGrade? { RoundGrade(rawValue: difficulty ?? "") }
}

/// How hard a round is, for the one line of UI that says so.
///
/// Hard is the SMALL pool, which reads backwards until you have played one:
/// a category with barely ten members is thin because it is obscure, and
/// having every qualifying name on the board is no help when you cannot
/// think of the tenth. See difficultyOf in services/tenable.ts.
enum RoundGrade: String {
    case easy, medium, hard

    var label: String {
        switch self {
        case .easy: "Easy"
        case .medium: "Medium"
        case .hard: "Hard"
        }
    }

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
    var isYouth: Bool { stintType == "youth" }

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

    var youth: [CardStint] { stints.filter(\.isYouth) }
    // Everything that is neither, rather than everything that is not
    // international — a youth row arriving would otherwise have been filed
    // as a senior spell, which is the one thing it must never be.
    var senior: [CardStint] { stints.filter { !$0.isInternational && !$0.isYouth } }
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

// MARK: - History

/// One answer as it stood when the round ended.
///
/// `foundBy` is the name of whoever said it, or nil for one nobody got —
/// which is the whole reason anybody opens this screen.
struct HistoryAnswer: Decodable, Identifiable {
    let rank: Int
    let name: String
    let value: Double
    let unit: String?
    let display: String?
    let nationality: String?
    let photoUrl: String?
    let footballerId: Int?
    /// Whether this was one of the ten the board was asking for.
    ///
    /// False is the ranked tail — frozen with the round, ranked below the
    /// board, never answerable. It is listed because "who was eleventh" is
    /// the argument the room is having anyway, and it is kept apart because
    /// a name nobody could have scored is not a name anybody missed.
    let onBoard: Bool
    let foundBy: String?

    var id: Int { rank }
    var found: Bool { foundBy != nil }

}

struct HistoryRound: Decodable, Identifiable {
    let instanceId: Int
    let seq: Int
    let title: String
    let metric: String
    let category: String
    let ordered: Bool
    let target: Int
    /// How many of the ten were named. The score.
    let found: Int
    /// How much of an unordered pool is not listed, because it was capped.
    let more: Int
    let answers: [HistoryAnswer]

    var id: Int { instanceId }
    var score: String { "\(found) of \(target)" }
}

struct HistoryPage: Decodable {
    let rounds: [HistoryRound]
}
