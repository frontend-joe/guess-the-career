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

    /// One height for everything in the row. The typing chip and a guess
    /// have different contents — three dots against two runs of text — and
    /// padding alone gave them visibly different heights sitting side by
    /// side. Stating it once is the only way they stay equal.
    private static let chipHeight: CGFloat = 32

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
        let names = store.typingNames

        return ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    // A chip of its own at the head of the row, where the
                    // guess being typed will land. Nothing in it but the
                    // dots: the pill it is about to become carries the name,
                    // and saying it twice three seconds apart is noise. The
                    // band no longer grows for it either, which is one less
                    // thing moving while people are reading.
                    if !names.isEmpty {
                        typingChip
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    : .scale(scale: 0.7, anchor: .leading)
                                        .combined(with: .opacity)
                            )
                            .accessibilityLabel(typingText(names))
                    }

                    ForEach(items) { item in
                        pill(item.guess)
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    // In from the edge it arrived at, which is
                                    // the one the eye is already on.
                                    : .scale(scale: 0.7, anchor: .leading)
                                        .combined(with: .opacity)
                            )
                    }
                }
                .padding(.horizontal, 14)
                // Keyed on the newest id: a guess arriving is the only change
                // worth animating, and a resync that re-sends the same log
                // should not replay the whole row.
                .animation(
                    reduceMotion ? .easeOut(duration: 0.18)
                                 : .spring(response: 0.3, dampingFraction: 0.72),
                    value: items.first?.id
                )
                // The chip arriving and leaving is its own change, and the
                // row should close up behind it the same way it opens.
                .animation(
                    reduceMotion ? .easeOut(duration: 0.18)
                                 : .spring(response: 0.3, dampingFraction: 0.72),
                    value: names.isEmpty
                )
        }
        .frame(height: Self.height)
        .background(BoardStyle.background)
    }

    /// The same pill a guess gets, in the one colour no verdict uses. It has
    /// to read as a member of the row — it is standing where the next guess
    /// will go — without reading as a verdict of its own.
    private var typingChip: some View {
        TypingDots(size: 4, lift: 2.5)
            .padding(.horizontal, 13)
            .frame(height: Self.chipHeight)
            .background(
                Capsule()
                    .fill(.white.opacity(0.10))
                    .overlay(Capsule().strokeBorder(.white.opacity(0.22), lineWidth: 1))
            )
    }

    /// No trailing ellipsis in the text: the dots are drawn, and animated.
    private func typingText(_ names: [String]) -> String {
        switch names.count {
        case 0: return ""
        case 1: return "\(names[0]) is typing"
        case 2: return "\(names[0]) and \(names[1]) are typing"
        default: return "\(names.count) people are typing"
        }
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
        .frame(height: Self.chipHeight)
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
