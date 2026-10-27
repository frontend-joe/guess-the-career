import SwiftUI

// Chat lives in the same third of the screen the faces do, as the other tab,
// because the two are alternatives: you are reading the room by sight or by
// text. Giving chat its own strip would take space from the board in exchange
// for a panel most games never open.
struct ChatView: View {
    @Environment(RoomStore.self) private var store

    @State private var draft = ""
    @FocusState private var writing: Bool

    private var messages: [ChatMessage] { store.state?.messages ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 8) {
                        if messages.isEmpty {
                            Text("No messages yet. Type here if your mic or camera isn't working.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 8)
                        }
                        ForEach(messages) { message in
                            bubble(message).id(message.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                // Follow the conversation, the way every chat does. Keyed on
                // the id of the last message rather than the count, so a
                // resync that replaces the window still scrolls correctly.
                .onChange(of: messages.last?.id) { _, last in
                    guard let last else { return }
                    withAnimation { proxy.scrollTo(last, anchor: .bottom) }
                }
                .onAppear {
                    if let last = messages.last?.id { proxy.scrollTo(last, anchor: .bottom) }
                }
            }

            HStack(spacing: 8) {
                TextField("Message", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...3)
                    .focused($writing)
                    .submitLabel(.send)
                    .onSubmit(send)
                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill").font(.title2)
                }
                .disabled(draft.trimmed.isEmpty)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(red: 0.063, green: 0.071, blue: 0.090))
            .swipeDownToDismissKeyboard()
        }
        .background(BoardStyle.background)
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage) -> some View {
        let mine = message.participantId == store.seat?.participantId
        VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
            Text(message.displayName)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(message.body)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(mine ? Color.accentColor.opacity(0.35) : Color(white: 0.17))
                )
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    private func send() {
        let text = draft.trimmed
        guard !text.isEmpty else { return }
        draft = ""
        Task { await store.sendChat(text) }
    }
}
