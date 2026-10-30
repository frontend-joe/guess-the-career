import SwiftUI

// Every guess as it lands, in a band of its own under the faces.
//
// The board says what was RIGHT. It cannot say who said it, and it says
// nothing at all about the nineteen wrong answers that got you there — which
// is most of what actually happens in a round, and most of what is worth
// hearing back on the recording. So the names live here instead: a shallow
// strip of the last few guesses, newest nearest the edge you read from.
//
// 50pt, fixed. It is a single row of pills rather than a scrolling list on
// purpose: a band this short can show one line well or two lines badly, and
// the thing being watched is the newest guess arriving, not the history.
struct GuessFeedView: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    static let height: CGFloat = 50

    /// How many fit before the rest is scrolled to. More than the eye can
    /// follow anyway; the point of the tail is that a guess you glanced away
    /// from has not gone.
    private static let window = 12

    /// A guess plus its place in the round's log. The log is append-only, so
    /// the index is a stable identity — which is what lets SwiftUI animate an
    /// arrival rather than redraw the whole row.
    private struct Item: Identifiable {
        let id: Int
        let guess: ReplayGuess
    }

    private var items: [Item] {
        guard let guesses = store.round?.board.guesses else { return [] }
        return guesses.enumerated()
            .suffix(Self.window)
            .map { Item(id: $0.offset, guess: $0.element) }
            .reversed()
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(items) { item in
                    pill(item.guess)
                        .transition(
                            reduceMotion
                                ? .opacity
                                // In from the edge it arrived at, which is the
                                // one the eye is already on.
                                : .scale(scale: 0.7, anchor: .leading)
                                    .combined(with: .opacity)
                        )
                }
            }
            .padding(.horizontal, 14)
            .frame(height: Self.height)
            // Keyed on the newest id: a guess arriving is the only change
            // worth animating, and a resync that re-sends the same log should
            // not replay the whole row.
            .animation(
                reduceMotion ? .easeOut(duration: 0.18)
                             : .spring(response: 0.3, dampingFraction: 0.72),
                value: items.first?.id
            )
        }
        .frame(height: Self.height)
        .background(BoardStyle.background)
    }

    // Name first, then what they said. That order because the name is what
    // the board cannot tell you, and because a column of names down the left
    // is scannable in a way a column of guesses is not.
    private func pill(_ guess: ReplayGuess) -> some View {
        let colour = verdictColour(guess.verdict)
        let name = store.displayName(ofParticipant: guess.byParticipantId)

        return HStack(spacing: 5) {
            if let name {
                Text(name)
                    .font(.body(12, weight: .bold))
                    .foregroundStyle(colour)
            }
            Text(guess.raw)
                .font(.body(13, weight: .medium))
                .foregroundStyle(.white.opacity(0.92))
        }
        .lineLimit(1)
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .background(
            Capsule()
                // Tinted by the verdict rather than coloured by it: twelve
                // filled pills in four colours is a bag of sweets, and the
                // board is already where colour means something.
                .fill(colour.opacity(0.16))
                .overlay(Capsule().strokeBorder(colour.opacity(0.35), lineWidth: 1))
        )
        .accessibilityLabel(
            [name, guess.raw, guess.verdict].compactMap { $0 }.joined(separator: ", ")
        )
    }
}
