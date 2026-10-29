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
                        Text("No rounds in this category yet.")
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
                                    // Only Football's rounds have a date, and
                                    // only because they came off its calendar.
                                    if let date = round.date {
                                        Text(date).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                        .searchable(text: $query, prompt: "Filter rounds")
                    }
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
                categories = (try? await API.tenableCategories()) ?? []
                await load()
            }
            .onChange(of: category) { _, _ in
                query = ""
                Task { await load() }
            }
        }
    }

    private func load() async {
        loading = true
        rounds = (try? await API.roundPool(category: category)) ?? []
        loading = false
    }
}
