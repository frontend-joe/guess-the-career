package com.guessthelist.app

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

// Mirrors of what the server sends, kept close to the iOS models and to
// server/src/services/gameRooms.ts. Three copies of the same shape is the
// price of two native codebases; when the server changes, all three change.

@Serializable
data class RoomParticipant(
    val id: Int,
    val displayName: String,
    val role: String,
    val slot: Int,
    val present: Boolean,
) {
    val isHost: Boolean get() = role == "host"
}

@Serializable
data class RevealedAnswer(
    val rank: Int,
    val name: String,
    val value: Double,
    val unit: String? = null,
    /// What the badge should read when the number cannot speak for itself:
    /// "6,650", "17.1m". An authored round says so outright, because one
    /// formatting rule cannot serve river kilometres and country populations
    /// at once. Null on a football round, where the number always could.
    val display: String? = null,
    val nationality: String? = null,
    val photoUrl: String? = null,
    /// Who this row is, so tapping it can open their career. Null on an answer
    /// with no footballer record, and on rows logged before the board carried
    /// ids — both simply do not open.
    val footballerId: Int? = null,
    val tMs: Int = 0,
    /// Revealed by giving up rather than guessed. Defaulted so a phone running
    /// an older build than the server still decodes the board.
    val missed: Boolean = false,
)

@Serializable
data class ReplayGuess(
    val raw: String,
    val verdict: String,
    val matchedRank: Int? = null,
    val tMs: Int = 0,
)

// A clue field is a string, a number or null, so it stays a JsonElement until
// something wants to show it.
@Serializable
data class TakenHint(
    val rank: Int,
    val clue: Map<String, JsonElement>? = null,
    val tMs: Int = 0,
) {
    fun display(key: String): String? {
        val value = clue?.get(key) ?: return null
        if (value is JsonNull) return null
        val primitive = value as? JsonPrimitive ?: return null
        val text = primitive.content
        return text.ifEmpty { null }
    }
}

@Serializable
data class GiveUpResult(
    val revealed: List<RevealedAnswer> = emptyList(),
    val stateVersion: Int = 0,
)

@Serializable
data class BoardState(
    val title: String = "",
    val target: Int = 10,
    val ordered: Boolean = true,
    /** Which game this round is. Defaulted so a phone on an older build than
     *  the server still decodes a board; absent means football, which is what
     *  every round was before there was a second category. */
    val category: String = "football",
    val metric: String = "",
    val impliedClues: List<String> = emptyList(),
    val revealed: List<RevealedAnswer> = emptyList(),
    val hints: List<TakenHint> = emptyList(),
    val guesses: List<ReplayGuess> = emptyList(),
)

@Serializable
data class RoomRound(
    val instanceId: Int,
    val seq: Int,
    val status: String,
    val startedAtMs: Long? = null,
    val board: BoardState,
    val blanks: List<Int> = emptyList(),
) {
    val isLive: Boolean get() = status == "live"
    val isPending: Boolean get() = status == "pending"
}

// A typed message, for the player whose microphone or camera is not working.
// The display name is the one the server snapshotted when it was sent, not the
// sender's current one.
@Serializable
data class ChatMessage(
    val id: Int,
    val participantId: Int? = null,
    val displayName: String,
    val body: String,
    val createdAt: String = "",
)

/** What came of looking up the names the game did not recognise. */
@Serializable
data class ReviewResolution(
    val added: List<String> = emptyList(),
    val alreadyKnown: List<String> = emptyList(),
    val failed: List<String> = emptyList(),
)

@Serializable
data class ChatResult(
    val message: ChatMessage,
    val stateVersion: Int = 0,
    val replayed: Boolean = false,
)

@Serializable
data class RoomState(
    val code: String,
    val status: String,
    val stateVersion: Int,
    val livekitRoom: String,
    val hostUserId: Int,
    /** The round picked and waiting to be started. Separate from [round],
     *  which is what the board is showing. */
    val pendingInstanceId: Int? = null,
    val participants: List<RoomParticipant> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val round: RoomRound? = null,
)

@Serializable
data class JoinedRoom(
    val code: String,
    val status: String,
    val stateVersion: Int,
    val livekitRoom: String,
    val hostUserId: Int,
    val pendingInstanceId: Int? = null,
    val participants: List<RoomParticipant> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val round: RoomRound? = null,
    val participantId: Int,
    val participantToken: String,
) {
    val state: RoomState
        get() = RoomState(
            code, status, stateVersion, livekitRoom, hostUserId,
            pendingInstanceId, participants, messages, round,
        )
}

@Serializable
data class GuessResult(
    val verdict: String,
    /** On a miss: the player the database knows by that name, if any. */
    val known: String? = null,
    /** A miss whose name has just been queued for a Wikipedia lookup, and
     *  which can still land on THIS board and score. */
    val checking: Boolean = false,
    val rank: Int? = null,
    val value: Double? = null,
    val unit: String? = null,
    val name: String? = null,
    val replayed: Boolean = false,
    val stateVersion: Int = 0,
    val complete: Boolean = false,
)

@Serializable
data class LivekitCredentials(
    val url: String,
    val roomName: String,
    val identity: String,
    val slot: Int,
    val token: String,
)

@Serializable
data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
)

/** A round in the pool the host picks from. Only Football has a schedule, so
 *  the date is optional — a geography round has never been on a calendar. */
@Serializable
data class PoolRound(
    val date: String? = null,
    val roundId: Int,
    val title: String,
    val metric: String,
    val category: String? = null,
)

/** One of the games Tenable is made of. Served rather than hardcoded, so a new
 *  category does not need an app release. */
@Serializable
data class TenableCategory(
    val slug: String,
    val label: String,
    val description: String = "",
    val rounds: Int = 0,
)

@Serializable
data class FrozenRound(
    val instanceId: Int,
    val title: String,
    val status: String,
)

/** A seat in a room: the code, plus the token that says which seat. */
@Serializable
data class Seat(
    val code: String,
    val participantId: Int,
    val token: String,
)

@Serializable
data class StateBroadcast(
    @SerialName("stateVersion") val stateVersion: Int = 0,
)

// ── Player card ─────────────────────────────────────────────────────────────

// The same payload the web game's player modal reads, from
// GET /api/footballers/:id/card. That route predates the apps and speaks
// snake_case; the web client decodes it as it stands, so the names are mapped
// here rather than changed on the server.
@Serializable
data class CardStint(
    val years: String = "",
    val club: String = "",
    val apps: Int? = null,
    val goals: Int? = null,
    @SerialName("stint_type") val stintType: String = "senior",
) {
    val isInternational: Boolean get() = stintType == "international"

    /** "47 (18)", or just the appearances when the goals are unknown. */
    val appsGoals: String get() = (apps ?: 0).let { if (goals != null) "$it ($goals)" else "$it" }

    /**
     * Wikipedia marks a loan with a leading arrow and/or a "(loan)" suffix,
     * and a trial with "(trial)". The row shows the club and the tag apart,
     * so strip them off the name rather than printing it raw.
     */
    val clubName: String
        get() = club.removePrefix("→").replace(Regex("""\s*\((loan|trial)\)""", RegexOption.IGNORE_CASE), "").trim()

    val tag: String?
        get() = when {
            club.startsWith("→") || club.contains("(loan)", true) -> "loan"
            club.contains("(trial)", true) -> "trial"
            else -> null
        }
}

@Serializable
data class FootballerCard(
    val id: Int = 0,
    val name: String = "",
    @SerialName("full_name") val fullName: String? = null,
    val born: String? = null,
    val birthplace: String? = null,
    @SerialName("height_cm") val heightCm: Int? = null,
    val position: String? = null,
    val nationality: String? = null,
    val stints: List<CardStint> = emptyList(),
) {
    val senior: List<CardStint> get() = stints.filter { !it.isInternational }
    val international: List<CardStint> get() = stints.filter { it.isInternational }
}
