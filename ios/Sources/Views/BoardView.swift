import SwiftUI

// A port of PyramidRow from client/src/pages/TenablePage.tsx, kept
// deliberately faithful: the same widths, the same two gradients, the same
// value badge. Three clients drawing the same board differently would be
// three chances for the recorded video to look like none of them.
//
// The geometry is the show's: narrowest at rank 1, widening to full width at
// rank 10 as the board descends.
enum BoardStyle {
    static let green = (
        top: Color(red: 0.290, green: 0.871, blue: 0.502),     // tailwind green-400
        bottom: Color(red: 0.086, green: 0.639, blue: 0.290)   // green-600
    )
    static let violet = (
        top: Color(red: 0.545, green: 0.361, blue: 0.965),     // violet-500
        bottom: Color(red: 0.427, green: 0.157, blue: 0.851)   // violet-700
    )

    /// 56% at rank 1, widening by 4.9 points a row — the web game's formula.
    static func widthFraction(rank: Int) -> CGFloat {
        min(1.0, (56 + CGFloat(rank - 1) * 4.9) / 100)
    }
}

struct BoardView: View {
    @Environment(RoomStore.self) private var store

    var body: some View {
        if let round = store.round {
            VStack(spacing: 6) {
                GeometryReader { geo in
                    VStack(spacing: 5) {
                        ForEach(1...max(round.board.target, 1), id: \.self) { rank in
                            PyramidRow(
                                rank: rank,
                                answer: round.board.revealed.first { $0.rank == rank },
                                hint: round.board.hints.first { $0.rank == rank },
                                impliedClues: round.board.impliedClues,
                                canHint: store.isHost && round.isLive,
                                onHint: { Task { await store.takeHint(rank: rank) } }
                            )
                            .frame(width: geo.size.width * BoardStyle.widthFraction(rank: rank))
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .frame(height: geo.size.height)
                }
                .padding(.horizontal, 10)
            }
            .padding(.vertical, 6)
        } else {
            VStack(spacing: 6) {
                Text("No round yet").font(.body(15)).foregroundStyle(.secondary)
                if store.isHost {
                    Text("Choose a round, then Start.")
                        .font(.body(12)).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct PyramidRow: View {
    let rank: Int
    let answer: RevealedAnswer?
    let hint: TakenHint?
    let impliedClues: [String]
    let canHint: Bool
    let onHint: () -> Void

    var body: some View {
        ZStack {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: answer != nil
                            ? [BoardStyle.green.top, BoardStyle.green.bottom]
                            : [BoardStyle.violet.top, BoardStyle.violet.bottom],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                // The web row carries a green glow when it lands; without it a
                // find reads as a colour swap rather than an event.
                .shadow(
                    color: answer != nil ? BoardStyle.green.top.opacity(0.55) : .clear,
                    radius: 9, y: 2
                )

            if let answer {
                HStack(spacing: 7) {
                    Text(answer.name.uppercased())
                        .font(.display(14))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(valueText(answer))
                        .font(.display(11))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .frame(minWidth: 24, minHeight: 22)
                        .background(Capsule().fill(.black.opacity(0.35)))
                }
                .padding(.horizontal, 12)
            } else if let hint {
                // A taken clue replaces the rank number rather than adding a
                // line, so the pyramid keeps its shape.
                Text(clueText(hint))
                    .font(.body(11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.95))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            } else {
                Text("\(rank)")
                    .font(.display(17))
                    .foregroundStyle(.white.opacity(0.95))
            }
        }
        .frame(maxHeight: .infinity)
        .contentShape(Capsule())
        // Press and hold a blank slot for a clue, exactly as on the web.
        .onLongPressGesture(minimumDuration: 1.0) {
            guard answer == nil, hint == nil, canHint else { return }
            onHint()
        }
    }

    private func valueText(_ answer: RevealedAnswer) -> String {
        let number = String(Int(answer.value))
        guard let unit = answer.unit, !unit.isEmpty else { return number }
        return "\(number) \(unit)"
    }

    private func clueText(_ hint: TakenHint) -> String {
        let fields: [(String, String)] = [
            ("nationality", "Nationality"), ("position", "Position"), ("years", "Years"),
            ("club", "Club"), ("squadNumber", "Shirt"), ("born", "Born"),
        ]
        let parts = fields.compactMap { key, label -> String? in
            guard !impliedClues.contains(key), let value = hint.clue?[key]?.display else { return nil }
            return "\(label): \(value)"
        }
        return parts.isEmpty ? "Nothing to give away" : parts.joined(separator: " · ")
    }
}
