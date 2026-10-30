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
import io.livekit.android.room.track.VideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.room.participant.LocalParticipant
import io.livekit.android.room.participant.RemoteParticipant
import io.livekit.android.room.track.RemoteTrackPublication
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
    /** Assigning this renames the tiles, because that is where their names come
     *  from. LiveKit fires nothing when a participant's name turns up, so
     *  without this a tile that connected nameless stays nameless until a
     *  track event happens to redraw it — and a player with their camera off
     *  never produces one. */
    private var backingState by mutableStateOf<RoomState?>(null)
    var state: RoomState?
        get() = backingState
        private set(value) {
            backingState = value
            if (room != null) refreshTiles()
        }
    var inRoom by mutableStateOf(false); private set
    var tiles by mutableStateOf<List<Tile>>(emptyList()); private set

    var accessToken by mutableStateOf<String?>(null)
    var error by mutableStateOf<String?>(null)
    var videoNote by mutableStateOf<String?>(null)
    var lastGuess by mutableStateOf<GuessResult?>(null)
    var cameraOn by mutableStateOf(false); private set
    var micOn by mutableStateOf(false); private set

    /** Set the instant a control is tapped, so the button can acknowledge the
     *  tap before the work behind it is done. Turning a camera on is a
     *  possible reconnect and a publish — comfortably over a second — and for
     *  all of it the icon sat exactly as it was. That reads as a button that
     *  missed the tap, so you tap it again, and the second tap queues another
     *  round of the same work behind the first. */
    var cameraBusy by mutableStateOf(false); private set
    var micBusy by mutableStateOf(false); private set

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

    /** Who a participant id belongs to, for the things that name a player
     *  rather than draw their tile — the guess feed, and the recording after
     *  it. "You" for your own, because a feed of your own name reads oddly
     *  when half the rows are yours. */
    fun displayNameOfParticipant(id: Int?): String? {
        if (id == null) return null
        if (id == seat?.participantId) return "You"
        return state?.participants?.firstOrNull { it.id == id }?.displayName?.takeIf { it.isNotEmpty() }
    }

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
        micOn = false; cameraOn = false
        CallService.stop(getApplication())
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
                // A seat in a game that is already over is rubbish to throw
                // away, not a room to walk back into. Restoring it anyway put
                // the room on screen for one poll and then reported "the host
                // ended the game" — a true sentence about a game you left,
                // landing on the lobby just as you tapped an invite to a new
                // one, where it reads as a verdict on the link you just opened.
                if (fresh.status == "ended") {
                    prefs.edit().remove(SEAT_KEY).apply()
                    return@launch
                }
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

    private suspend fun connectMedia(): Boolean {
        val current = seat ?: return false
        val credentials = try {
            Api.livekitCredentials(current)
        } catch (e: Exception) {
            videoNote = "No video: ${e.message}"
            return false
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
                    is RoomEvent.TrackUnpublished,
                    // Muting does not unpublish, so without these a muted
                    // camera kept showing its last frame.
                    is RoomEvent.TrackMuted,
                    is RoomEvent.TrackUnmuted,
                    is RoomEvent.LocalTrackSubscribed,
                    is RoomEvent.TrackStreamStateChanged -> refreshTiles()
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
            return true
        } catch (e: Exception) {
            // Drop the half-built room. Keeping it was what turned a failed
            // connection into an SDK complaint about a missing publisher when
            // the camera button was tapped minutes later; the real fault was
            // here, and it said so at the time.
            room = null
            runCatching { newRoom.disconnect() }
            videoNote = "Video failed: ${e.message}"
            refreshTiles()
            return false
        }
    }

    /** A room object is not a connection: publishing needs the transport that
     * connect builds, so the camera and mic ask for one rather than finding
     * out from the SDK. */
    private suspend fun ensureMediaConnected(): Boolean {
        val current = room
        if (current != null && current.state == Room.State.CONNECTED) return true
        if (current != null &&
            (current.state == Room.State.CONNECTING || current.state == Room.State.RECONNECTING)
        ) {
            videoNote = "Still connecting to the call — try again in a moment."
            return false
        }
        if (current != null) {
            room = null
            runCatching { current.disconnect() }
        }
        return connectMedia()
    }

    // A throw is not "nothing happened": runCatching used to swallow the
    // reason, so a refused permission and a broken camera looked identical,
    // which is to say they looked like nothing at all.
    /**
     * Publish, and if the transport turns out not to be there, rebuild the
     * connection and publish once more.
     *
     * A connected room is not a promise that there is anything to publish
     * into. The SDK closes its transports and builds new ones around a full
     * reconnect — which is what backgrounding the app and coming back to it
     * causes — and a publish landing in that gap fails on a missing publisher.
     * Nothing announces the gap, so attempting the publish is the only way to
     * find it, and a fresh connection is the only way out of it.
     *
     * iOS can tell that case apart by its error type and retries only that
     * one; the Kotlin SDK reports it as a plain exception with no type to
     * match on, so this retries any publish failure once. The cost of being
     * wrong is a reconnect before a genuinely broken camera admits it.
     */
    private suspend fun publishing(work: suspend (LocalParticipant) -> Unit): Result<Unit> {
        val current = room ?: return Result.success(Unit)
        return runCatching { work(current.localParticipant) }.recoverCatching { failure ->
            room = null
            runCatching { current.disconnect() }
            if (!connectMedia()) throw failure
            work(room?.localParticipant ?: throw failure)
        }
    }

    suspend fun setCamera(on: Boolean) {
        // One tap at a time. Without this the taps that the old, unresponsive
        // button invited each started their own reconnect-and-publish.
        if (cameraBusy) return
        cameraBusy = true
        try {
            if (on && !hasPermission(Manifest.permission.CAMERA)) {
                videoNote = "Camera is blocked — allow it for Tenable in Settings."
                return
            }
            if (!ensureMediaConnected()) return
            publishing { it.setCameraEnabled(on) }
                .onSuccess { if (on) videoNote = null }
                .onFailure { videoNote = "Could not start your camera: ${it.message}" }
            cameraOn = room?.localParticipant?.isCameraEnabled ?: false
            refreshTiles()
        } finally {
            cameraBusy = false
        }
    }

    suspend fun setMicrophone(on: Boolean) {
        if (micBusy) return
        micBusy = true
        try {
            if (on && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
                videoNote = "Mic is blocked — allow it for Tenable in Settings."
                return
            }
            if (!ensureMediaConnected()) return
            publishing { it.setMicrophoneEnabled(on) }
                .onSuccess { if (on) videoNote = null }
                .onFailure { videoNote = "Could not unmute: ${it.message}" }
            micOn = room?.localParticipant?.isMicrophoneEnabled ?: false
            // Follows what the microphone is actually doing, not what was
            // asked for: a publish that failed leaves the mic off, and a
            // service claiming otherwise would sit in the shade saying the
            // room can hear you when it cannot.
            if (micOn) CallService.start(getApplication()) else CallService.stop(getApplication())
            refreshTiles()
        } finally {
            micBusy = false
        }
    }

    /** Whether the camera was on when the app went off screen, so returning
     *  can put it back exactly as it was found. */
    private var cameraBeforeBackground = false

    /**
     * Going off screen keeps the call; it just stops the camera.
     *
     * A backgrounded process gets no camera frames, and nothing says so — the
     * track stays published and everyone else's view of you freezes on your
     * last frame and holds it. The room then watches a still photograph it
     * believes is live, which is worse than seeing a camera-off tile, because
     * a camera-off tile is true. Unpublishing says the true thing.
     *
     * The microphone is deliberately left alone: keeping talking while the
     * phone is in your pocket is the point, and CallService is what makes it
     * possible.
     */
    fun onEnterBackground() {
        cameraBeforeBackground = cameraOn
        if (cameraOn) viewModelScope.launch { setCamera(false) }
    }

    fun onEnterForeground() {
        if (!cameraBeforeBackground) return
        cameraBeforeBackground = false
        viewModelScope.launch { setCamera(true) }
    }

    private fun hasPermission(name: String): Boolean =
        ContextCompat.checkSelfPermission(getApplication(), name) == PackageManager.PERMISSION_GRANTED

    // Tiles carry the TRACK, not just the participant.
    //
    // This used to assign `listOf(localParticipant) + remoteParticipants` —
    // the same object references every time, so every rebuilt list was
    // structurally EQUAL to the last one. mutableStateOf compares with
    // structural equality by default, decided nothing had changed, and skipped
    // recomposition. The camera really was publishing (the button said so),
    // the grid simply never re-read it, so neither your own picture nor
    // anybody else's ever appeared. It was hidden until now because the camera
    // used to be switched on during connect, before the first composition.
    //
    // A Tile holding the track changes when the track does, which is exactly
    // what structural equality should be comparing.
    /** The display name the server has for a LiveKit identity, or null if this
     *  is not one of ours. Identities are "p<participant id>" — see the
     *  livekit-token route, which mints them that way for exactly this. */
    private fun knownName(identity: String?): String? {
        val id = identity?.removePrefix("p")?.toIntOrNull() ?: return null
        return state?.participants?.firstOrNull { it.id == id }?.displayName?.takeIf { it.isNotEmpty() }
    }

    private fun refreshTiles() {
        val current = room ?: run { tiles = emptyList(); return }
        val participants = listOf<Participant>(current.localParticipant) + current.remoteParticipants.values
        tiles = participants.map { p ->
            // The server is what knows who is in this room. LiveKit's own name
            // is a convenience that arrives with the connection and can come
            // back empty after one is resumed — which is what backgrounding the
            // app did on iOS: the other player's tile came back as "?" and
            // stayed that way, because nothing redraws a tile whose camera is
            // off. Identities are minted as "p<participant id>" precisely so a
            // tile can be matched to the room state, so look the name up there
            // first and keep LiveKit's as the fallback rather than the source.
            val identity = p.identity?.value
            val mine = if (p is LocalParticipant) me?.displayName else null
            Tile(
                identity = identity.orEmpty(),
                name = knownName(identity)
                    ?: p.name?.takeIf { it.isNotEmpty() } ?: mine ?: identity ?: "?",
                isLocal = p is LocalParticipant,
                track = p.getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack,
                participant = p,
                isBlocked = p.identity?.value in blocked,
            )
        }
    }

    data class Tile(
        val identity: String,
        val name: String,
        val isLocal: Boolean,
        val track: VideoTrack?,
        val participant: Participant,
        /** Blocked by THIS viewer. Nobody else's screen changes. */
        val isBlocked: Boolean = false,
    ) {
        /**
         * The server's participant row, which is what every room endpoint is
         * keyed on. LiveKit identities are minted as "p<id>" precisely so this
         * is possible — see the livekit-token route.
         */
        val participantId: Int? get() = identity.removePrefix("p").toIntOrNull()
    }

    /**
     * Players this viewer has blocked, by LiveKit identity.
     *
     * Blocking is local and immediate: it unsubscribes from their tracks, so
     * their video and audio stop arriving at this device entirely. Nothing is
     * sent to the server and nobody else's screen changes — which is the
     * point. You should not have to ask anyone's permission to stop looking at
     * someone, and it works even when the person you want to block is the
     * host.
     */
    var blocked by mutableStateOf<Set<String>>(emptySet())
        private set

    suspend fun toggleBlock(tile: Tile) {
        if (tile.isLocal) return
        val remote = tile.participant as? RemoteParticipant ?: return
        val blocking = tile.identity !in blocked
        blocked = if (blocking) blocked + tile.identity else blocked - tile.identity

        // Unsubscribing, not muting locally: the track stops being delivered
        // at all, so a blocked player costs no bandwidth and cannot reappear
        // because some composable read the publication directly.
        remote.trackPublications.values.forEach { publication ->
            (publication as? RemoteTrackPublication)?.setSubscribed(!blocking)
        }
        refreshTiles()
    }

    suspend fun report(tile: Tile, reason: String) {
        val current = seat ?: return
        val id = tile.participantId ?: return
        runCatching { Api.report(current, id, reason) }
            .onSuccess { videoNote = "Reported. Block them too if you don't want to see or hear them." }
            .onFailure { error = it.message }
    }

    suspend fun removePlayer(tile: Tile) {
        val current = seat ?: return
        val id = tile.participantId ?: return
        runCatching { Api.removePlayer(current, id) }
            .onSuccess { refresh() }
            .onFailure { error = it.message }
    }

    private fun handleBroadcast(text: String) {
        val message = Api.parseBroadcast(text) ?: return
        if (message.stateVersion <= version) return
        viewModelScope.launch { refresh() }
    }

    // MARK: Host actions

    // A new round is a new argument. Whatever the last one turned down is no
    // longer anybody's decision to make.
    fun freezeRound(roundId: Int) = act { rejectedGuess = null; Api.freezeRound(it, roundId) }

    /** The round WAITING to be started, which is not always the one on the
     *  board: after a round finishes the board keeps its answers up while the
     *  next one is lined up. */
    val pendingInstanceId: Int? get() = state?.pendingInstanceId

    fun startRound() {
        val instanceId = pendingInstanceId ?: return
        act { Api.startRound(it, instanceId) }
    }

    /// What to say about the last guess, when the board cannot say it.
    ///
    /// A hit needs nothing — a row turns green. Everything else does: a near
    /// miss where they placed, a duplicate that it is already up there, and a
    /// miss that the name was not recognised AT ALL. That last one was silent
    /// until now, which is indistinguishable from the app being broken: you
    /// type a name, feel a buzz, and nothing happens.
    ///
    /// [emphatic] near misses shout; the rest murmur. Being close is news,
    /// being wrong is just an answer.
    data class GuessToast(val id: Int, val text: String, val emphatic: Boolean)

    var guessToast by mutableStateOf<GuessToast?>(null); private set
    private var guessToastCount = 0

    fun guess(raw: String) {
        val instanceId = round?.instanceId ?: return
        act {
            val result = Api.guess(it, instanceId, raw)
            lastGuess = result
            noteRejected(result, raw)
            showGuessToast(result, raw)
        }
    }

    /**
     * The last answer the list turned down, kept so the host can overrule it.
     *
     * Only on an unordered round, and only for the host — nobody else has a
     * decision to make, and a ranked round has no slot to invent. Cleared the
     * moment it is used or the round moves on, so the button can never be
     * about a guess from two questions ago.
     */
    var rejectedGuess by mutableStateOf<String?>(null); private set

    private fun noteRejected(result: GuessResult, raw: String) {
        if (isHost && round?.board?.ordered == false && result.verdict == "miss") {
            rejectedGuess = raw
        }
    }

    fun allowRejectedGuess() {
        val instanceId = round?.instanceId ?: return
        val raw = rejectedGuess ?: return
        rejectedGuess = null
        act { Api.allowGuess(it, instanceId, raw) }
    }

    fun dismissRejectedGuess() { rejectedGuess = null }

    private fun showGuessToast(result: GuessResult, raw: String) {
        val text: String
        val emphatic: Boolean

        when (result.verdict) {
            // The board just turned a row green. Nothing to add.
            "hit" -> return
            "near" -> {
                val rank = result.rank ?: return
                text = buildString {
                    append(result.name ?: "That one")
                    append(" · ")
                    append(ordinal(rank))
                    result.value?.let { v ->
                        append(", ${v.toInt()}")
                        // `unit` is only set for the odd metrics — a fee, a
                        // shirt number. An ordinary round sends nothing,
                        // because the metric IS the unit.
                        //
                        // "none" is the metric an authored round carries, since
                        // there was never a choice of metric to make on it. It
                        // is a marker, not a word to print.
                        val metric = round?.board?.metric.orEmpty().takeIf { m -> m != "none" }.orEmpty()
                        val unit = result.unit?.takeIf { u -> u.isNotEmpty() } ?: metric
                        if (unit.isNotEmpty()) append(" $unit")
                    }
                }
                emphatic = true
            }
            "duplicate" -> {
                text = "${result.name ?: raw} · already up there"
                emphatic = false
            }
            // Three different answers wearing one word. The database has
            // never heard of them; or it knows them and they do not qualify;
            // or it knows them because they were added AFTER this round was
            // frozen, in which case nothing can put them on this board.
            else -> {
                text = result.known?.let { "$it is not on this list" }
                    // Not "no such player" \u2014 the server has just gone to look
                    // them up, and if they belong here they will land on the
                    // board in a few seconds and score. Saying they do not
                    // exist and then adding them is how this read as a bug.
                    ?: if (result.checking) "Never heard of \u201C$raw\u201D \u2014 looking them up"
                    // An authored round has no database to have never heard of
                    // them: the answers are a list somebody wrote, and a name
                    // that is not on it is simply not on it.
                    else if (round?.board?.category != "football") "\u201C$raw\u201D is not on this list"
                    else "No player called \u201C$raw\u201D"
                emphatic = false
            }
        }

        guessToastCount += 1
        val shown = GuessToast(guessToastCount, text, emphatic)
        guessToast = shown
        // Long enough to read a name and a number, short enough not to sit
        // over the board while the next guess is being shouted.
        viewModelScope.launch {
            delay(3_500)
            if (guessToast?.id == shown.id) guessToast = null
        }
    }

    private fun ordinal(n: Int): String {
        val suffix = when {
            n % 100 in 11..13 -> "th"
            n % 10 == 1 -> "st"
            n % 10 == 2 -> "nd"
            n % 10 == 3 -> "rd"
            else -> "th"
        }
        return "$n$suffix"
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

    /** Look up the names this room did not recognise and add them, so the
     *  next game knows them. Explicitly asked for, never automatic: it
     *  fetches Wikipedia and writes new players into the database. */
    fun resolveReviews() = act { reportReviews(Api.resolveReviews(it)) }

    private fun reportReviews(result: ReviewResolution) {
        val text = when {
            result.added.isNotEmpty() -> "Added ${result.added.joinToString(", ")}"
            result.failed.isNotEmpty() -> "Could not find ${result.failed.joinToString(", ")}"
            result.alreadyKnown.isNotEmpty() -> "Already known: ${result.alreadyKnown.joinToString(", ")}"
            else -> "No unknown names to look up"
        }
        guessToastCount += 1
        val shown = GuessToast(guessToastCount, text, result.added.isNotEmpty())
        guessToast = shown
        viewModelScope.launch {
            delay(4_500)
            if (guessToast?.id == shown.id) guessToast = null
        }
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
        CallService.stop(getApplication())
        super.onCleared()
    }

    private companion object {
        const val SEAT_KEY = "seat"
        const val STATE_TOPIC = "gtl-state"
    }
}
