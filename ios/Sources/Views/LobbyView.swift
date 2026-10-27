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

    var body: some View {
        NavigationStack {
            Form {
                Section("Join a game") {
                    TextField("Code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                    TextField("Your name", text: $displayName)
                        .textInputAutocapitalization(.words)
                    Button("Join") { run { try await join() } }
                        .disabled(busy || code.trimmed.isEmpty || displayName.trimmed.isEmpty)
                }

                Section("Host a game") {
                    if store.accessToken == nil {
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                        SecureField("Password", text: $password)
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
