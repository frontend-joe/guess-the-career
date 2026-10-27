import SwiftUI

// The podcast composition, live: board over the top two thirds, faces across
// the bottom third. Keeping the playing layout and the recorded layout the
// same means the shape of the video is being tested every time anyone plays,
// rather than discovered late when the compositor is written.
struct RoomView: View {
    @Environment(RoomStore.self) private var store

    @State private var guess = ""
    @State private var showingRoundPicker = false
    @State private var confirmingGiveUp = false
    /// Whether the guess field holds the keyboard. The layout changes shape
    /// while you type rather than trying to fit everything at once.
    @FocusState private var typing: Bool


    var body: some View {
        // Every height here is a share of the space actually available, read
        // live from the geometry. It used to be a share of UIScreen's height,
        // which is a different number entirely once the keyboard is up: the
        // panel went on claiming a third of the WHOLE screen when only half
        // the screen was left, the board was squeezed into what remained, and
        // the pyramid drew straight over the controls and the status bar.
        // Pinned between the top safe area and the keyboard, so the whole
        // screen moves as one thing inside the keyboard's own animation
        // rather than each part arriving a frame late.
        KeyboardPinned {
            GeometryReader { geo in
                VStack(spacing: 0) {
                    header
                    roundTitle

                    BoardView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        // However tight it gets, the board stays inside its
                        // own slot rather than drawing over its neighbours.
                        .clipped()

                    if store.isHost { hostControls }

                    // A third of the screen, always. Nothing is hidden and
                    // nothing is squeezed when the keyboard appears — the
                    // whole stack keeps its shape and slides, which is what
                    // KeyboardPinned is for.
                    bottomPanel
                        .frame(height: geo.size.height / 3)
                        .background(BoardStyle.background)
                        .clipped()

                    footer

                    // Last, so it sits on the very bottom edge — and therefore
                    // directly on top of the keyboard when one is up. It is a
                    // composer, and a composer belongs where your thumbs are.
                    guessBar
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .background(BoardStyle.background)
        }
        // Without this SwiftUI's own avoidance shifts the container too, and
        // everything moves twice.
        .ignoresSafeArea(.keyboard)
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
    // Faces only, for now. The Video/Chat tabs are off while the call is the
    // thing being tested — chat was built for the player whose camera or
    // microphone has failed, and a tab bar costs the faces vertical space in
    // every game where nothing has failed. ChatView and its endpoint are
    // untouched, so this is one view away from coming back.
    private var bottomPanel: some View {
        VideoGridView(tiles: store.tiles)
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
                .focused($typing)
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
        .padding(.vertical, 8)
        .background(Color(red: 0.063, green: 0.071, blue: 0.090))
        // Swipe down on the composer to put the keyboard away, without having
        // to find a Done button or tap some neutral patch of screen.
        .swipeDownToDismissKeyboard()
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
        guard !raw.isEmpty else {
            // An empty send is how you ask for the keyboard to go away.
            typing = false
            return
        }
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


