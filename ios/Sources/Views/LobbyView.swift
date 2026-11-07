import SwiftUI

// Hosting needs an account; joining needs a name and nothing else. That
// asymmetry is the product, not a shortcut — asking the friend you are already
// on a call with to sign up is how you end up playing on your own.
struct LobbyView: View {
    @Environment(RoomStore.self) private var store

    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var displayName = ""
    @State private var busy = false

    /// The host's name, and the one the server last confirmed.
    ///
    /// Two of them so that saving can be skipped when nothing was typed. A
    /// signed-in host had no way to change this at all — the name on their
    /// tile was whatever their email started with, which for the only account
    /// that exists is "admin".
    @State private var hostName = ""
    @State private var savedHostName = ""

    /// Which field is up, so an action can put it away. Without this the
    /// password field keeps first responder while signing in swaps the whole
    /// section out from under it, and SwiftUI leaves the keyboard standing —
    /// over the lobby, and then over the room you create next.
    @FocusState private var focus: Field?

    private enum Field { case code, displayName, email, password, hostName }

    var body: some View {
        NavigationStack {
            Form {
                Section("Join a game") {
                    TextField("Code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                        .focused($focus, equals: .code)
                    TextField("Your name", text: $displayName)
                        .textInputAutocapitalization(.words)
                        .focused($focus, equals: .displayName)
                    Button("Join") { run { try await join() } }
                        .disabled(busy || code.trimmed.isEmpty || displayName.trimmed.isEmpty)
                }

                Section("Host a game") {
                    if store.accessToken == nil {
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .email)
                        SecureField("Password", text: $password)
                            .focused($focus, equals: .password)
                        Button("Sign in") { run { try await signIn() } }
                            .disabled(busy || email.trimmed.isEmpty || password.isEmpty)
                    } else {
                        // Editable, and saved on the way into the room rather
                        // than behind a Save button: the only moment anybody
                        // cares what their name is, is the moment before
                        // everybody else can see it.
                        TextField("Your name", text: $hostName)
                            .textInputAutocapitalization(.words)
                            .focused($focus, equals: .hostName)
                            .onSubmit { run { try await saveHostName() } }
                        Button("Create a room") { run { try await create() } }
                            .disabled(busy || hostName.trimmed.isEmpty)
                    }
                }

                if let error = store.error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Football Tenable")
            .disabled(busy)
            // An invite link fills the code in and leaves the guest with only
            // the one thing they actually have to supply: their name.
            // A host who was already signed in when the app launched never
            // passes through signIn(), so the name is fetched here too.
            .task(id: store.accessToken) { await loadHostName() }
            .onChange(of: store.pendingJoinCode, initial: true) { _, invited in
                guard let invited else { return }
                code = invited
                store.pendingJoinCode = nil
                // Whatever went wrong with the last room is not news about this
                // link, so a fresh invite clears the slate it lands on.
                store.error = nil
            }
        }
    }

    private func signIn() async throws {
        let pair = try await API.signIn(email: email.trimmed, password: password)
        store.accessToken = pair.accessToken
        password = ""
        await loadHostName()
    }

    /// What the server currently thinks this host is called.
    ///
    /// Failure is deliberately silent. Not knowing the name yet is no reason
    /// to put a red line across the lobby — the field is editable either way,
    /// and typing one in is the fix for both cases.
    private func loadHostName() async {
        guard let token = store.accessToken else { return }
        guard let name = try? await API.account(accessToken: token).displayName else { return }
        hostName = name
        savedHostName = name
    }

    private func saveHostName() async throws {
        guard let token = store.accessToken else { return }
        let name = hostName.trimmed
        guard !name.isEmpty, name != savedHostName else { return }
        _ = try await API.setDisplayName(name, accessToken: token)
        savedHostName = name
        // So the push registry can say which phone this is, the same as the
        // guest path does when somebody joins by name.
        PushStore.shared.noteDisplayName(name)
    }

    private func create() async throws {
        guard let token = store.accessToken else { return }
        // Before the room, not after: createRoom snapshots the name onto the
        // participant row, and a rename that lands a moment later would leave
        // the host sitting under the old one for the whole game.
        try await saveHostName()
        // The push token goes out WITH the create, so the server knows which
        // phone the host is on before it sends the invite that must skip it.
        let joined = try await API.createRoom(
            accessToken: token, name: nil, pushToken: PushStore.shared.tokenForJoin
        )
        PushStore.shared.adopt(secret: joined.deviceSecret)
        store.enter(joined)
    }

    private func join() async throws {
        let name = displayName.trimmed
        let joined = try await API.joinRoom(
            code: code.trimmed.uppercased(), displayName: name,
            pushToken: PushStore.shared.tokenForJoin
        )
        PushStore.shared.adopt(secret: joined.deviceSecret)
        PushStore.shared.noteDisplayName(name)
        store.enter(joined)
    }

    private func run(_ body: @escaping () async throws -> Void) {
        // Every button in this form commits something, and a commit puts the
        // keyboard away — before the work, so the field is no longer first
        // responder by the time signing in or creating a room redraws the view.
        focus = nil
        busy = true
        store.error = nil
        Task {
            do { try await body() } catch { store.error = error.localizedDescription }
            busy = false
        }
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
