import SwiftUI

// The player card, opened by tapping a row you have already found.
//
// A port of client/src/components/PlayerInfoModal.tsx, with one deliberate
// omission: the web modal draws a club crest beside every stint, resolved by
// a Wikipedia lookup per club from the browser. That is a round trip a row
// and a second image pipeline, for a 16pt badge, on a screen that is already
// carrying four video tracks. The names and the numbers are the content.
//
// Dark, like the clue sheet and the rest of the room. The web modal is light
// because the web game is, and carrying that over made the one light surface
// in a dark app — a flashbang mid-round. Every colour here is semantic, so the
// card inherits the app's scheme instead of pinning its own.
struct PlayerCardSheet: View {
    /// Null when the board has a name but no footballer behind it. The sheet
    /// still opens and says so, rather than the row ignoring the tap.
    let footballerId: Int?
    /// Shown while the card loads, so the sheet opens with the name already
    /// on it rather than a title that arrives half a second later.
    let name: String

    @Environment(\.dismiss) private var dismiss
    @State private var card: FootballerCard?
    @State private var failed = false

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(spacing: 0) {
                    if let card {
                        bio(card)
                        career("Senior career", card.senior)
                        career("International career", card.international, international: true)
                    } else if footballerId == nil {
                        // Either this answer has no footballer record at all,
                        // or the round was played before the board started
                        // logging who its rows are. Nothing to fetch.
                        message("No career on file for this one.")
                    } else if failed {
                        message("Couldn't load this player.")
                    } else {
                        ProgressView().padding(.vertical, 60)
                    }
                }
            }
        }
        // Half height, not full. The card is a dozen rows of career; opening
        // it at full height left most of the sheet empty, and the navigation
        // bar it used to carry spent the presentation settling — which is what
        // the jiggle on open was. A plain header does not animate, and a player
        // with a long career can still be dragged up.
        .presentationDetents([.medium, .large])
        .task {
            guard let footballerId else { return }
            do { card = try await API.footballerCard(id: footballerId) }
            catch { failed = true }
        }
    }

    // MARK: - Pieces

    /// The name and a way out, as plain views. Deliberately not a navigation
    /// bar: there is nothing to navigate, and the bar was the thing moving.
    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(card?.name ?? name)
                .font(.display(19))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            Spacer(minLength: 12)
            Button("Done") { dismiss() }
                .font(.body(15, weight: .semibold))
        }
        .padding(.horizontal, 14)
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

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
                    .foregroundStyle(.secondary)
                    .frame(width: 104, alignment: .leading)
                Text(value)
                    .font(.body(13))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            Divider()
        }
    }

    @ViewBuilder
    private func career(_ title: String, _ stints: [CardStint], international: Bool = false) -> some View {
        if !stints.isEmpty {
            HStack {
                Text(title).font(.display(13))
                Spacer()
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            // A band that lifts off the sheet rather than one of a fixed
            // grey, so it reads as a section header in either scheme.
            .background(.fill.tertiary)
            .overlay(alignment: .bottom) { Divider() }
            .overlay(alignment: .top) { Divider() }

            HStack(spacing: 8) {
                Text("Years").frame(width: 72, alignment: .leading)
                Text("Team").frame(maxWidth: .infinity, alignment: .leading)
                Text(international ? "Caps (Gls)" : "Apps (Gls)").frame(width: 74, alignment: .trailing)
            }
            .font(.body(11, weight: .medium))
            .foregroundStyle(.tertiary)
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
            Divider()
            HStack(alignment: .top, spacing: 8) {
                Text(stint.years)
                    .font(.body(12))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(width: 72, alignment: .leading)
                HStack(spacing: 5) {
                    // The arrow is how Wikipedia says "out on loan", and it
                    // is worth keeping: a row of 6 appearances reads very
                    // differently once you can see it was a loan spell.
                    if parts.tag == "loan" {
                        Text("→").font(.body(12)).foregroundStyle(.tertiary)
                    }
                    Text(parts.tag == nil ? parts.name : "\(parts.name) (\(parts.tag!))")
                        .font(.body(12))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(stint.appsGoals)
                    .font(.body(12))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
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
