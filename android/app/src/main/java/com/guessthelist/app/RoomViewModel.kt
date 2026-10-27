package com.guessthelist.app

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.livekit.android.LiveKit
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.room.Room
import io.livekit.android.room.participant.Participant
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

/**
 * Owns the room: the seat, the authoritative state, and the LiveKit
 * connection that carries both the video and the server's state broadcasts.
 *
 * The contract is the same as iOS and the web harness, deliberately: a
 * broadcast says only that the version moved, and the board on screen always
 * came from GET /state. That keeps one code path from the event log to a
 * board — the same fold the recorded video will be rendered from. A client
 * applying broadcasts directly would be a second implementation of that fold,
 * free to drift, and nobody would notice until a recording showed something
 * the players never saw.
 */
class RoomViewModel(app: Application) : AndroidViewModel(app) {

    var seat by mutableStateOf<Seat?>(null); private set
    var state by mutableStateOf<RoomState?>(null); private set
    var inRoom by mutableStateOf(false); private set
    var tiles by mutableStateOf<List<Participant>>(emptyList()); private set

    var accessToken by mutableStateOf<String?>(null)
    var error by mutableStateOf<String?>(null)
    var videoNote by mutableStateOf<String?>(null)
    var lastGuess by mutableStateOf<GuessResult?>(null)
    var cameraOn by mutableStateOf(false); private set
    var micOn by mutableStateOf(false); private set

    /** The version already on screen. Higher means we are behind; lower is an
     *  out-of-order message to ignore. */
    private var version = 0

    /** Exposed so the grid can render tracks; nothing outside mutates it. */
    var room by mutableStateOf<Room?>(null); private set
    private var poller: Job? = null

    private val prefs = app.getSharedPreferences("gtl", Context.MODE_PRIVATE)

    val me: RoomParticipant?
        get() = seat?.let { s -> state?.participants?.firstOrNull { it.id == s.participantId } }

    val isHost: Boolean get() = me?.isHost == true
    val round: RoomRound? get() = state?.round

    init { restoreSeat() }

    // MARK: Entering and leaving

    fun enter(joined: JoinedRoom) {
        val newSeat = Seat(joined.code, joined.participantId, joined.participantToken)
        seat = newSeat
        state = joined.state
        version = joined.stateVersion
        inRoom = true
        saveSeat(newSeat)
        startPolling()
        viewModelScope.launch { connectMedia() }
    }

    // Leave the screen FIRST, then tell the network. The leave call and
    // LiveKit's disconnect both wait on something that can hang, and while
    // they hung the button looked broken: you tapped Leave and sat in the
    // room. Going back to the lobby is not a request that can fail, so it
    // does not wait on one.
    fun leave(announce: Boolean = true) {
        val leaving = seat
        val leavingRoom = room

        poller?.cancel(); poller = null
        room = null
        tiles = emptyList()
        seat = null; state = null; version = 0; inRoom = false
        prefs.edit().remove(SEAT_KEY).apply()

        viewModelScope.launch {
            if (announce && leaving != null) runCatching { Api.leave(leaving) }
            runCatching { leavingRoom?.disconnect() }
        }
    }

    /** A seat outlives the process, so a kill does not cost a guest their slot
     *  — and with it their tile position in whatever gets recorded. */
    private fun restoreSeat() {
        val raw = prefs.getString(SEAT_KEY, null) ?: return
        val saved = runCatching { Json.decodeFromString<Seat>(raw) }.getOrNull() ?: return
        viewModelScope.launch {
            try {
                val fresh = Api.roomState(saved)
                seat = saved; state = fresh; version = fresh.stateVersion; inRoom = true
                startPolling()
                connectMedia()
            } catch (failure: Api.Failure) {
                if (failure.isGone) prefs.edit().remove(SEAT_KEY).apply()
            } catch (_: Exception) {
                // Probably the network; leave the stored seat for next time.
            }
        }
    }

    private fun saveSeat(value: Seat) {
        prefs.edit().putString(SEAT_KEY, Json.encodeToString(Seat.serializer(), value)).apply()
    }

    // MARK: State

    suspend fun refresh() {
        val current = seat ?: return
        try {
            val next = Api.roomState(current)
            if (next.stateVersion < version) return
            version = next.stateVersion
            state = next
            // The host ended it. Everyone else finds out here, on the next
            // poll or the next broadcast, rather than staying in a room that
            // no longer exists.
            if (next.status == "ended") {
                error = "The host ended the game."
                leave(announce = false)
            }
        } catch (failure: Api.Failure) {
            if (failure.isGone) {
                error = "That room is no longer available."
                leave(announce = false)
            } else {
                error = failure.message
            }
        } catch (e: Exception) {
            error = e.message
        }
    }

    /** The backstop. If a broadcast is lost the game still advances, late. */
    private fun startPolling() {
        poller?.cancel()
        poller = viewModelScope.launch {
            while (true) {
                refresh()
                delay(10_000)
            }
        }
    }

    // MARK: Media

    private suspend fun connectMedia() {
        val current = seat ?: return
        val credentials = try {
            Api.livekitCredentials(current)
        } catch (e: Exception) {
            videoNote = "No video: ${e.message}"
            return
        }

        val newRoom = LiveKit.create(appContext = getApplication())
        room = newRoom

        viewModelScope.launch {
            newRoom.events.collect { event ->
                when (event) {
                    is RoomEvent.DataReceived -> {
                        if (event.topic == STATE_TOPIC) handleBroadcast(String(event.data))
                    }
                    is RoomEvent.ParticipantConnected,
                    is RoomEvent.ParticipantDisconnected,
                    is RoomEvent.TrackSubscribed,
                    is RoomEvent.TrackUnsubscribed,
                    is RoomEvent.TrackPublished,
                    is RoomEvent.TrackUnpublished -> refreshTiles()
                    else -> Unit
                }
            }
        }

        try {
            // Connect first. The data channel carries the state broadcasts, so
            // the game has to keep working for someone who refuses the camera.
            newRoom.connect(credentials.url, credentials.token)
            // You arrive muted with your camera off, and turn them on when you
            // are ready. Joining a call already broadcasting is how people end
            // up on camera before they meant to be.
            cameraOn = false
            micOn = false
            videoNote = null
            refreshTiles()
        } catch (e: Exception) {
            videoNote = "Video failed: ${e.message}"
        }
    }

    // A nil room is not "nothing happened" — it means the call never
    // connected, and silently doing nothing is what made this look like a dead
    // button rather than a failed connection. Same for a throw: runCatching
    // used to swallow the reason, so a refused permission and a broken camera
    // looked identical, which is to say they looked like nothing at all.
    suspend fun setCamera(on: Boolean) {
        val current = room
        if (current == null) {
            videoNote = videoNote ?: "Not connected to the call yet."
            return
        }
        if (on && !hasPermission(Manifest.permission.CAMERA)) {
            videoNote = "Camera is blocked — allow it for Tenable in Settings."
            return
        }
        runCatching { current.localParticipant.setCameraEnabled(on) }
            .onSuccess { if (on) videoNote = null }
            .onFailure { videoNote = "Could not start your camera: ${it.message}" }
        cameraOn = current.localParticipant.isCameraEnabled
        refreshTiles()
    }

    suspend fun setMicrophone(on: Boolean) {
        val current = room
        if (current == null) {
            videoNote = videoNote ?: "Not connected to the call yet."
            return
        }
        if (on && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
            videoNote = "Mic is blocked — allow it for Tenable in Settings."
            return
        }
        runCatching { current.localParticipant.setMicrophoneEnabled(on) }
            .onSuccess { if (on) videoNote = null }
            .onFailure { videoNote = "Could not unmute: ${it.message}" }
        micOn = current.localParticipant.isMicrophoneEnabled
        refreshTiles()
    }

    private fun hasPermission(name: String): Boolean =
        ContextCompat.checkSelfPermission(getApplication(), name) == PackageManager.PERMISSION_GRANTED

    private fun refreshTiles() {
        val current = room ?: run { tiles = emptyList(); return }
        tiles = listOf<Participant>(current.localParticipant) + current.remoteParticipants.values
    }

    private fun handleBroadcast(text: String) {
        val message = Api.parseBroadcast(text) ?: return
        if (message.stateVersion <= version) return
        viewModelScope.launch { refresh() }
    }

    // MARK: Host actions

    fun freezeRound(roundId: Int) = act { Api.freezeRound(it, roundId) }

    fun startRound() {
        val instanceId = round?.instanceId ?: return
        act { Api.startRound(it, instanceId) }
    }

    fun guess(raw: String) {
        val instanceId = round?.instanceId ?: return
        act { lastGuess = Api.guess(it, instanceId, raw) }
    }

    // Posting bumps the room's version, so the message comes back through the
    // same refresh everything else does. Nothing is appended locally: one path
    // from the server's state to the screen, chat included.
    fun sendChat(body: String) {
        val text = body.trim()
        if (text.isEmpty()) return
        act { Api.sendChat(it, text) }
    }

    // Irreversible, so the UI confirms first — see RoomScreen. The server is
    // the one that decides what was missed; this does not guess at it.
    fun giveUp() {
        val instanceId = round?.instanceId ?: return
        act { Api.giveUp(it, instanceId) }
    }

    fun takeHint(rank: Int) {
        val instanceId = round?.instanceId ?: return
        act { Api.hint(it, instanceId, rank) }
    }

    // Ending the game used to leave the host sitting in the room it had just
    // ended: the server marked it ended, the next state still returned it,
    // and the screen did not change. Ending a game means leaving it.
    fun endGame() = act { Api.endRoom(it); leave(announce = false) }

    private fun act(body: suspend (Seat) -> Unit) {
        val current = seat ?: return
        error = null
        viewModelScope.launch {
            try {
                body(current)
                refresh()
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    override fun onCleared() {
        room?.disconnect()
        super.onCleared()
    }

    private companion object {
        const val SEAT_KEY = "seat"
        const val STATE_TOPIC = "gtl-state"
    }
}
