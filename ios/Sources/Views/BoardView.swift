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
    // Revealed by giving up. Deliberately colourless next to the green: the
    // board should read at a glance as what you got and what you didn't, and
    // a second bright colour would make a missed answer look like a prize.
    static let missed = (
        top: Color(red: 0.282, green: 0.333, blue: 0.408),     // slate-600
        bottom: Color(red: 0.200, green: 0.255, blue: 0.333)   // slate-700
    )

    /// The app's base. Never #000000 — a true black makes every edge in a
    /// dark UI read as a cut rather than a surface.
    static let background = Color(red: 0.039, green: 0.047, blue: 0.063)

    /// 56% at rank 1, widening by 4.9 points a row — the web game's formula.
    static func widthFraction(rank: Int) -> CGFloat {
        min(1.0, (56 + CGFloat(rank - 1) * 4.9) / 100)
    }
}

struct BoardView: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Which row's clue is on screen. A clue is now a sheet rather than text
    /// crammed into a capsule, so it can be read, dismissed, and opened again
    /// later — the inline version was gone the moment the row was reused, and
    /// unreadable before that.
    @State private var showingClue: ClueSelection?

    var body: some View {
        if let round = store.round {
            pyramid(round)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .sheet(item: $showingClue) { selection in
                    ClueSheet(
                        rank: selection.id,
                        hint: round.board.hints.first { $0.rank == selection.id },
                        impliedClues: round.board.impliedClues
                    )
                    .presentationDetents([.height(300)])
                    .presentationDragIndicator(.visible)
                }
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

    // Each row gets an EXPLICIT height worked out from the space available,
    // rather than an equal share of it.
    //
    // A share is what it used to take, and a share has a floor: the capsule's
    // text will not render below its own intrinsic height, so once the board
    // was squeezed under roughly 245pt the rows stopped shrinking and started
    // overlapping instead — ranks 2 to 9 bunched into a band with 10 stranded
    // below it, which is exactly what the keyboard animation did on its way
    // past.
    private func pyramid(_ round: RoomRound) -> some View {
        GeometryReader { geo in
            let rows = max(round.board.target, 1)
            let spacing: CGFloat = 5
            let rowHeight = max(8, (geo.size.height - spacing * CGFloat(rows - 1)) / CGFloat(rows))
            VStack(spacing: spacing) {
                ForEach(1...rows, id: \.self) { rank in
                    row(rank: rank, round: round, width: geo.size.width, height: rowHeight)
                }
            }
            .frame(height: geo.size.height, alignment: .top)
        }
    }

    private func row(rank: Int, round: RoomRound, width: CGFloat, height: CGFloat) -> some View {
        PyramidRow(
            rank: rank,
            answer: round.board.revealed.first { $0.rank == rank },
            hasClue: round.board.hints.contains { $0.rank == rank },
            canHint: store.isHost && round.isLive,
            onLongPress: { longPress(rank: rank, round: round) }
        )
        .frame(width: width * BoardStyle.widthFraction(rank: rank), height: height)
        .frame(maxWidth: .infinity)
        // A row changing colour is the single most important event on this
        // screen, so it is a spring rather than a cut. Critically damped:
        // nothing was thrown, so nothing should bounce.
        .animation(
            reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.38, dampingFraction: 1.0),
            value: round.board.revealed.count
        )
    }

    /// Taking a clue is the host's, while the round is live. READING one that
    /// has already been taken is everybody's, and stays available after the
    /// round ends — it is in the event log either way.
    private func longPress(rank: Int, round: RoomRound) {
        let existing = round.board.hints.contains { $0.rank == rank }
        let taken = round.board.revealed.contains { $0.rank == rank }
        if existing {
            showingClue = ClueSelection(id: rank)
        } else if store.isHost, round.isLive, !taken {
            Task {
                await store.takeHint(rank: rank)
                showingClue = ClueSelection(id: rank)
            }
        }
    }
}

private struct ClueSelection: Identifiable { let id: Int }

// A clue, laid out as the few facts it actually is. The capsule version ran
// them together on one line inside a shape that had no room for them, at a
// size that shrank with the board.
private struct ClueSheet: View {
    let rank: Int
    let hint: TakenHint?
    let impliedClues: [String]

    @Environment(\.dismiss) private var dismiss

    private static let fields: [(String, String)] = [
        ("nationality", "Nationality"), ("position", "Position"), ("years", "Years"),
        ("club", "Club"), ("squadNumber", "Shirt"), ("born", "Born"),
    ]

    private var rows: [(String, String)] {
        Self.fields.compactMap { key, label in
            // A clue that restates the question is not a clue: if the round is
            // "Italian forwards", nationality and position are already known.
            guard !impliedClues.contains(key), let value = hint?.clue?[key]?.display else { return nil }
            return (label, value)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if rows.isEmpty {
                    VStack(spacing: 8) {
                        Text("Nothing to give away")
                            .font(.body(16, weight: .semibold))
                        Text("Everything known about this one is already in the question.")
                            .font(.body(12))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(rows, id: \.0) { label, value in
                        HStack {
                            Text(label).foregroundStyle(.secondary)
                            Spacer()
                            Text(value).font(.body(15, weight: .semibold))
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Clue for \(rank)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct PyramidRow: View {
    let rank: Int
    let answer: RevealedAnswer?
    /// Whether a clue has been taken for this row. The clue itself lives in
    /// the sheet now; the row only has to say that there is one to open.
    let hasClue: Bool
    let canHint: Bool
    let onLongPress: () -> Void

    @State private var pressed = false

    private var colours: (top: Color, bottom: Color) {
        guard let answer else { return BoardStyle.violet }
        return answer.wasMissed ? BoardStyle.missed : BoardStyle.green
    }

    var body: some View {
        ZStack {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [colours.top, colours.bottom],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                // The web row carries a green glow when it lands; without it a
                // find reads as a colour swap rather than an event. A missed
                // answer gets none — it was not an achievement.
                .shadow(
                    color: answer?.wasMissed == false ? BoardStyle.green.top.opacity(0.55) : .clear,
                    radius: 9, y: 2
                )

            if let answer {
                HStack(spacing: 7) {
                    Text(answer.name.uppercased())
                        .font(.display(14))
                        .foregroundStyle(answer.wasMissed ? .white.opacity(0.75) : .white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    Text(valueText(answer))
                        .font(.display(11))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .frame(minWidth: 24, minHeight: 22)
                        .background(Capsule().fill(.black.opacity(0.35)))
                }
                .padding(.horizontal, 12)
            } else {
                // Just the rank, clue or no clue, so the pyramid reads as the
                // board and nothing else. Press and hold reopens a clue that
                // has already been taken.
                Text("\(rank)")
                    .font(.display(17))
                    .foregroundStyle(.white.opacity(0.95))
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
            }
        }
        .contentShape(Capsule())
        // Feedback on press-down, not on release: a row you are holding for a
        // clue has to acknowledge the hold while it is happening, or the
        // second before the clue appears feels like nothing is working.
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 1.0), value: pressed)
        // Press and hold a blank slot for a clue, exactly as on the web.
        .onLongPressGesture(minimumDuration: 0.5) {
            guard answer == nil, canHint || hasClue else { return }
            // A clue arriving is a commit, so it earns a haptic — fired on the
            // same event that opens it, not before or after.
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onLongPress()
        } onPressingChanged: { holding in
            pressed = holding && answer == nil && (canHint || hasClue)
        }
    }

    private func valueText(_ answer: RevealedAnswer) -> String {
        let number = String(Int(answer.value))
        guard let unit = answer.unit, !unit.isEmpty else { return number }
        return "\(number) \(unit)"
    }

}
