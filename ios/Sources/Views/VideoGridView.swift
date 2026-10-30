import SwiftUI
import LiveKit

// The faces across the bottom third. Rooms have no seat limit, so the count is
// not known in advance and the grid wraps: at most four to a row, then as many
// rows as it takes, every tile the same size.
//
// Derived from the count rather than flowed by available width, because the
// compositor will lay the recording out from the same rule and the two must not
// be able to disagree. Up to four it is still a single row, so the games
// everybody has played so far look exactly as they did.
struct VideoGridView: View {
    let tiles: [RoomStore.Tile]

    // Rows first, then however many columns that needs. The bottom third is
    // wide and short, so filling a row before starting another keeps tiles as
    // close to square as the space allows.
    static func rows(_ count: Int) -> Int {
        max(1, Int(ceil(Double(count) / 4)))
    }

    static func columns(_ count: Int) -> Int {
        max(1, Int(ceil(Double(count) / Double(rows(count)))))
    }

    var body: some View {
        if tiles.isEmpty {
            Text("connecting…")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            let columns = Self.columns(tiles.count)
            // No spacing and no padding: the faces meet each other and the
            // edges of the screen, so the bottom third reads as one band of
            // video rather than a tray of cards.
            Grid(horizontalSpacing: 0, verticalSpacing: 0) {
                ForEach(Array(stride(from: 0, to: tiles.count, by: columns)), id: \.self) { start in
                    GridRow {
                        ForEach(tiles[start..<min(start + columns, tiles.count)]) { tile in
                            TileView(tile: tile)
                        }
                        // A short last row keeps its tiles the size of all the
                        // others rather than stretching them to fill the width.
                        if start + columns > tiles.count {
                            ForEach(0..<(start + columns - tiles.count), id: \.self) { _ in
                                Color.clear
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct TileView: View {
    @Environment(RoomStore.self) private var store
    let tile: RoomStore.Tile

    @State private var confirmingRemove = false
    @State private var reporting = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if tile.isBlocked {
                // Not a black rectangle with no explanation: blocking is
                // something you did, and the tile says so and how to undo it.
                Color(white: 0.06)
                    .overlay {
                        VStack(spacing: 2) {
                            Image(systemName: "eye.slash.fill").font(.caption)
                            Text("blocked").font(.caption2)
                        }
                        .foregroundStyle(.secondary)
                    }
            } else if let track = tile.track {
                SwiftUIVideoView(track, layoutMode: .fill, mirrorMode: tile.isLocal ? .mirror : .auto)
            } else {
                Color(white: 0.1)
                    .overlay(Text("camera off").font(.caption2).foregroundStyle(.secondary))
            }

            Text(tile.isLocal ? "\(tile.name) (you)" : tile.name)
                .font(.caption2)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(.black.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(4)
        }
        .clipped()
        .contentShape(Rectangle())
        // A long press rather than a visible button on every tile: faces in
        // the bottom third have no room for chrome, and the more of them there
        // are the less room there is. This is the gesture iOS already uses for
        // "what can I do with this thing".
        .contextMenu { menu }
        .confirmationDialog(
            "Remove \(tile.name) from the game?",
            isPresented: $confirmingRemove,
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) { Task { await store.removePlayer(tile) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("They lose their place and their invite stops working.")
        }
        .confirmationDialog("Report \(tile.name)", isPresented: $reporting, titleVisibility: .visible) {
            Button("Abusive behaviour") { Task { await store.report(tile, reason: "abuse") } }
            Button("Harassment") { Task { await store.report(tile, reason: "harassment") } }
            Button("Nudity or sexual content") { Task { await store.report(tile, reason: "nudity") } }
            Button("Hate speech") { Task { await store.report(tile, reason: "hate") } }
            Button("Something else") { Task { await store.report(tile, reason: "other") } }
            Button("Cancel", role: .cancel) {}
        }
    }

    @ViewBuilder
    private var menu: some View {
        if !tile.isLocal {
            Button {
                Task { await store.toggleBlock(tile) }
            } label: {
                Label(
                    tile.isBlocked ? "Unblock \(tile.name)" : "Block \(tile.name)",
                    systemImage: tile.isBlocked ? "eye" : "eye.slash"
                )
            }

            Button { reporting = true } label: {
                Label("Report \(tile.name)", systemImage: "flag")
            }

            // Removing is the host's, and it is destructive, so it is last and
            // it asks first.
            if store.isHost {
                Button(role: .destructive) { confirmingRemove = true } label: {
                    Label("Remove from game", systemImage: "person.fill.xmark")
                }
            }
        }
    }
}
