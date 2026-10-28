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
    @State private var showingActions = false
    /// Share was tapped in the actions menu; the sheet goes up once that menu
    /// is out of the way.
    @State private var shareWanted = false
    @State private var sharing: ShareRequest?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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

                    BoardView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        // However tight it gets, the board stays inside its
                        // own slot rather than drawing over its neighbours.
                        .clipped()

                    // Under the board, not over it: the question is what the
                    // board is an answer to, and reading downwards from the
                    // pyramid to the words puts them in that order.
                    roundTitle
                        // The near miss lands ON the question, which is the
                        // line everyone is already looking at between
                        // guesses — and it covers the one thing it is safe to
                        // cover for three seconds.
                        .overlay { guessToast }
                        // Later siblings draw over earlier ones, so without
                        // this the faces would clip a toast taller than the
                        // band it sits in.
                        .zIndex(1)

                    if store.isHost { hostControls }

                    // A third of the screen, always. Nothing is hidden and
                    // nothing is squeezed when the keyboard appears — the
                    // whole stack keeps its shape and slides, which is what
                    // KeyboardPinned is for.
                    bottomPanel
                        .frame(height: geo.size.height / 3)
                        .background(BoardStyle.background)
                        .clipped()

                    // One row: your own controls, the field, and the menu. It
                    // sits on the very bottom edge, and therefore directly on
                    // top of the keyboard when one is up.
                    footer
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


    // A near miss shouts; everything else murmurs. Being close is news, and
    // amber against a green-and-violet board with dark text on a filled
    // capsule is readable across a room on a video call. Being wrong is just
    // an answer, and a quiet slate pill says it without stopping the game.
    @ViewBuilder
    private var guessToast: some View {
        if let toast = store.guessToast {
            Text(toast.text)
                .font(.body(toast.emphatic ? 16 : 14, weight: toast.emphatic ? .bold : .semibold))
                .foregroundStyle(
                    toast.emphatic
                        ? Color(red: 0.11, green: 0.09, blue: 0.02)
                        : Color.white.opacity(0.92)
                )
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, toast.emphatic ? 20 : 16)
                .padding(.vertical, toast.emphatic ? 14 : 11)
                .background(
                    Capsule()
                        .fill(
                            toast.emphatic
                                ? Color(red: 0.98, green: 0.75, blue: 0.14)
                                : Color(red: 0.20, green: 0.22, blue: 0.26)
                        )
                        .shadow(color: .black.opacity(toast.emphatic ? 0.55 : 0.4),
                                radius: toast.emphatic ? 16 : 10, y: 5)
                )
                .padding(.horizontal, 16)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .scale(scale: 0.88).combined(with: .opacity)
                )
                .animation(
                    reduceMotion ? .easeOut(duration: 0.2)
                                 : .spring(response: 0.32, dampingFraction: 0.78),
                    value: store.guessToast
                )
        }
    }

    // The question the board is answering.
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
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                // Its own band, a shade up from the app's background. The
                // question is not part of the board and not part of the
                // faces; giving it a surface of its own says which is which
                // without drawing a line between them.
                .background(BoardStyle.titleBand)
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
    // Nothing but the occasional video note now that the code has gone, so it
    // takes no space at all unless it has something to say. An empty bar
    // across the top was costing the board a row of its own height.
    @ViewBuilder
    private var header: some View {
        if let note = store.videoNote {
            Text(note)
                .font(.body(11))
                .foregroundStyle(.orange)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
        }
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
            // Errors only. A verdict used to live here too, which meant a
            // line of text saying "hit" sat above a board that had just
            // turned a row green — the same news, twice, in the worse place.
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

                // The field takes the space the controls do not, instead of
                // sitting on a row of its own under an empty one.
                guessField

                // Everything else is behind one button. Mute and camera are
                // the two you reach for mid-sentence and they stay out here;
                // the rest are things you do once a game.
                Button { showingActions = true } label: {
                    GlassCircle {
                        Image(systemName: "ellipsis")
                            .font(.system(size: GlassStyle.symbol, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
                .accessibilityLabel("More options")
                .popover(isPresented: $showingActions, arrowEdge: .bottom) {
                    RoomActionsMenu(
                        onGiveUp: { confirmingGiveUp = true },
                        onShare: { shareWanted = true },
                        onDismiss: { showingActions = false }
                    )
                    .presentationCompactAdaptation(.popover)
                }
                // Not a delay: the popover closing is the signal. One
                // presentation at a time is the whole point — two at once is
                // what left the ellipsis button dead.
                .onChange(of: showingActions) { _, open in
                    guard !open, shareWanted else { return }
                    shareWanted = false
                    if let link = store.inviteLink { sharing = ShareRequest(url: link) }
                }
                .sheet(item: $sharing) { request in
                    ActivitySheet(items: [request.url])
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 6)
        // Just clear of the home indicator, which the content now runs
        // underneath — the indicator is a thin bar at the very bottom, not
        // the 34pt the safe area reserves for it.
        .padding(.bottom, typing ? 8 : 12)
    }


    // Everyone types. You can still shout, and mostly will, but a player whose
    // microphone has failed can now play rather than watch.
    //
    // It sits IN the control row, taking the width the buttons do not, rather
    // than on a row of its own beneath an almost-empty one.
    private var guessField: some View {
        let live = store.round?.isLive == true
        let canSend = live && !guess.trimmed.isEmpty

        return GlassField {
            HStack(spacing: 4) {
                TextField("Your guess…", text: $guess)
                    .textFieldStyle(.plain)
                    .font(.body(15))
                    .autocorrectionDisabled()
                    // The keyboard's blue key says Send and sends. Leaving it
                    // as Return meant the most obvious button did nothing.
                    .submitLabel(.send)
                    .focused($typing)
                    .onSubmit(submit)
                    .disabled(!live)
                    .padding(.leading, 14)

                Button(action: submit) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(canSend ? Color.black : Color.white.opacity(0.35))
                        .frame(width: 28, height: 28)
                        .background(
                            Circle().fill(canSend ? Color.white : Color.white.opacity(0.12))
                        )
                }
                .disabled(!canSend)
                .padding(.trailing, 5)
                .animation(.spring(response: 0.25, dampingFraction: 1.0), value: canSend)
            }
            .frame(height: GlassStyle.controlHeight)
        }
        // Swipe down on the field to put the keyboard away, without having to
        // find a Done button or tap some neutral patch of screen.
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


