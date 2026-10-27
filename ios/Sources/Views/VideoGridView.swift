import SwiftUI
import LiveKit

// Two to four faces across the bottom third. The grid is fixed by count rather
// than flowing, because the compositor will lay the recording out the same way
// and the two should not be able to disagree.
struct VideoGridView: View {
    let tiles: [RoomStore.Tile]

    var body: some View {
        if tiles.isEmpty {
            Text("connecting…")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            HStack(spacing: 4) {
                ForEach(tiles) { tile in
                    TileView(tile: tile)
                }
            }
            .padding(4)
        }
    }
}

private struct TileView: View {
    let tile: RoomStore.Tile

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let track = tile.participant.firstCameraVideoTrack {
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
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
