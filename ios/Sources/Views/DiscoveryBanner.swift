import SwiftUI

/// The trophy: somebody named a player the database had never heard of.
///
/// It is the rarest thing that happens in a round and the game used to draw it
/// exactly like any other correct answer — a row turns green and nothing says
/// that the name was not merely missing from the board, it was missing from
/// the game. Scoring does not change; the moment does.
///
/// Over the board rather than in the question band, because the guess toast
/// already owns that strip and these can land in the same second. Gold against
/// a green-and-violet board, which is the one colour the board does not
/// already use.
struct DiscoveryBanner: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let gold = Color(red: 0.98, green: 0.78, blue: 0.22)
    private static let ink = Color(red: 0.12, green: 0.09, blue: 0.02)

    var body: some View {
        if let found = store.discovery {
            content(found)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .scale(scale: 0.82).combined(with: .opacity)
                )
                .animation(
                    reduceMotion ? .easeOut(duration: 0.2)
                                 : .spring(response: 0.42, dampingFraction: 0.72),
                    value: store.discovery
                )
        }
    }

    @ViewBuilder
    private func content(_ found: Discovery) -> some View {
        VStack(spacing: 6) {
            Text("NEW PLAYER DISCOVERED")
                .font(.body(11, weight: .heavy))
                // Small caps text wants tracking opened up; the display face
                // above wants it closed. Both are size-specific, neither is
                // one value for the screen.
                .tracking(1.6)
                .foregroundStyle(Self.ink.opacity(0.65))

            Text(found.name.uppercased())
                .font(.display(22))
                .tracking(-0.4)
                .foregroundStyle(Self.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)

            Text(credit(found))
                .font(.body(13, weight: .semibold))
                .foregroundStyle(Self.ink.opacity(0.75))
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 16)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Self.gold)
                .shadow(color: .black.opacity(0.55), radius: 22, y: 8)
        )
        .overlay(
            // A bright inner edge, so the card reads as a lit surface rather
            // than a flat fill sitting on the board.
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
        // It clears itself after six seconds; this is for whoever has already
        // read it and wants the board back.
        .onTapGesture { store.clearDiscovery() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("New player discovered: \(found.name). \(credit(found))")
    }

    /// Whoever said it gets the trophy, by name where the room knows it.
    private func credit(_ found: Discovery) -> String {
        let place = "\(ordinal(found.rank)) on this board"
        guard let who = store.displayName(ofParticipant: found.byParticipantId) else {
            return "Nobody had ever recorded them — \(place)"
        }
        return "\(who) named someone nobody had ever recorded — \(place)"
    }
}
