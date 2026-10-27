import SwiftUI
import UIKit

/// Hosts SwiftUI content between the top safe area and `keyboardLayoutGuide`,
/// so the whole screen moves with the keyboard rather than after it.
///
/// The technique is taken from the Mearum iOS client (`KeyboardPinned` there).
/// UIKit animates the guide INSIDE the keyboard's own animation; anything
/// reacting to `keyboardWillChangeFrame` — which is what SwiftUI's built-in
/// avoidance does — arrives a frame or two late however precisely its curve is
/// matched. That lag is what made this screen look broken: the board, the
/// controls and the field each arrived at slightly different times, over a
/// layout that was already the wrong size.
///
/// Unlike Mearum's version, the top is pinned too rather than left as `>=`.
/// Mearum hosts only its composer and lets the feed scroll behind it; here the
/// whole room is hosted, so the content has to COMPRESS into the space above
/// the keyboard. Pinning only the bottom would slide the board up out of the
/// screen instead.
///
/// The caller must add `.ignoresSafeArea(.keyboard)` or SwiftUI will shift the
/// container as well and everything moves twice.
struct KeyboardPinned<Content: View>: UIViewControllerRepresentable {
    @ViewBuilder var content: () -> Content

    func makeUIViewController(context: Context) -> Controller<Content> {
        Controller(rootView: content())
    }

    func updateUIViewController(_ controller: Controller<Content>, context: Context) {
        controller.update(content())
    }

    final class Controller<C: View>: UIViewController {
        private let host: UIHostingController<C>

        init(rootView: C) {
            host = UIHostingController(rootView: rootView)
            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .clear
            host.view.backgroundColor = .clear
            host.view.translatesAutoresizingMaskIntoConstraints = false
            addChild(host)
            view.addSubview(host.view)
            host.didMove(toParent: self)

            NSLayoutConstraint.activate([
                host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                host.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
                // At rest the guide sits on the safe area, so this is the
                // ordinary layout; raised, it is the keyboard's top edge, and
                // the content is re-laid-out into what is left.
                host.view.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            ])
        }

        func update(_ rootView: C) { host.rootView = rootView }
    }
}

extension View {
    /// Swipe down anywhere on this view to put the keyboard away.
    ///
    /// A deliberate threshold and a dominance check: the guess field sits
    /// directly above a row of buttons, and a short vertical wobble while
    /// reaching for one of them should not dismiss anything.
    func swipeDownToDismissKeyboard() -> some View {
        gesture(
            DragGesture(minimumDistance: 12, coordinateSpace: .global)
                .onChanged { value in
                    guard value.translation.height > 30,
                          value.translation.height > abs(value.translation.width) else { return }
                    // Idempotent, so it is safe if the drag keeps reporting.
                    UIApplication.shared.sendAction(
                        #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil
                    )
                }
        )
    }
}
