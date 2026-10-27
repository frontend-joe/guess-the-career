import SwiftUI

@main
struct GuessTheListApp: App {
    @State private var store = RoomStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.dark)
                .task { await store.restoreSeat() }
                .onOpenURL { store.handleInvite($0) }
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
