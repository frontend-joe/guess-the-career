package com.guessthelist.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

/**
 * Talks to Railway directly, like the iOS app. The web client goes through
 * Netlify's proxy, which buffers and breaks streaming responses; none of that
 * is in the path here, because the app dials the origin.
 */
object Api {
    private const val BASE = "https://server-production-2e32.up.railway.app"
    private val JSON_TYPE = "application/json".toMediaType()
    private val client = OkHttpClient()

    /** Unknown fields are ignored so a server that adds one cannot break a
     *  phone nobody has updated — which, with no App Store, is every phone. */
    private val json = Json { ignoreUnknownKeys = true }

    class Failure(val status: Int, message: String) : Exception(message) {
        /** A seat that no longer exists, rather than a bad network moment. */
        val isGone: Boolean get() = status == 403 || status == 404
    }

    private suspend fun call(
        method: String,
        path: String,
        body: JsonObject? = null,
        bearer: String? = null,
    ): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("$BASE/$path")
        val payload = body?.toString()?.toRequestBody(JSON_TYPE)
        when (method) {
            "POST" -> builder.post(payload ?: "".toRequestBody(JSON_TYPE))
            else -> builder.get()
        }
        bearer?.let { builder.header("Authorization", "Bearer $it") }

        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching {
                    (json.parseToJsonElement(text) as JsonObject)["error"]
                        ?.let { (it as JsonPrimitive).content }
                }.getOrNull() ?: "Request failed (${response.code})"
                throw Failure(response.code, message)
            }
            text
        }
    }

    private suspend inline fun <reified T> get(path: String, bearer: String? = null): T =
        json.decodeFromString(call("GET", path, bearer = bearer))

    private suspend inline fun <reified T> post(
        path: String,
        body: JsonObject? = null,
        bearer: String? = null,
    ): T = json.decodeFromString(call("POST", path, body, bearer))

    // MARK: Auth

    suspend fun signIn(email: String, password: String): TokenPair = post(
        "api/auth/token",
        buildJsonObject {
            put("email", email); put("password", password)
            put("deviceLabel", "Android"); put("platform", "android")
        },
    )

    // MARK: Rooms

    suspend fun createRoom(accessToken: String): JoinedRoom =
        // An empty object, not {"name": null} — see the commit that taught the
        // server to accept both after iOS sent the null.
        post("api/rooms", buildJsonObject {}, accessToken)

    suspend fun joinRoom(code: String, displayName: String): JoinedRoom = post(
        "api/rooms/$code/join",
        buildJsonObject { put("displayName", displayName); put("platform", "android") },
    )

    suspend fun roomState(seat: Seat): RoomState =
        get("api/rooms/${seat.code}/state", seat.token)

    suspend fun livekitCredentials(seat: Seat): LivekitCredentials =
        get("api/rooms/${seat.code}/livekit-token", seat.token)

    suspend fun freezeRound(seat: Seat, roundId: Int): FrozenRound = post(
        "api/rooms/${seat.code}/rounds",
        buildJsonObject { put("roundId", roundId) },
        seat.token,
    )

    suspend fun startRound(seat: Seat, instanceId: Int): RoomState =
        post("api/rooms/${seat.code}/rounds/$instanceId/start", null, seat.token)

    suspend fun guess(seat: Seat, instanceId: Int, raw: String): GuessResult = post(
        "api/rooms/${seat.code}/guess",
        buildJsonObject {
            put("instanceId", instanceId)
            // Made here and carried with the attempt, so a retry on a bad
            // connection is scored once.
            put("clientGuessId", UUID.randomUUID().toString())
            put("raw", raw)
        },
        seat.token,
    )

    suspend fun hint(seat: Seat, instanceId: Int, rank: Int): TakenHint = post(
        "api/rooms/${seat.code}/hint",
        buildJsonObject { put("instanceId", instanceId); put("rank", rank) },
        seat.token,
    )

    suspend fun leave(seat: Seat) {
        call("POST", "api/rooms/${seat.code}/leave", bearer = seat.token)
    }

    suspend fun endRoom(seat: Seat) {
        call("POST", "api/rooms/${seat.code}/end", bearer = seat.token)
    }

    suspend fun scheduledRounds(): List<ScheduledRound> =
        get("api/tenable/schedule/rounds")

    fun parseBroadcast(text: String): StateBroadcast? =
        runCatching { json.decodeFromString<StateBroadcast>(text) }.getOrNull()
}
