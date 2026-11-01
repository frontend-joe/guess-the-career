import SwiftUI

// A couple of thousand football rounds, so this is a search box with a list
// under it rather than a picker — plus a category to search within, because
// Tenable is more than one game now and the geography rounds are not findable
// by typing a club name.
struct RoundPickerView: View {
    @Environment(RoomStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var categories: [TenableCategory] = []
    @State private var category = "football"
    @State private var rounds: [PoolRound] = []
    @State private var query = ""
    @State private var loading = true

    private var matches: [PoolRound] {
        let q = query.trimmed.lowercased()
        guard !q.isEmpty else { return Array(rounds.prefix(200)) }
        return rounds.filter { "\($0.date ?? "") \($0.title)".lowercased().contains(q) }.prefix(200).map { $0 }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Only worth drawing once there is a choice to make.
                if categories.count > 1 {
                    Picker("Category", selection: $category) {
                        ForEach(categories) { Text($0.label).tag($0.slug) }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.bottom, 8)
                }

                Group {
                    if loading {
                        ProgressView().frame(maxHeight: .infinity)
                    } else if matches.isEmpty {
                        Text(query.trimmed.isEmpty
                             ? "No rounds in this category yet."
                             : "Nothing matches \u{201C}\(query.trimmed)\u{201D}.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .frame(maxHeight: .infinity)
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
                                        // Dimmed rather than hidden or
                                        // disabled: a round you have played
                                        // is still a round you might want
                                        // again, with different people or on
                                        // a night the first one went badly.
                                        .foregroundStyle(round.played ? .secondary : .primary)
                                    // Only Football's rounds have a date, and
                                    // only because they came off its calendar.
                                    if let date = round.date {
                                        Text(date).font(.caption).foregroundStyle(.secondary)
                                    }
                                    if round.played {
                                        Label(playedLabel(round), systemImage: "checkmark.circle.fill")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                // Searchable lives out here, not on the List: the List is gone
                // whenever nothing matches, and a search field that leaves the
                // view tree takes the keyboard — and your half-typed word —
                // with it.
                .searchable(text: $query, prompt: "Filter rounds")
            }
            .navigationTitle("Choose a round")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                categories = (try? await API.tenableCategories()) ?? []
                await load()
            }
            .onChange(of: category) { _, _ in
                query = ""
                Task { await load() }
            }
        }
    }

    /// "Played 1 Nov", or how many times if it has come round more than once.
    ///
    /// Reads as a sentence rather than a count on its own, because the host is
    /// scanning a list of a couple of thousand rounds and a bare "3" next to a
    /// title could mean anything.
    private func playedLabel(_ round: PoolRound) -> String {
        let count = round.playedCount ?? 0
        let when = round.lastPlayedAt.flatMap(Self.day.date(from:)).map(Self.short.string(from:))
        let times = count > 1 ? "Played \(count) times" : "Played"
        guard let when else { return times }
        return count > 1 ? "\(times), last \(when)" : "Played \(when)"
    }

    // SQLite hands back UTC with a space in the middle, which no built-in
    // SwiftUI formatter reads.
    private static let day: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    private static let short: DateFormatter = {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("d MMM")
        return f
    }()

    private func load() async {
        loading = true
        rounds = (try? await API.roundPool(category: category)) ?? []
        loading = false
    }
}
