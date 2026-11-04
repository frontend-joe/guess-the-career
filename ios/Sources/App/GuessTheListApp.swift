import SwiftUI

@main
struct GuessTheListApp: App {
    @State private var store = RoomStore()
    // Remote notifications are still delivered to a UIApplicationDelegate,
    // with no SwiftUI equivalent. See Push/AppDelegate.swift.
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var push = PushStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.dark)
                .task { await store.restoreSeat() }
                .onOpenURL { store.handleInvite($0) }
                // A tapped notification and a tapped link are the same thing
                // and go the same way in. `initial: true` is what catches the
                // tap that LAUNCHED the app, which arrives before this view
                // has drawn and would otherwise be dropped.
                .onChange(of: push.pendingInvite, initial: true) { _, invite in
                    guard let invite else { return }
                    push.pendingInvite = nil
                    store.handleInvite(invite)
                }
        }
    }
}

struct RootView: View {
    @Environment(RoomStore.self) private var store

    var body: some View {
        switch store.phase {
        case .lobby: LobbyView()
        case .inRoom: RoomView()
        }
    }
}
