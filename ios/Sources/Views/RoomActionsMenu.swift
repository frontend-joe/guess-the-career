import SwiftUI

// The room's actions, behind one button.
//
// Shaped after the Mearum client's MessageActionsMenu: the icon sits in a
// fixed leading lane so every label starts at the same x, and the rows are
// tall enough to hit without aiming. iOS's own Menu puts icons on the
// TRAILING edge and cannot be told otherwise, which is why this is built
// rather than configured.
struct RoomActionsMenu: View {
    @Environment(RoomStore.self) private var store

    let onGiveUp: () -> Void
    /// Asks the room to share, rather than sharing from in here. A sheet
    /// presented by a view that is closing never finishes presenting — see
    /// ActivitySheet.
    let onShare: () -> Void
    let onDismiss: () -> Void

    private static let inset: CGFloat = 16

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if store.isHost, store.round?.isLive == true {
                row("flag.fill", "Give up", action: onGiveUp)
            }

            if store.isHost, store.inviteLink != nil {
                row("square.and.arrow.up", "Share invite", action: onShare)
            }

            row("rectangle.portrait.and.arrow.right", "Leave") {
                Task { await store.exit() }
            }

            if store.isHost {
                // Destructive, and last: it closes the room for everybody, not
                // just for whoever tapped it.
                row("xmark.circle", "End game", tint: .red) {
                    Task { await store.endGame() }
                }
            }
        }
        .frame(minWidth: 220, alignment: .leading)
        .padding(.vertical, 6)
    }

    private func row(
        _ icon: String,
        _ label: String,
        tint: Color = .primary,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
            onDismiss()
        } label: {
            rowLabel(icon, label, tint: tint)
        }
        .buttonStyle(MenuRowStyle())
    }

    private func rowLabel(_ icon: String, _ label: String, tint: Color) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17))
                // A fixed lane, so every label starts at the same x however
                // wide its icon happens to draw.
                .frame(width: 24, alignment: .leading)
            Text(label).font(.body(17))
            Spacer(minLength: 0)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, Self.inset)
        .frame(height: 48)
        .contentShape(Rectangle())
    }
}

/// A row that tints while held, the way a native menu row does.
private struct MenuRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.primary.opacity(0.12) : .clear)
    }
}
