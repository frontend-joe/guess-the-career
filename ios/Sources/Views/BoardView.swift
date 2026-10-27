import SwiftUI

struct BoardView: View {
    @Environment(RoomStore.self) private var store

    var body: some View {
        if let round = store.round {
            VStack(alignment: .leading, spacing: 6) {
                Text(round.board.title)
                    .font(.headline)
                    .padding(.horizontal)

                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(1...max(round.board.target, 1), id: \.self) { rank in
                            row(rank: rank, round: round)
                        }
                    }
                    .padding(.horizontal)
                }
            }
        } else {
            VStack(spacing: 6) {
                Text("No round yet")
                    .foregroundStyle(.secondary)
                if store.isHost {
                    Text("Choose a round, then Start.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func row(rank: Int, round: RoomRound) -> some View {
        let found = round.board.revealed.first { $0.rank == rank }
        let hint = round.board.hints.first { $0.rank == rank }

        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("\(rank)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 20, alignment: .trailing)
                Text(found?.name ?? "— — —")
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let found {
                    Text(valueText(found))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                // A clue is a server action, not a local reveal: the room never
                // sends unfound answers to anyone, and the hint has to land in
                // the event log so the recording shows it being taken.
                if store.isHost, found == nil, hint == nil, round.isLive {
                    Button {
                        Task { await store.takeHint(rank: rank) }
                    } label: {
                        Image(systemName: "eye").font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
            }

            if let hint {
                Text(clueText(hint, implied: round.board.impliedClues))
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .padding(.leading, 28)
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(found == nil ? Color.white.opacity(0.05) : Color.green.opacity(0.22))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func valueText(_ answer: RevealedAnswer) -> String {
        let number = String(Int(answer.value))
        guard let unit = answer.unit, !unit.isEmpty else { return number }
        return "\(number) \(unit)"
    }

    // Minus whatever the question already gave away — being told the club on
    // "Birmingham City's overseas players" is not a hint.
    private func clueText(_ hint: TakenHint, implied: [String]) -> String {
        let fields: [(String, String)] = [
            ("nationality", "Nationality"), ("position", "Position"), ("years", "Years"),
            ("club", "Club"), ("squadNumber", "Shirt"), ("born", "Born"),
        ]
        let parts = fields.compactMap { key, label -> String? in
            guard !implied.contains(key), let value = hint.clue?[key]?.display else { return nil }
            return "\(label): \(value)"
        }
        return parts.isEmpty ? "Nothing to give away on this one" : parts.joined(separator: " · ")
    }
}
