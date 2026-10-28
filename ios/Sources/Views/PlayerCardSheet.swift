import SwiftUI

// The player card, opened by tapping a row you have already found.
//
// A port of client/src/components/PlayerInfoModal.tsx, with one deliberate
// omission: the web modal draws a club crest beside every stint, resolved by
// a Wikipedia lookup per club from the browser. That is a round trip a row
// and a second image pipeline, for a 16pt badge, on a screen that is already
// carrying four video tracks. The names and the numbers are the content.
//
// Light, not dark, exactly as on the web. The card is a reference sheet lifted
// over the game, and a dark one would read as another part of the board.
struct PlayerCardSheet: View {
    let footballerId: Int
    /// Shown while the card loads, so the sheet opens with the name already
    /// on it rather than a title that arrives half a second later.
    let name: String

    @Environment(\.dismiss) private var dismiss
    @State private var card: FootballerCard?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    if let card {
                        bio(card)
                        career("Senior career", card.senior)
                        career("International career", card.international, international: true)
                    } else if failed {
                        message("Couldn't load this player.")
                    } else {
                        ProgressView().padding(.vertical, 60)
                    }
                }
            }
            .background(Color.white)
            .navigationTitle(card?.name ?? name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(Color.white, for: .navigationBar)
        }
        // The whole sheet is light, so its text must be too — the room runs
        // in dark mode and would otherwise draw white on white.
        .environment(\.colorScheme, .light)
        .task {
            do { card = try await API.footballerCard(id: footballerId) }
            catch { failed = true }
        }
    }

    // MARK: - Pieces

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.body(13))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 60)
    }

    @ViewBuilder
    private func bio(_ card: FootballerCard) -> some View {
        VStack(spacing: 0) {
            bioRow("Full name", card.fullName)
            bioRow("Date of birth", card.bornLong)
            bioRow("Birth place", card.birthplace)
            bioRow("Nationality", card.nationality)
            bioRow("Position", card.position)
            bioRow("Height", heightText(card.heightCm))
        }
    }

    @ViewBuilder
    private func bioRow(_ label: String, _ value: String?) -> some View {
        if let value, !value.isEmpty {
            HStack(alignment: .top, spacing: 12) {
                Text(label)
                    .font(.body(13, weight: .semibold))
                    .foregroundStyle(Color(white: 0.45))
                    .frame(width: 104, alignment: .leading)
                Text(value)
                    .font(.body(13))
                    .foregroundStyle(Color(white: 0.15))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            Divider().overlay(Color(white: 0.92))
        }
    }

    @ViewBuilder
    private func career(_ title: String, _ stints: [CardStint], international: Bool = false) -> some View {
        if !stints.isEmpty {
            HStack {
                Text(title).font(.display(13))
                Spacer()
            }
            .foregroundStyle(Color(white: 0.3))
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(Color(white: 0.95))
            .overlay(alignment: .bottom) { Divider().overlay(Color(white: 0.88)) }
            .overlay(alignment: .top) { Divider().overlay(Color(white: 0.88)) }

            HStack(spacing: 8) {
                Text("Years").frame(width: 72, alignment: .leading)
                Text("Team").frame(maxWidth: .infinity, alignment: .leading)
                Text(international ? "Caps (Gls)" : "Apps (Gls)").frame(width: 74, alignment: .trailing)
            }
            .font(.body(11, weight: .medium))
            .foregroundStyle(Color(white: 0.62))
            .padding(.horizontal, 14)
            .padding(.vertical, 5)

            // Nothing in the payload identifies a stint — a player can have
            // two spells at one club across the same years — so the row's
            // place in the list is the only honest identity it has.
            ForEach(Array(stints.enumerated()), id: \.offset) { _, stint in
                stintRow(stint)
            }
        }
    }

    private func stintRow(_ stint: CardStint) -> some View {
        let parts = stint.parts
        return VStack(spacing: 0) {
            Divider().overlay(Color(white: 0.94))
            HStack(alignment: .top, spacing: 8) {
                Text(stint.years)
                    .font(.body(12))
                    .monospacedDigit()
                    .foregroundStyle(Color(white: 0.45))
                    .frame(width: 72, alignment: .leading)
                HStack(spacing: 5) {
                    // The arrow is how Wikipedia says "out on loan", and it
                    // is worth keeping: a row of 6 appearances reads very
                    // differently once you can see it was a loan spell.
                    if parts.tag == "loan" {
                        Text("→").font(.body(12)).foregroundStyle(Color(white: 0.5))
                    }
                    Text(parts.tag == nil ? parts.name : "\(parts.name) (\(parts.tag!))")
                        .font(.body(12))
                        .foregroundStyle(Color(white: 0.2))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(stint.appsGoals)
                    .font(.body(12))
                    .monospacedDigit()
                    .foregroundStyle(Color(white: 0.35))
                    .frame(width: 74, alignment: .trailing)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
        }
    }

    /// "1.78 m (5 ft 10 in)", as the web modal writes it.
    private func heightText(_ cm: Int?) -> String? {
        guard let cm, cm > 0 else { return nil }
        let inches = Int((Double(cm) / 2.54).rounded())
        return String(format: "%.2f m (%d ft %d in)", Double(cm) / 100, inches / 12, inches % 12)
    }
}
