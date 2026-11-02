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

    /// Fixed, because the tooltip is positioned by its centre and one line of
    /// text at a known size has a known height. Measuring it would cost a
    /// frame of the tooltip in the wrong place.
    private static let tipHeight: CGFloat = 26
    /// Room for the arrow, and a hair of air above the chip.
    private static let tipGap: CGFloat = 8

    /// Which chip is showing its placing. The log index, so it stays with the
    /// guess it was opened on as later ones arrive and push the row along.
    @State private var tipFor: Int?
    /// The tooltip's own width, measured so it can be kept on screen. Zero
    /// until the first layout, which clamps to nothing — right, since a
    /// tooltip of no width cannot overhang an edge.
    @State private var tipWidth: CGFloat = 0

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
                            // Only a near miss has anything to say: it is the
                            // one verdict where the board gives no feedback at
                            // all, and "how close was that?" is the question
                            // the whole room asks out loud.
                            .anchorPreference(key: ChipAnchors.self, value: .bounds) {
                                item.guess.verdict == "near" ? [item.id: $0] : [:]
                            }
                            .onTapGesture {
                                guard item.guess.verdict == "near" else { return }
                                tipFor = tipFor == item.id ? nil : item.id
                            }
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
        // Drawn above the band, over the faces. The feed is 50pt and the
        // tooltip does not fit inside it — and should not, since a label that
        // pushed the row around would move the chip it is pointing at.
        .overlayPreferenceValue(ChipAnchors.self) { anchors in
            GeometryReader { proxy in
                if let id = tipFor, let anchor = anchors[id], let guess = guess(at: id) {
                    let chip = proxy[anchor]
                    tooltip(placing(guess))
                        .fixedSize()
                        .background(
                            GeometryReader { g in
                                Color.clear.preference(key: TipWidth.self, value: g.size.width)
                            }
                        )
                        .position(
                            x: clamped(chip.midX, within: proxy.size.width),
                            y: -(Self.tipGap + Self.tipHeight / 2)
                        )
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .scale(scale: 0.85, anchor: .bottom).combined(with: .opacity)
                        )
                }
            }
            // The chip underneath takes the tap that closes it, and a tooltip
            // that swallowed touches would sit over a face holding a finger
            // off the person behind it.
            .allowsHitTesting(false)
            .onPreferenceChange(TipWidth.self) { tipWidth = $0 }
            .animation(
                reduceMotion ? .easeOut(duration: 0.15)
                             : .spring(response: 0.28, dampingFraction: 0.78),
                value: tipFor
            )
        }
        // Long enough to read five characters and a number, and gone before
        // it can sit over somebody's face for the recording.
        .task(id: tipFor) {
            guard tipFor != nil else { return }
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            tipFor = nil
        }
        // A new round is a new log, so the index it was anchored to means
        // something else now.
        .onChange(of: store.round?.instanceId) { tipFor = nil }
    }

    private func guess(at id: Int) -> ReplayGuess? {
        items.first { $0.id == id }?.guess
    }

    /// Kept clear of both edges, so a chip at the end of the row does not get
    /// a tooltip hanging half off the screen.
    private func clamped(_ x: CGFloat, within width: CGFloat) -> CGFloat {
        let margin = tipWidth / 2 + 10
        guard width > margin * 2 else { return width / 2 }
        return min(max(x, margin), width - margin)
    }

    /// "12th (4 goals)", or just the placing when the round was played before
    /// the server logged the number.
    private func placing(_ guess: ReplayGuess) -> String {
        guard let rank = guess.matchedRank else { return "" }
        guard let value = guess.value, let stat = stat(value, unit: guess.unit) else {
            return ordinal(rank)
        }
        return "\(ordinal(rank)) (\(stat))"
    }

    /// The same rules the board badge uses, because the two numbers describe
    /// the same thing and reading differently would make them look unrelated.
    private func stat(_ value: Double, unit: String?) -> String? {
        if unit == "shirt" { return nil }
        if unit == "fee" { return BoardStyle.money(value) }
        // `unit` is only set for the odd metrics. On an ordinary round the
        // metric IS the unit — and "none" is the marker an authored round
        // carries, not a word to print.
        let metric = store.round?.board.metric == "none" ? "" : (store.round?.board.metric ?? "")
        let word = unit?.isEmpty == false ? unit! : metric
        let number = String(safeInt(value))
        return word.isEmpty ? number : "\(number) \(word)"
    }

    private func tooltip(_ text: String) -> some View {
        VStack(spacing: 0) {
            Text(text)
                .font(.body(13, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .frame(height: Self.tipHeight)
                .background(Capsule().fill(Color.orange.opacity(0.92)))
            // Pointing at the chip it belongs to. Without it the label floats
            // over the faces attached to nothing.
            Arrow()
                .fill(Color.orange.opacity(0.92))
                .frame(width: 10, height: 5)
        }
        .shadow(color: .black.opacity(0.35), radius: 8, y: 3)
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
        // The placing is read out rather than hidden behind a tap: a tooltip
        // nobody can see is not a thing VoiceOver should make you hunt for.
        .accessibilityLabel(
            [name, guess.raw, guess.verdict, guess.verdict == "near" ? placing(guess) : nil]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: ", ")
        )
    }
}

/// Where each near-miss chip is, in the band's own space, so the tooltip can
/// be drawn above it wherever the row has been scrolled to.
private struct ChipAnchors: PreferenceKey {
    static let defaultValue: [Int: Anchor<CGRect>] = [:]
    static func reduce(value: inout [Int: Anchor<CGRect>], nextValue: () -> [Int: Anchor<CGRect>]) {
        value.merge(nextValue()) { _, new in new }
    }
}

private struct TipWidth: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        let next = nextValue()
        if next > 0 { value = next }
    }
}

/// A downward triangle. Five points tall, which is as much as a 26pt label
/// can carry without the tail looking like a separate object.
private struct Arrow: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
