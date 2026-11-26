import SwiftUI

// What happened in this game, after it happened.
//
// A Tenable round is over in ninety seconds and the interesting part is the
// three you did not get. Live, there is no room for that — the board is the
// board and the next round is already being picked. So the review lives here,
// off to one side, and keeps every round the room has played.
//
// Fetched when the sheet opens rather than carried in the room state: it is a
// few kilobytes of answers that nobody needs on a ten-second poll, and the
// state snapshot is on the critical path of every single game action.
struct HistorySheet: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var rounds: [HistoryRound] = []
    @State private var loading = true
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let failure {
                    message(failure)
                } else if rounds.isEmpty {
                    // Before the first round ends there is genuinely nothing
                    // here, and saying so is better than an empty list that
                    // looks like a failed request.
                    message("Nothing to review yet. Finished rounds show up here with their answers.")
                } else {
                    List(rounds) { round in
                        NavigationLink {
                            HistoryRoundView(round: round)
                        } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(round.title)
                                        .font(.body(15, weight: .semibold))
                                    Text(round.score)
                                        .font(.body(12))
                                        .foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 8)
                                // The score as a shape, not just a number: a
                                // round you cleaned up and one you were
                                // battered on should be told apart from
                                // across the room.
                                Text("\(round.found)")
                                    .font(.display(17))
                                    .foregroundStyle(round.found == round.target ? BoardStyle.green.top : .secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.body(14))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func load() async {
        guard let seat = store.seat else {
            loading = false
            return
        }
        do {
            // Newest first. You are nearly always here to look at the round
            // that just finished, and scrolling to the bottom to find it is
            // the wrong default for every game longer than three rounds.
            rounds = try await API.history(seat: seat).reversed()
        } catch {
            failure = error.localizedDescription
        }
        loading = false
    }
}

// One round's answers: the ten, who got each one, and — the whole point of
// the screen — which ones nobody did.
private struct HistoryRoundView: View {
    let round: HistoryRound

    /// The answer whose card is open. Any row opens, found or not: "who on
    /// earth is Ryan Donk" is exactly the question this screen exists to
    /// answer, and refusing the tap on a missed name answers it for nobody.
    @State private var showing: HistoryAnswer?

    /// The ten the board was asking for.
    private var board: [HistoryAnswer] { round.answers.filter(\.onBoard) }

    /// Everything the round froze below them, on a ranked board. Empty on an
    /// unordered one, where every frozen name was on the board.
    private var tail: [HistoryAnswer] { round.answers.filter { !$0.onBoard } }

    var body: some View {
        List {
            Section {
                ForEach(board) { answer in
                    Button { showing = answer } label: { row(answer) }
                        .buttonStyle(.plain)
                }
            } header: {
                // The question, in full and in as many lines as it takes.
                //
                // It lived in the navigation bar, which gives a title one
                // line and an ellipsis, and the part it cut was the part that
                // mattered: "Barcelona and Inter Milan players…" does not say
                // whether the board was ranked by appearances or by goals,
                // which is the whole question. A bar is the wrong place for a
                // sentence. The bar keeps the back button and nothing else.
                VStack(alignment: .leading, spacing: 6) {
                    Text(round.title)
                        .font(.display(16))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(round.score)
                        .font(.body(12))
                        .foregroundStyle(.secondary)
                }
                // Headers are small caps by default, which is right for "10
                // OF 10" and wrong for a sentence.
                .textCase(nil)
                .padding(.bottom, 4)
            } footer: {
                // An unordered round froze its whole pool, which on a
                // nationality board is two hundred names. Saying how many are
                // not listed is more honest than a list that simply stops.
                if round.more > 0 {
                    Text("\(round.more) more would also have counted.")
                }
            }

            // The rest of the frozen list, on a ranked round.
            //
            // Its own section rather than more rows, because these names are
            // a different kind of thing: they are not answers that were
            // missed, they are answers that were never on offer. Running them
            // on from the tenth would tell a room that lost 7 of 10 that they
            // had in fact lost 47 of 50.
            if !tail.isEmpty {
                Section {
                    ForEach(tail) { answer in
                        Button { showing = answer } label: { row(answer) }
                            .buttonStyle(.plain)
                    }
                } header: {
                    Text("Near Misses")
                        .textCase(nil)
                } footer: {
                    Text("Ranked below the board when the round was frozen. Saying one of these counted as a near miss, not an answer.")
                }
            }
        }
        // Deliberately empty. The title is the first thing in the list now,
        // and printing it twice — once truncated above a full copy of itself
        // — is worse than either.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $showing) { answer in
            PlayerCardSheet(footballerId: answer.footballerId, name: answer.name)
                .presentationDragIndicator(.visible)
        }
    }

    private func row(_ answer: HistoryAnswer) -> some View {
        HStack(spacing: 10) {
            // Only where a rank is a real thing. On an unordered round it is
            // the order the pool happened to be frozen in and means nothing
            // — printing it would invent a ranking the game never had.
            if round.ordered {
                Text("\(answer.rank)")
                    .font(.body(12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 20, alignment: .trailing)
            }
            Text(answer.name)
                .font(.body(15, weight: answer.found ? .semibold : .regular))
                // Dimmed rather than coloured. A missed answer is not an
                // error and should not read as one; it is simply a name
                // that did not get said.
                .foregroundStyle(answer.found ? .primary : .secondary)
            Spacer(minLength: 8)
            // The stat and whoever said it, stacked on the trailing edge.
            //
            // The number used to sit under the name as a subtitle and did
            // not appear at all — see BoardStyle.badgeText. On the right it
            // is where the eye already goes for it, and on a near miss it is
            // the whole reason the row is listed: 46 appearances against the
            // 47 that made the board is the argument the room is having.
            VStack(alignment: .trailing, spacing: 2) {
                if let badge = BoardStyle.badgeText(
                    value: answer.value, unit: answer.unit, display: answer.display,
                ) {
                    Text(badge)
                        .font(.body(13, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                if let who = answer.foundBy {
                    Text(who)
                        .font(.body(12))
                        .foregroundStyle(BoardStyle.green.top)
                        .lineLimit(1)
                } else if answer.onBoard {
                    Text("Missed")
                        .font(.body(12))
                        .foregroundStyle(.tertiary)
                }
                // And no third line on a tail row. "Missed" would be an
                // accusation about a name the board never had a slot for.
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}
