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
    val nationality: String? = null,
    val photoUrl: String? = null,
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

@Serializable
data class ScheduledRound(
    val date: String,
    val roundId: Int,
    val title: String,
    val metric: String,
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
