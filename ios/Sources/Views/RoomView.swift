import SwiftUI

// The podcast composition, live: board over the top two thirds, faces across
// the bottom third. Keeping the playing layout and the recorded layout the
// same means the shape of the video is being tested every time anyone plays,
// rather than discovered late when the compositor is written.
struct RoomView: View {
    @Environment(RoomStore.self) private var store

    @State private var guess = ""
    @State private var showingRoundPicker = false
    @State private var tab = Tab.video
    /// The newest message id already seen, so the Chat tab can say how many
    /// arrived while you were watching faces.
    @State private var seenMessageId = 0

    private enum Tab { case video, chat }

    var body: some View {
        VStack(spacing: 0) {
            header
            roundTitle

            BoardView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if store.isHost { hostControls }
            guessBar

            bottomPanel
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

    // Faces and chat share the bottom third rather than splitting it: chat is
    // there for the player whose camera or microphone has failed, which is
    // precisely when their tile is worth nothing anyway.
    private var bottomPanel: some View {
        VStack(spacing: 0) {
            Picker("", selection: $tab) {
                Text("Video").tag(Tab.video)
                Text(unread > 0 ? "Chat (\(unread))" : "Chat").tag(Tab.chat)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)

            switch tab {
            case .video:
                VideoGridView(tiles: store.tiles)
            case .chat:
                ChatView()
            }
        }
        .onChange(of: tab) { _, now in
            if now == .chat { markChatRead() }
        }
        .onChange(of: store.state?.messages.last?.id) { _, _ in
            if tab == .chat { markChatRead() }
        }
    }

    private var unread: Int {
        (store.state?.messages ?? []).filter { $0.id > seenMessageId }.count
    }

    private func markChatRead() {
        seenMessageId = max(seenMessageId, store.state?.messages.last?.id ?? 0)
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

    // Choosing, starting and ending a round are the host's calls. Guessing is
    // not — see guessBar.
    @ViewBuilder
    private var hostControls: some View {
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
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    // Everyone types. You can still shout, and mostly will, but a player whose
    // microphone has failed can now play rather than watch.
    private var guessBar: some View {
        HStack {
            TextField("Your guess…", text: $guess)
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
