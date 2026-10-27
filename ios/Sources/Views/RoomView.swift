import SwiftUI

// The podcast composition, live: board over the top two thirds, faces across
// the bottom third. Keeping the playing layout and the recorded layout the
// same means the shape of the video is being tested every time anyone plays,
// rather than discovered late when the compositor is written.
struct RoomView: View {
    @Environment(RoomStore.self) private var store

    @State private var guess = ""
    @State private var showingRoundPicker = false

    var body: some View {
        VStack(spacing: 0) {
            header
            roundTitle

            BoardView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if store.isHost { hostControls }

            VideoGridView(tiles: store.tiles)
                .frame(height: UIScreen.main.bounds.height / 3)
                .background(.black)

            footer
        }
        .background(Color(white: 0.04))
        .sheet(isPresented: $showingRoundPicker) { RoundPickerView() }
    }

    // The question, where the web game puts it: across the top, above the
    // board, so it is readable without looking past the pyramid.
    @ViewBuilder
    private var roundTitle: some View {
        if let round = store.round {
            VStack(spacing: 2) {
                Text(round.board.title)
                    .font(.system(size: 15, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(round.board.revealed.count) / \(round.board.target) found")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.bottom, 4)
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Text(store.state?.code ?? "")
                .font(.system(.title3, design: .monospaced))
                .tracking(4)
                .foregroundStyle(.green)
            if let code = store.state?.code {
                ShareLink(item: "Join my Tenable game — code \(code)") {
                    Image(systemName: "square.and.arrow.up")
                }
            }
            Spacer()
            if let note = store.videoNote {
                Text(note).font(.caption2).foregroundStyle(.orange)
            }
            Text("v\(store.state?.stateVersion ?? 0)")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var hostControls: some View {
        VStack(spacing: 8) {
            HStack {
                Button("Choose round") { showingRoundPicker = true }
                    .buttonStyle(.bordered)
                Button("Start") { Task { await store.startRound() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(store.round?.isPending != true)
                Spacer()
                Button("End", role: .destructive) { Task { await store.endGame() } }
                    .buttonStyle(.bordered)
            }

            // Only the host types. Everyone else shouts — which is the game,
            // and is enforced on the server, not here.
            HStack {
                TextField("Type what they shout…", text: $guess)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .onSubmit(submit)
                    .disabled(store.round?.isLive != true)
                if let last = store.lastGuess {
                    Text(last.verdict)
                        .font(.caption)
                        .foregroundStyle(verdictColour(last.verdict))
                }
            }
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    private var footer: some View {
        HStack(spacing: 16) {
            Button {
                Task { await store.setMicrophone(!store.microphoneOn) }
            } label: {
                Image(systemName: store.microphoneOn ? "mic.fill" : "mic.slash.fill")
            }
            Button {
                Task { await store.setCamera(!store.cameraOn) }
            } label: {
                Image(systemName: store.cameraOn ? "video.fill" : "video.slash.fill")
            }
            Spacer()
            if let error = store.error {
                Text(error).font(.caption2).foregroundStyle(.red).lineLimit(1)
            }
            Button("Leave") { Task { await store.exit() } }
                .font(.caption)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func submit() {
        let raw = guess.trimmed
        guard !raw.isEmpty else { return }
        guess = ""
        Task { await store.guess(raw) }
    }
}

func verdictColour(_ verdict: String) -> Color {
    switch verdict {
    case "hit": return .green
    case "near": return .orange
    case "duplicate": return .blue
    default: return .red
    }
}
