import SwiftUI

// A couple of thousand scheduled rounds, so this is a search box with a list
// under it rather than a picker.
struct RoundPickerView: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var rounds: [ScheduledRound] = []
    @State private var query = ""
    @State private var loading = true

    private var matches: [ScheduledRound] {
        let q = query.trimmed.lowercased()
        guard !q.isEmpty else { return Array(rounds.prefix(200)) }
        return rounds.filter { "\($0.date) \($0.title)".lowercased().contains(q) }.prefix(200).map { $0 }
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading {
                    ProgressView()
                } else {
                    List(matches) { round in
                        Button {
                            Task {
                                await store.freezeRound(roundId: round.roundId)
                                dismiss()
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(round.title)
                                Text(round.date).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .searchable(text: $query, prompt: "Filter rounds")
                }
            }
            .navigationTitle("Choose a round")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                rounds = (try? await API.scheduledRounds()) ?? []
                loading = false
            }
        }
    }
}
