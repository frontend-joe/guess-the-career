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

    /// Which field is up, so an action can put it away. Without this the
    /// password field keeps first responder while signing in swaps the whole
    /// section out from under it, and SwiftUI leaves the keyboard standing —
    /// over the lobby, and then over the room you create next.
    @FocusState private var focus: Field?

    private enum Field { case code, displayName, email, password }

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
                        Button("Create a room") { run { try await create() } }
                            .disabled(busy)
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
            .onChange(of: store.pendingJoinCode, initial: true) { _, invited in
                guard let invited else { return }
                code = invited
                store.pendingJoinCode = nil
            }
        }
    }

    private func signIn() async throws {
        let pair = try await API.signIn(email: email.trimmed, password: password)
        store.accessToken = pair.accessToken
        password = ""
    }

    private func create() async throws {
        guard let token = store.accessToken else { return }
        store.enter(try await API.createRoom(accessToken: token, name: nil))
    }

    private func join() async throws {
        store.enter(try await API.joinRoom(code: code.trimmed.uppercased(), displayName: displayName.trimmed))
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
