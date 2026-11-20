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
                    ForEach(players[start..<min(start + Self.perRow, players.count)]) { player in
                        CardView(player: player, isYou: player.id == store.me?.id)
                    }
                    // A short last row keeps its cards the width of all the
                    // others rather than stretching two of them across the
                    // screen.
                    if start + Self.perRow > players.count {
                        ForEach(0..<(start + Self.perRow - players.count), id: \.self) { _ in
                            Color.clear
                        }
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
    let player: RoomParticipant
    let isYou: Bool

    /// The most of a name that fits on a card a quarter of the screen wide.
    /// Truncated rather than wrapped: two lines would make this card taller
    /// than its neighbours and the whole row with it.
    private var shortName: String {
        player.displayName.split(separator: " ").first.map(String.init) ?? player.displayName
    }

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

            Text(isYou ? "You" : shortName)
                .font(.body(12))
                .foregroundStyle(isYou ? .white : Color(white: 0.78))
                .lineLimit(1)
                .truncationMode(.tail)
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
            "\(isYou ? "You" : player.displayName)"
                + (player.isHost ? ", host" : "")
                + (player.present ? "" : ", left")
        )
    }
}
