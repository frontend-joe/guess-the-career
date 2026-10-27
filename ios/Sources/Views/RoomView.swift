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
    @State private var confirmingGiveUp = false

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
                .background(BoardStyle.background)

            footer
        }
        .background(BoardStyle.background)
        .sheet(isPresented: $showingRoundPicker) { RoundPickerView() }
        // Giving up cannot be undone and ends the round for everybody, which
        // is the one case that earns a confirmation. Choosing a round does
        // not, which is why they are not the same button by accident.
        .confirmationDialog(
            "Give up and show the answers?",
            isPresented: $confirmingGiveUp,
            titleVisibility: .visible
        ) {
            Button("Show the answers", role: .destructive) { Task { await store.giveUp() } }
            Button("Keep playing", role: .cancel) { }
        }
    }

    // The question, where the web game puts it: across the top, above the
    // board, so it is readable without looking past the pyramid.
    @ViewBuilder
    private var roundTitle: some View {
        if let round = store.round {
            // Just the question. The found count was telling you what the
            // board already shows.
            Text(round.board.title)
                .font(.display(15))
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
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

    // Just the code. Sharing sits with the other actions, and the state
    // version was a debugging aid that earned its place during Phase 2 and
    // stopped earning it once the sync stopped being the thing under test.
    // No code on screen. People join by tapping the link you send them, so a
    // six-character string to read out and mistype is a step that no longer
    // needs to exist.
    private var header: some View {
        HStack(spacing: 12) {
            Spacer()
            if let note = store.videoNote {
                Text(note).font(.caption2).foregroundStyle(.orange)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // Choosing, starting and ending a round are the host's calls. Guessing is
    // not — see guessBar.
    @ViewBuilder
    private var hostControls: some View {
        HStack {
            // One slot, two jobs, because they never apply at the same time:
            // before kickoff you are choosing what to play, and during a round
            // the only thing left to decide is whether to stop.
            if store.round?.isLive == true {
                Button("Give up", role: .destructive) { confirmingGiveUp = true }
                    .buttonStyle(.bordered)
            } else {
                Button("Choose round") { showingRoundPicker = true }
                    .buttonStyle(.bordered)
                Button("Start") { Task { await store.startRound() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(store.round?.isPending != true)
            }
            Spacer()
            if let link = store.inviteLink {
                ShareLink(item: link, message: Text("Join my Tenable game")) {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
            }
            Button("End", role: .destructive) { Task { await store.endGame() } }
                .buttonStyle(.bordered)
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    // Everyone types. You can still shout, and mostly will, but a player whose
    // microphone has failed can now play rather than watch.
    private var guessBar: some View {
        HStack(spacing: 8) {
            TextField("Your guess…", text: $guess)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                // The keyboard's blue key says Send and sends. Leaving it as
                // Return meant the most obvious button on screen did nothing.
                .submitLabel(.send)
                .onSubmit(submit)
                .disabled(store.round?.isLive != true)
            if let last = store.lastGuess {
                Text(last.verdict)
                    .font(.body(12, weight: .semibold))
                    .foregroundStyle(verdictColour(last.verdict))
                    .transition(.opacity)
            }
            Button(action: submit) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
                    // 44pt of target around a 28pt glyph.
                    .frame(width: 44, height: 44)
            }
            .disabled(store.round?.isLive != true || guess.trimmed.isEmpty)
        }
        .animation(.spring(response: 0.3, dampingFraction: 1.0), value: store.lastGuess?.verdict)
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
        Task {
            await store.guess(raw)
            // Causality: fired on the verdict, which is the event, rather than
            // on the tap, which is only the request. Hits and misses feel
            // different because they are different.
            switch store.lastGuess?.verdict {
            case "hit": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "miss": UINotificationFeedbackGenerator().notificationOccurred(.warning)
            default: break
            }
        }
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
