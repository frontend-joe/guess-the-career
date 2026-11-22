import SwiftUI

// Who is in the room, for a game that has no faces in it.
//
// With video on, the bottom third answers this without being asked: you can
// see who is here. Turn video off and the room goes anonymous — the only
// evidence anybody else exists is a guess chip scrolling past with a name on
// it, and a player who has not said anything yet leaves no trace at all. The
// host could not tell whether their mates had got in.
//
// So the band under the board lists them instead. Everyone who ever joined,
// kept permanently: the rows behind this are never deleted, so somebody whose
// phone died mid-round is still part of this game and still shown — greyed
// rather than gone, which is the difference between "they left" and "they
// were never here". The same list on every device, in slot order, so the
// third card from the left is the same person on all four screens.
struct PlayersView: View {
    @Environment(RoomStore.self) private var store

    /// Four to a row, like the video grid, so a room laid out one way does
    /// not change shape when the same people play it the other way.
    private static let perRow = 4

    private var players: [RoomParticipant] {
        store.state?.participants.sorted { $0.slot < $1.slot } ?? []
    }

    var body: some View {
        let players = self.players
        VStack(spacing: 8) {
            ForEach(Array(stride(from: 0, to: players.count, by: Self.perRow)), id: \.self) { start in
                HStack(spacing: 8) {
                    // A short row stretches to fill the width rather than
                    // leaving a gap where the missing cards would be. The
                    // filler used to be Color.clear, which is flexible in
                    // BOTH directions — so two empty cells in a room of two
                    // took every spare point of HEIGHT as well, and the band
                    // sat marooned between the question and the guesses.
                    ForEach(players[start..<min(start + Self.perRow, players.count)]) { player in
                        CardView(player: player)
                    }
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(BoardStyle.background)
    }
}

private struct CardView: View {
    @Environment(RoomStore.self) private var store
    let player: RoomParticipant

    @State private var confirmingRemove = false

    /// Mirrors the video grid: the host can clear anybody but themselves.
    private var canRemove: Bool { store.isHost && player.id != store.me?.id }

    private var initials: String {
        let words = player.displayName.split(separator: " ").prefix(2)
        return words.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    var body: some View {
        VStack(spacing: 6) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: player.isHost
                            ? [BoardStyle.violet.top, BoardStyle.violet.bottom]
                            : [Color(white: 0.26), Color(white: 0.17)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 34, height: 34)
                .overlay {
                    Text(initials)
                        .font(.body(13))
                        .foregroundStyle(.white)
                }

            // The name as they gave it, everybody's the same way — your own
            // card says your name rather than "You". This is the list of who
            // is in the room, and a room where one card is labelled from the
            // reader's point of view is not the same list on four screens.
            // Truncated rather than wrapped: a second line would make one
            // card taller than its neighbours and the whole row with it.
            Text(player.displayName)
                .font(.body(12))
                .foregroundStyle(Color(white: 0.88))
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(BoardStyle.titleBand)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 1)
        }
        // Still listed, visibly not here. A card that simply vanished would
        // make the room look like it had never had them in it.
        .opacity(player.present ? 1 : 0.4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            player.displayName
                + (player.isHost ? ", host" : "")
                + (player.present ? "" : ", left")
        )
        // The same long press the faces answer to, so the gesture does not
        // change with the kind of room you are in.
        .contextMenu {
            if canRemove {
                Button(role: .destructive) { confirmingRemove = true } label: {
                    Label("Remove from game", systemImage: "person.fill.xmark")
                }
            }
        }
        .confirmationDialog(
            "Remove \(player.displayName) from the game?",
            isPresented: $confirmingRemove,
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                Task { await store.removeParticipant(id: player.id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("They lose their place and their invite stops working.")
        }
    }
}
