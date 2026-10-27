import AVFoundation
import Foundation
import LiveKit
import Observation

// Owns the room: the seat, the authoritative state, and the LiveKit connection
// that carries both the video and the server's state broadcasts.
//
// The contract matches the web harness exactly, and it is deliberate: a
// broadcast says only that the version moved, and the board on screen always
// came from GET /state. That keeps one code path from the event log to a
// board — the same fold the recorded video will be rendered from. A client
// that applied broadcasts directly would be a second implementation of that
// fold, free to drift, and nobody would notice until a recording showed
// something the players never saw.
@MainActor
@Observable
final class RoomStore {
    enum Phase: Equatable {
        case lobby
        case inRoom
    }

    private(set) var phase: Phase = .lobby
    private(set) var seat: Seat?
    private(set) var state: RoomState?
    private(set) var tiles: [Tile] = []

    /// A code pulled out of an invite link and not yet used. The lobby reads
    /// it, so a link lands you on "type your name" rather than joining under
    /// whatever name happened to be in the field.
    var pendingJoinCode: String?

    var accessToken: String?
    var error: String?
    var videoNote: String?
    var lastGuess: GuessResult?

    // Stored, not computed from LiveKit. @Observable tracks this object's own
    // properties; it cannot see into room.localParticipant, so a computed
    // version read the truth and then never told SwiftUI it had changed — the
    // buttons sat there showing the old state however often you tapped them.
    private(set) var cameraOn = false
    private(set) var microphoneOn = false

    /// The version already on screen. Anything higher means we are behind;
    /// anything lower is an out-of-order message to ignore.
    private var version = 0
    private var room: Room?
    private var poller: Task<Void, Never>?

    struct Tile: Identifiable, Equatable {
        let id: String
        let name: String
        let isLocal: Bool
        let participant: Participant

        static func == (a: Tile, b: Tile) -> Bool { a.id == b.id && a.name == b.name }
    }

    var me: RoomParticipant? {
        guard let seat else { return nil }
        return state?.participants.first { $0.id == seat.participantId }
    }

    var isHost: Bool { me?.isHost == true }
    var round: RoomRound? { state?.round }

    // MARK: - Invite links

    /// The invite. One shape across all three clients — /join/<CODE> — because
    /// it is also what the website routes and what the two association files
    /// claim. A link that opens the app on one platform and the website on the
    /// other would be the same bug twice.
    var inviteLink: URL? {
        guard let code = state?.code else { return nil }
        return URL(string: "https://guessthelist.xyz/join/\(code)")
    }

    /// Handle https://guessthelist.xyz/join/<CODE>. Anything else is ignored
    /// rather than guessed at.
    func handleInvite(_ url: URL) {
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.first == "join", let code = parts.dropFirst().first else { return }
        let cleaned = code.uppercased().filter { $0.isLetter || $0.isNumber }
        guard !cleaned.isEmpty else { return }
        pendingJoinCode = cleaned
    }

    // MARK: - Entering and leaving

    func enter(_ joined: JoinedRoom) {
        let seat = Seat(code: joined.code, participantId: joined.participantId, token: joined.participantToken)
        self.seat = seat
        self.state = joined.state
        self.version = joined.stateVersion
        self.phase = .inRoom
        SeatStore.save(seat)
        startPolling()
        Task { await connectMedia() }
    }

    // Leave the screen FIRST, then tell the network. Everything that was once
    // above this line — the leave call, LiveKit's disconnect — waits on
    // something that can hang, and while it hung the button looked broken:
    // you tapped Leave and sat in the room.
    //
    // Going to the lobby is not a request that can fail, so it does not wait
    // on anything that can.
    func exit(announce: Bool = true) async {
        let leaving = seat
        let room = self.room

        poller?.cancel()
        poller = nil
        self.room = nil
        tiles = []
        seat = nil
        state = nil
        version = 0
        phase = .lobby
        SeatStore.clear()

        if announce, let leaving { try? await API.leave(seat: leaving) }
        await room?.disconnect()
    }

    /// Restore a seat kept from a previous launch, if the server still knows it.
    func restoreSeat() async {
        guard let saved = SeatStore.load() else { return }
        seat = saved
        do {
            let fresh = try await API.roomState(seat: saved)
            state = fresh
            version = fresh.stateVersion
            phase = .inRoom
            startPolling()
            await connectMedia()
        } catch let failure as API.Failure where failure.isGone {
            seat = nil
            SeatStore.clear()
        } catch {
            // Probably the network. Keep the seat and let the poll try again.
            seat = nil
        }
    }

    // MARK: - State

    func refresh() async {
        guard let seat else { return }
        do {
            let next = try await API.roomState(seat: seat)
            guard next.stateVersion >= version else { return }
            version = next.stateVersion
            state = next
            // The host ended it. Everyone else finds out here, on the next
            // poll or the next broadcast, rather than staying in a room that
            // no longer exists.
            if next.status == "ended" {
                error = "The host ended the game."
                await exit(announce: false)
            }
        } catch let failure as API.Failure where failure.isGone {
            error = "That room is no longer available."
            await exit(announce: false)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // The backstop. If a broadcast is lost, or LiveKit is unreachable, the game
    // still advances — just a few seconds late.
    private func startPolling() {
        poller?.cancel()
        poller = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(for: .seconds(10))
            }
        }
    }

    // MARK: - Media

    private func connectMedia() async {
        guard let seat else { return }
        let credentials: LivekitCredentials
        do {
            credentials = try await API.livekitCredentials(seat: seat)
        } catch {
            videoNote = "No video: \(error.localizedDescription)"
            return
        }

        let room = Room(delegate: self)
        self.room = room
        do {
            // Connect first, permissions second. The data channel carries the
            // state broadcasts, so the game has to keep working for someone
            // who says no to the camera — or who is still reading the prompt.
            try await room.connect(url: credentials.url, token: credentials.token)
        } catch {
            videoNote = "Video failed: \(error.localizedDescription)"
            return
        }

        // You arrive muted with your camera off, and turn them on when you are
        // ready. Joining a call already broadcasting is how people end up on
        // camera before they meant to be.
        //
        // Nothing is asked for here either: setCamera and setMicrophone each
        // await the permission prompt before publishing, so the prompt arrives
        // when you tap the button and means what it says.
        syncMediaState()
        refreshTiles()
    }

    private func permissionNote(camera: Bool, microphone: Bool) -> String? {
        switch (camera, microphone) {
        case (true, true): return nil
        case (false, false): return "Camera and mic are off — turn them on in Settings."
        case (false, true): return "Camera is off — turn it on in Settings."
        case (true, false): return "Mic is off — turn it on in Settings."
        }
    }

    func setCamera(_ on: Bool) async {
        // A nil room is not "nothing happened" — it means the call never
        // connected, and silently doing nothing is what made this look like a
        // dead button rather than a failed connection.
        guard let room else {
            videoNote = videoNote ?? "Not connected to the call yet."
            return
        }
        // Turning it on is the first time permission is needed, now that the
        // app no longer asks at connect. Denied and not-yet-asked need
        // different messages: one is a trip to Settings, the other is just a
        // prompt that has not been answered.
        if on {
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .denied, .restricted:
                videoNote = "Camera is blocked — allow it for Tenable in Settings."
                return
            case .notDetermined:
                guard await AVCaptureDevice.requestAccess(for: .video) else {
                    videoNote = "Camera is off — you declined the prompt."
                    return
                }
            default:
                break
            }
        }
        do {
            try await room.localParticipant.setCamera(enabled: on)
            if on { videoNote = nil }
        } catch {
            videoNote = "Could not \(on ? "start" : "stop") your camera: \(error.localizedDescription)"
        }
        syncMediaState()
        refreshTiles()
    }

    func setMicrophone(_ on: Bool) async {
        guard let room else {
            videoNote = videoNote ?? "Not connected to the call yet."
            return
        }
        if on {
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .denied, .restricted:
                videoNote = "Mic is blocked — allow it for Tenable in Settings."
                return
            case .notDetermined:
                guard await AVCaptureDevice.requestAccess(for: .audio) else {
                    videoNote = "Mic is off — you declined the prompt."
                    return
                }
            default:
                break
            }
        }
        do {
            try await room.localParticipant.setMicrophone(enabled: on)
            if on { videoNote = nil }
        } catch {
            videoNote = "Could not \(on ? "unmute" : "mute"): \(error.localizedDescription)"
        }
        syncMediaState()
        refreshTiles()
    }

    /// Read LiveKit's truth into our own observable properties. Called after
    /// every toggle and on every track event, because a track can also be
    /// stopped from outside this app.
    private func syncMediaState() {
        cameraOn = room?.localParticipant.isCameraEnabled() ?? false
        microphoneOn = room?.localParticipant.isMicrophoneEnabled() ?? false
    }

    fileprivate func refreshTiles() {
        guard let room else { tiles = []; cameraOn = false; microphoneOn = false; return }
        cameraOn = room.localParticipant.isCameraEnabled()
        microphoneOn = room.localParticipant.isMicrophoneEnabled()
        let everyone: [Participant] = [room.localParticipant] + Array(room.remoteParticipants.values)
        tiles = everyone.map {
            Tile(
                id: $0.identity?.stringValue ?? UUID().uuidString,
                name: ($0.name?.isEmpty == false ? $0.name : nil) ?? $0.identity?.stringValue ?? "?",
                isLocal: $0 is LocalParticipant,
                participant: $0
            )
        }
    }

    fileprivate func handleBroadcast(_ data: Data) {
        struct Broadcast: Decodable { let stateVersion: Int }
        guard let message = try? JSONDecoder().decode(Broadcast.self, from: data) else { return }
        guard message.stateVersion > version else { return }
        Task { await refresh() }
    }

    // MARK: - Host actions

    func freezeRound(roundId: Int) async {
        await act { seat in _ = try await API.freezeRound(seat: seat, roundId: roundId) }
    }

    func startRound() async {
        guard let instanceId = round?.instanceId else { return }
        await act { seat in _ = try await API.startRound(seat: seat, instanceId: instanceId) }
    }

    func guess(_ raw: String) async {
        guard let instanceId = round?.instanceId else { return }
        await act { [weak self] seat in
            let result = try await API.guess(seat: seat, instanceId: instanceId, raw: raw)
            await MainActor.run { self?.lastGuess = result }
        }
    }

    // Posting bumps the room's version, so the message comes back through the
    // same /state refresh everything else does. Nothing is appended locally:
    // one path from the server's state to the screen, chat included.
    func sendChat(_ body: String) async {
        let text = body.trimmed
        guard !text.isEmpty else { return }
        await act { seat in _ = try await API.sendChat(seat: seat, body: text) }
    }

    func takeHint(rank: Int) async {
        guard let instanceId = round?.instanceId else { return }
        await act { seat in _ = try await API.hint(seat: seat, instanceId: instanceId, rank: rank) }
    }

    // Ending the game used to leave the host sitting in the room it had just
    // ended: the server marked it ended, /state still returned it, and the
    // screen did not change. Ending a game means leaving it.
    func endGame() async {
        await act { seat in try await API.endRoom(seat: seat) }
        guard error == nil else { return }
        await exit(announce: false)
    }

    private func act(_ body: @escaping (Seat) async throws -> Void) async {
        guard let seat else { return }
        error = nil
        do {
            try await body(seat)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - LiveKit

extension RoomStore: RoomDelegate {
    nonisolated func room(_ room: Room, participantDidConnect participant: RemoteParticipant) {
        Task { @MainActor in refreshTiles() }
    }

    nonisolated func room(_ room: Room, participantDidDisconnect participant: RemoteParticipant) {
        Task { @MainActor in refreshTiles() }
    }

    nonisolated func room(
        _ room: Room, participant: RemoteParticipant?, didReceiveData data: Data,
        forTopic topic: String, encryptionType: EncryptionType
    ) {
        guard topic == "gtl-state" else { return }
        Task { @MainActor in handleBroadcast(data) }
    }

    // These signatures have to match the protocol exactly. They are optional
    // @objc methods, so a near-miss — TrackPublication where the protocol says
    // RemoteTrackPublication — compiles happily and then simply never fires.
    // That is how remote video came to never appear: the only thing refreshing
    // the tiles was a participant connecting, which happens before they have
    // published anything.
    nonisolated func room(
        _ room: Room, participant: RemoteParticipant, didSubscribeTrack publication: RemoteTrackPublication
    ) {
        Task { @MainActor in refreshTiles() }
    }

    nonisolated func room(
        _ room: Room, participant: RemoteParticipant, didUnsubscribeTrack publication: RemoteTrackPublication
    ) {
        Task { @MainActor in refreshTiles() }
    }

    nonisolated func room(
        _ room: Room, participant: LocalParticipant, didPublishTrack publication: LocalTrackPublication
    ) {
        Task { @MainActor in refreshTiles() }
    }

    nonisolated func room(
        _ room: Room, participant: LocalParticipant, didUnpublishTrack publication: LocalTrackPublication
    ) {
        Task { @MainActor in refreshTiles() }
    }

    // A track can be muted from outside this app, so the buttons follow the
    // room rather than only their own taps.
    nonisolated func room(
        _ room: Room, participant: Participant, trackPublication: TrackPublication, didUpdateIsMuted isMuted: Bool
    ) {
        Task { @MainActor in refreshTiles() }
    }
}

// A seat outlives the process, so a crash or a backgrounded app that gets
// killed does not cost a guest their slot — and with it, their tile position
// in whatever gets recorded.
enum SeatStore {
    private static let key = "gtl.seat"

    static func save(_ seat: Seat) {
        guard let data = try? JSONEncoder().encode(seat) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> Seat? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Seat.self, from: data)
    }

    static func clear() { UserDefaults.standard.removeObject(forKey: key) }
}
