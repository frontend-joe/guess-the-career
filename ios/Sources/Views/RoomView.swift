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

    // Only what you need BEFORE a round: pick one, start it. It goes away
    // once the round is live, because by then there is nothing left to set up
    // — everything you can still do lives in the one row at the bottom.
    @ViewBuilder
    private var hostControls: some View {
        if store.round?.isLive != true {
            HStack {
                Button("Choose round") { showingRoundPicker = true }
                    .buttonStyle(.bordered)
                Button("Start") { Task { await store.startRound() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(store.pendingInstanceId == nil)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    // One row for every action available at any moment of a game: your own
    // microphone and camera on the left, what you can do to the room on the
    // right, and the way out last.
    //
    // All one height, all the same material, so the row reads as one set of
    // controls. Colour is kept for meaning rather than decoration: red means
    // either "this is off" or "this ends something", and everything else is
    // plain white. The row previously carried red, red, blue, red and blue at
    // once, which gave the eye no hierarchy to use.
    private var footer: some View {
        VStack(spacing: 6) {
            // The error gets its own line rather than competing for width
            // with six controls, where it was truncated to a few characters
            // exactly when it had something to say.
            if let error = store.error {
                Text(error)
                    .font(.body(11))
                    .foregroundStyle(.red)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 8) {
                Button {
                    Task { await store.setMicrophone(!store.microphoneOn) }
                } label: {
                    Image(systemName: store.microphoneOn ? "mic.fill" : "mic.slash.fill")
                        .font(.system(size: GlassStyle.symbol))
                        .foregroundStyle(store.microphoneOn ? .white : .red)
                }
                .buttonStyle(GlassCircleButtonStyle())
                .accessibilityLabel(store.microphoneOn ? "Mute" : "Unmute")

                Button {
                    Task { await store.setCamera(!store.cameraOn) }
                } label: {
                    Image(systemName: store.cameraOn ? "video.fill" : "video.slash.fill")
                        .font(.system(size: GlassStyle.symbol))
                        .foregroundStyle(store.cameraOn ? .white : .red)
                }
                .buttonStyle(GlassCircleButtonStyle())
                .accessibilityLabel(store.cameraOn ? "Turn camera off" : "Turn camera on")

                Spacer(minLength: 8)

                if store.isHost, store.round?.isLive == true {
                    Button("Give up") { confirmingGiveUp = true }
                        .font(.body(14, weight: .medium))
                        .foregroundStyle(.white)
                        .buttonStyle(GlassCapsuleButtonStyle())
                }
                if store.isHost, let link = store.inviteLink {
                    ShareLink(item: link, message: Text("Join my Tenable game")) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: GlassStyle.symbol))
                            .foregroundStyle(.white)
                    }
                    .buttonStyle(GlassCircleButtonStyle())
                }
                if store.isHost {
                    Button("End game") { Task { await store.endGame() } }
                        .font(.body(14, weight: .medium))
                        .foregroundStyle(.red)
                        .buttonStyle(GlassCapsuleButtonStyle())
                }
                Button("Leave") { Task { await store.exit() } }
                    .font(.body(14, weight: .medium))
                    .foregroundStyle(.white)
                    .buttonStyle(GlassCapsuleButtonStyle())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    // Everyone types. You can still shout, and mostly will, but a player whose
    // microphone has failed can now play rather than watch.
    //
    // The field IS the bottom section — one full-width well with the send
    // button floating inside it, rather than a box with controls parked
    // alongside eating width the words need.
    private var guessBar: some View {
        let live = store.round?.isLive == true
        let canSend = live && !guess.trimmed.isEmpty

        return GlassField {
            HStack(spacing: 8) {
                TextField("Your guess…", text: $guess)
                    .textFieldStyle(.plain)
                    .font(.body(16))
                    .autocorrectionDisabled()
                    // The keyboard's blue key says Send and sends. Leaving it
                    // as Return meant the most obvious button did nothing.
                    .submitLabel(.send)
                    .focused($typing)
                    .onSubmit(submit)
                    .disabled(!live)
                    .padding(.leading, 18)

                if let last = store.lastGuess {
                    Text(last.verdict)
                        .font(.body(12, weight: .semibold))
                        .foregroundStyle(verdictColour(last.verdict))
                        .transition(.opacity)
                }

                Button(action: submit) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(canSend ? Color.black : Color.white.opacity(0.35))
                        .frame(width: 34, height: 34)
                        .background(
                            Circle().fill(canSend ? Color.white : Color.white.opacity(0.12))
                        )
                }
                .disabled(!canSend)
                .padding(.trailing, 6)
                .animation(.spring(response: 0.25, dampingFraction: 1.0), value: canSend)
            }
            .frame(height: 50)
        }
        .animation(.spring(response: 0.3, dampingFraction: 1.0), value: store.lastGuess?.verdict)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        // Swipe down on the composer to put the keyboard away, without having
        // to find a Done button or tap some neutral patch of screen.
        .swipeDownToDismissKeyboard()
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


