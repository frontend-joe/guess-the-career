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

    /// The band the question sits in: one step up from the base, which is
    /// enough to separate it without becoming a third colour in the room.
    static let titleBand = Color(red: 0.098, green: 0.110, blue: 0.137)

    /// A fee as people say it: 37.5m, 25m, 900k. No currency symbol, because
    /// the board only carries the amount — the written fee, with its symbol,
    /// is in the clue.
    static func money(_ value: Double) -> String {
        if value >= 1_000_000 {
            let m = value / 1_000_000
            return m == m.rounded() ? "\(safeInt(m))m" : String(format: "%.1fm", m)
        }
        if value >= 1_000 {
            let k = value / 1_000
            return k == k.rounded() ? "\(safeInt(k))k" : String(format: "%.1fk", k)
        }
        return String(safeInt(value))
    }

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
    /// There is ONE sheet here, carrying whichever of the two things a row
    /// can open. Two `.sheet` modifiers on one view is how the share invite
    /// broke: a view can only be presenting one thing, and the second
    /// modifier wedges the first.
    @State private var showingClue: BoardSheet?
    /// Drives the wave. Counts up forever; each row works out its own moment
    /// from it, so there is one timer for the board rather than ten.
    @State private var wave: Int = 0
    /// Clue ranks this screen has already opened by itself. A clue taken
    /// anywhere in the room opens here too, but only once, and never for the
    /// ones that were already on the board when this screen appeared —
    /// joining a round mid-way should not fire four sheets at you.
    @State private var announced: Set<Int> = []

    var body: some View {
        if let round = store.round {
            pyramid(round)
                // 32, not 10: the pyramid is 44pt narrower than the screen it
                // sits on. Every row is a fraction of what is left, so the
                // widest loses the full 44 and the narrowest about 25, which
                // keeps the shape of the pyramid while giving the board an
                // edge to sit inside rather than running to the bezel.
                .padding(.horizontal, 32)
                .padding(.vertical, 6)
                // One timer, not ten. Off entirely under reduced motion: a
                // repeating sweep across the whole screen is exactly the kind
                // of ambient movement that setting exists to stop.
                .task(id: reduceMotion) {
                    guard !reduceMotion else { return }
                    while !Task.isCancelled {
                        try? await Task.sleep(for: .seconds(10))
                        guard !Task.isCancelled else { return }
                        wave += 1
                    }
                }
                // The host spends the clue; everyone reads it. It arrives
                // through /state like everything else, so there is no separate
                // message to miss and a client that resyncs still gets it.
                .onAppear { announced = Set(round.board.hints.map(\.rank)) }
                .onChange(of: round.board.hints.map(\.rank)) { _, ranks in
                    let fresh = ranks.filter { !announced.contains($0) }
                    announced.formUnion(ranks)
                    if let newest = fresh.max() { showingClue = .clue(rank: newest) }
                }
                .sheet(item: $showingClue) { sheet in
                    switch sheet {
                    case .clue(let rank):
                        ClueSheet(
                            rank: rank,
                            hint: round.board.hints.first { $0.rank == rank },
                            impliedClues: round.board.impliedClues,
                            canReveal: store.isHost && round.isLive
                        )
                        .presentationDetents([.height(340)])
                        .presentationDragIndicator(.visible)
                    case .player(let id, let name):
                        PlayerCardSheet(footballerId: id, name: name)
                            .presentationDragIndicator(.visible)
                    }
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

    /// What sits in a given SLOT, which is not the same as a given rank.
    ///
    /// An ordered board is a ranking: rank 3 belongs in slot 3 and nowhere
    /// else. An unordered one — "name any ten of this squad" — has no
    /// ranking at all, so the names fill from the top as they are found, and
    /// the slots are just rows.
    ///
    /// The server hands them over already in that order, which is the only
    /// place it can be decided: sorting by rank here made a later answer
    /// appear ABOVE an earlier one, because an unordered round's ranks are
    /// positions in a pool longer than the board.
    private func answer(slot: Int, round: RoomRound) -> RevealedAnswer? {
        if round.board.ordered {
            return round.board.revealed.first { $0.rank == slot }
        }
        let inOrder = round.board.revealed
        return slot <= inOrder.count ? inOrder[slot - 1] : nil
    }

    private func row(rank: Int, round: RoomRound, width: CGFloat, height: CGFloat) -> some View {
        PyramidRow(
            rank: rank,
            // A number on an unordered board claims a ranking that is not
            // there, and this one was asking people to name the squad in
            // order of shirt number.
            showsRank: round.board.ordered,
            answer: answer(slot: rank, round: round),
            hasClue: round.board.hints.contains { $0.rank == rank },
            // Only football rounds have anything behind a blank slot. An
            // authored round's answers are a list somebody typed, with no
            // career to hint at, so offering a clue there opens an empty card.
            canHint: store.isHost && round.isLive && round.board.isFootball,
            // Bottom to top: rank 10 goes first, rank 1 last. The board reads
            // downwards, so a wave running the other way is movement rather
            // than a second way of reading it.
            waveTick: wave,
            waveDelay: Double(max(round.board.target, 1) - rank) * 0.11,
            onClue: { clue(rank: rank, round: round) },
            onTap: { tap(slot: rank, round: round) }
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

    /// Tapping a row that has a name on it opens that player's career.
    /// Anyone can, at any time, including after the round has ended and
    /// including on an answer that was revealed by giving up — the point of
    /// the card is to settle the "who even is that" the board starts.
    /// Opens for ANY row with a name on it, including one the board cannot
    /// identify. A row that looks tappable and does nothing is indisputably
    /// worse than one that opens and says it knows nothing — and silence is
    /// also undebuggable, because a missing id and a dead gesture look exactly
    /// alike from the far side of the screen.
    private func tap(slot: Int, round: RoomRound) {
        guard let answer = answer(slot: slot, round: round) else { return }
        showingClue = .player(id: answer.footballerId, name: answer.name)
    }

    /// The host takes a clue; everyone's screen then opens it. Anyone may
    /// reopen one already taken, after the round has ended too — it is in the
    /// event log either way.
    private func clue(rank: Int, round: RoomRound) {
        let existing = round.board.hints.contains { $0.rank == rank }
        // Whether this ROW is occupied, asked the same way the row was
        // filled. An unordered board fills positionally — the Nth name found
        // goes in slot N — while a revealed answer's `rank` is its place in
        // the frozen pool and has nothing to do with the slot it landed in.
        // Matching on rank therefore read a blank slot as taken whenever some
        // player already up there happened to carry that number, and the
        // long press did nothing. It still buzzed, because the haptic had
        // fired before this was consulted, so it looked like a dead button
        // rather than a refusal.
        let taken = answer(slot: rank, round: round) != nil
        if existing {
            // Reopening one already taken — nobody else needs to see that.
            showingClue = .clue(rank: rank)
        } else if store.isHost, round.isLive, !taken {
            // A clue arriving is a commit, so it earns a heavier haptic —
            // fired here, on the one path that actually takes one.
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            // Not opened here. The clue lands in the event log, comes back in
            // the next state, and opens on every screen including this one —
            // one path, so the host sees exactly what the room sees.
            Task { await store.takeHint(rank: rank) }
        }
    }
}

/// What the board's one sheet is currently showing. A rank identifies a clue
/// and a footballer id identifies a card, and the two id spaces overlap, so
/// the case name is part of the identity — otherwise clue 7 and footballer 7
/// would be the same sheet.
private enum BoardSheet: Identifiable {
    case clue(rank: Int)
    /// The id is optional: a row can carry a name the board cannot put a
    /// footballer to. The name is the identity here, because that is the only
    /// thing such a row has.
    case player(id: Int?, name: String)

    var id: String {
        switch self {
        case .clue(let rank): "clue-\(rank)"
        case .player(_, let name): "player-\(name)"
        }
    }
}

// A clue, laid out as the few facts it actually is. The capsule version ran
// them together on one line inside a shape that had no room for them, at a
// size that shrank with the board.
private struct ClueSheet: View {
    let rank: Int
    let hint: TakenHint?
    let impliedClues: [String]
    /// Whether the person reading this can spend the initials on it: the host,
    /// in a round that is still being played.
    let canReveal: Bool

    @Environment(RoomStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    // Transfer fields first: on a transfer round they are the answer's whole
    // context, and the career fields below are mostly absent.
    private static let fields: [(String, String)] = [
        ("fee", "Fee"), ("fromClub", "From"), ("toClub", "To"),
        ("nationality", "Nationality"), ("position", "Position"), ("years", "Years"),
        ("club", "Club"), ("squadNumber", "Shirt"), ("age", "Age"),
    ]

    private var rows: [(String, String)] {
        Self.fields.compactMap { key, label in
            // A clue that restates the question is not a clue: if the round is
            // "Italian forwards", nationality and position are already known.
            guard !impliedClues.contains(key), let value = hint?.clue?[key]?.display else { return nil }
            return (label, value)
        }
    }

    // The one clue the host decides on at the time. Everything above it was
    // settled when the round was frozen; this is spent, so it is a button
    // until somebody presses it and a fact afterwards.
    @ViewBuilder private var initialsRow: some View {
        HStack {
            Text("Initials").foregroundStyle(.secondary)
            Spacer()
            if let initials = hint?.initials {
                Text(initials)
                    .font(.body(15, weight: .semibold))
                    .monospaced()
            } else if canReveal {
                Button("Reveal") {
                    Task { await store.takeInitials(rank: rank) }
                }
                .font(.body(13, weight: .semibold))
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .controlSize(.small)
            } else {
                // Said rather than left out, so the room knows there is one
                // more thing to ask the host for.
                Text("Hidden").font(.body(15)).foregroundStyle(.tertiary)
            }
        }
    }

    var body: some View {
        NavigationStack {
            // One list rather than two branches, because the initials row
            // belongs on a clue with nothing else in it most of all: a round
            // that has already told you the nationality and the position has
            // nothing left to give except the name.
            List {
                ForEach(rows, id: \.0) { label, value in
                    HStack {
                        Text(label).foregroundStyle(.secondary)
                        Spacer()
                        Text(value).font(.body(15, weight: .semibold))
                    }
                }
                initialsRow
                if rows.isEmpty {
                    Text("Everything else known about this one is already in the question.")
                        .font(.body(12))
                        .foregroundStyle(.secondary)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Clue for \(rank)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    // An X, not "Done": there is nothing to be done here.
                    // The sheet shows a clue and the only thing you can do
                    // with it is close it, which is what an X means.
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .accessibilityLabel("Close")
                }
            }
        }
    }
}

private struct PyramidRow: View {
    let rank: Int
    let showsRank: Bool
    let answer: RevealedAnswer?
    /// Whether a clue has been taken for this row. The clue itself lives in
    /// the sheet now; the row only has to say that there is one to open.
    let hasClue: Bool
    let canHint: Bool
    /// Bumped once every ten seconds for the whole board.
    let waveTick: Int
    /// This row's place in the wave, in seconds behind the one below it.
    let waveDelay: Double
    /// Takes the clue, or reopens one already taken.
    let onClue: () -> Void
    /// Opens the player's career. Only ever called on a row with a name.
    let onTap: () -> Void

    /// 0 at rest, 1 at the top of this row's part of the wave.
    @State private var lift: CGFloat = 0
    /// Shrinks the pill while the host holds it, so the half-second before a
    /// clue appears is not spent wondering whether the hold registered.
    @State private var holdingClue = false

    /// Whether this row offers a clue at all.
    ///
    /// The host sees one on every blank slot, because spending it is theirs
    /// to decide. Everybody else sees one only where a clue has already been
    /// taken — a button they cannot press is not information, it is a tease,
    /// and the room finding out which rows the host CONSIDERED is not
    /// something the game should leak.
    private var showsClueButton: Bool { answer == nil && (canHint || hasClue) }

    private var colours: (top: Color, bottom: Color) {
        guard let answer else { return BoardStyle.violet }
        return answer.wasMissed ? BoardStyle.missed : BoardStyle.green
    }

    // A blank row carries a button; a found row is tapped. They are never
    // both live, and neither is a long press any more.
    //
    // The hold had two problems a button does not. It was invisible — the
    // only thing on screen saying a clue existed was the clue, after you had
    // already spent it — and it was a race: the tap was a
    // `.simultaneousGesture` over the long press, which SwiftUI resolves in
    // favour of the inner gesture, so for a while the row did nothing at all.
    var body: some View {
        if answer == nil {
            capsule
        } else {
            capsule
                // Tap a row you have found to read that player's career.
                //
                // The haptic fires HERE, in the gesture itself, before
                // anything downstream can fail. A plain tap gesture has no
                // pressing callback, so without it the row gives nothing back
                // until the sheet arrives — and if the sheet is what is
                // broken, "the tap did not fire" and "the tap fired and
                // nothing came up" are the same silence.
                .onTapGesture {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onTap()
                }
        }
    }

    /// Solid once the clue is up, faint while it is still the host's to spend
    /// — so a host glancing down the board can see what they have already
    /// given away without opening anything.
    ///
    /// Spending one is a hold; opening one already spent is a tap. The two
    /// are not the same act and must not cost the same: a clue is given to
    /// the whole room and cannot be taken back, and the host's thumb passes
    /// over ten of these looking for the row they want. Reopening is free, so
    /// it stays a tap.
    ///
    /// The word stays "Clue" either way. It names the thing, which does not
    /// change; the gesture is taught by the pill shrinking under the hold and
    /// by the voiceover label, not by relabelling the button mid-round.
    private var clueButton: some View {
        Text("Clue")
            .font(.display(11))
            .foregroundStyle(hasClue ? BoardStyle.violet.bottom : .white)
            .padding(.horizontal, 11)
            // Nearly the height of the row it sits in. A short pill on a
            // tall row reads as a label printed on the capsule rather
            // than something to press.
            .frame(height: 30)
            .background {
                Capsule()
                    .fill(hasClue ? AnyShapeStyle(.white.opacity(0.92)) : AnyShapeStyle(.black.opacity(0.28)))
            }
            .scaleEffect(holdingClue ? 0.94 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 1.0), value: holdingClue)
            .contentShape(Capsule())
            .onTapGesture {
                // Nothing to open yet. Said with a bump rather than silence,
                // because a button that ignores a tap and a button that is
                // broken look identical.
                guard hasClue else {
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                    return
                }
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onClue()
            }
            .onLongPressGesture(minimumDuration: 0.45) {
                guard !hasClue else { return }
                // No haptic here. A bump that fires before the decision is
                // made promises a clue the board may then decline to give,
                // and a button that buzzes and does nothing reads as broken.
                // The commit confirms itself, where it commits.
                onClue()
            } onPressingChanged: { holding in
                holdingClue = holding && !hasClue
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(hasClue ? "Open the clue for \(rank)" : "Hold to take a clue for \(rank)")
    }

    private var capsule: some View {
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
                    if let badge = valueText(answer) {
                        Text(badge)
                            .font(.display(11))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .frame(minWidth: 24, minHeight: 22)
                            .background(Capsule().fill(.black.opacity(0.35)))
                    }
                }
                .padding(.horizontal, 12)
            } else {
                // The rank stays centred on the row rather than being pushed
                // along by the button, so the column of numbers reads
                // straight down whether or not a row has a clue on it.
                if showsRank {
                    Text("\(rank)")
                        .font(.display(17))
                        .foregroundStyle(.white.opacity(0.95))
                        .lineLimit(1)
                        .minimumScaleFactor(0.4)
                }
                if showsClueButton {
                    HStack {
                        Spacer()
                        clueButton
                    }
                    .padding(.trailing, 8)
                }
            }
        }
        // The row stands up and sits back down, like someone in the wave:
        // a little bigger and a little brighter, then back. A band of light
        // sliding across was tried first and read as a sheen ON the row
        // rather than the row itself moving.
        .brightness(0.16 * lift)
        .contentShape(Capsule())
        .scaleEffect(1 + 0.055 * lift)
        .onChange(of: waveTick) { _, tick in
            guard tick > 0 else { return }
            Task {
                try? await Task.sleep(for: .seconds(waveDelay))
                // Up a little faster than it comes down, so it reads as a
                // rise and a settle rather than a pulse. Slower than the
                // first attempt, which crossed the board quickly enough that
                // you saw a flicker rather than something travelling.
                withAnimation(.easeOut(duration: 0.28)) { lift = 1 }
                try? await Task.sleep(for: .seconds(0.28))
                withAnimation(.easeIn(duration: 0.42)) { lift = 0 }
            }
        }
    }

    /// What goes in the badge, or nothing at all.
    private func valueText(_ answer: RevealedAnswer) -> String? {
        // A shirt number is not a score. On a squad round the board is not
        // ranked by it — it is not ranked by anything — so putting "8 shirt"
        // next to a name states a fact nobody asked for and makes the row
        // look like it placed eighth.
        if answer.unit == "shirt" { return nil }
        // A transfer fee is a price, not a count. "37500000 fee" is unreadable
        // at a glance and wraps the badge onto two lines; "37.5m" is the
        // number people actually say.
        if answer.unit == "fee" { return BoardStyle.money(answer.value) }
        // An authored round already knows how its number should read, and the
        // raw one would not fit the badge: 17098246 km² is not a thing anybody
        // can take in at a glance.
        if let display = answer.display, !display.isEmpty { return display }
        let number = String(safeInt(answer.value))
        guard let unit = answer.unit, !unit.isEmpty else {
            // No unit and no number is an unordered round — "name any ten of
            // these" is not ranked by anything, and a zero next to a correct
            // answer reads as having scored nothing.
            return answer.value == 0 ? nil : number
        }
        return "\(number) \(unit)"
    }

}
