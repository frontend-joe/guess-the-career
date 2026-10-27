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

    var accessToken: String?
    var error: String?
    var videoNote: String?
    var lastGuess: GuessResult?

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

    func exit(announce: Bool = true) async {
        if announce, let seat { try? await API.leave(seat: seat) }
        poller?.cancel()
        poller = nil
        await room?.disconnect()
        room = nil
        tiles = []
        seat = nil
        state = nil
        version = 0
        phase = .lobby
        SeatStore.clear()
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
            try await room.connect(url: credentials.url, token: credentials.token)
            try await room.localParticipant.setCamera(enabled: true)
            try await room.localParticipant.setMicrophone(enabled: true)
            videoNote = nil
            refreshTiles()
        } catch {
            videoNote = "Video failed: \(error.localizedDescription)"
        }
    }

    func setCamera(_ on: Bool) async {
        guard let room else { return }
        try? await room.localParticipant.setCamera(enabled: on)
        refreshTiles()
    }

    func setMicrophone(_ on: Bool) async {
        guard let room else { return }
        try? await room.localParticipant.setMicrophone(enabled: on)
        refreshTiles()
    }

    var cameraOn: Bool { room?.localParticipant.isCameraEnabled() ?? false }
    var microphoneOn: Bool { room?.localParticipant.isMicrophoneEnabled() ?? false }

    fileprivate func refreshTiles() {
        guard let room else { tiles = []; return }
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

    func takeHint(rank: Int) async {
        guard let instanceId = round?.instanceId else { return }
        await act { seat in _ = try await API.hint(seat: seat, instanceId: instanceId, rank: rank) }
    }

    func endGame() async {
        await act { seat in try await API.endRoom(seat: seat) }
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

    nonisolated func room(
        _ room: Room, participant: Participant, didSubscribeTrack publication: TrackPublication
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
