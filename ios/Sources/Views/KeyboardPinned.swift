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
/// The hosted content keeps its FULL height — the height it has with no
/// keyboard — and only its bottom edge is pinned. So when the keyboard comes
/// up the whole room slides up as one piece and the top runs off the screen,
/// rather than everything being squashed into what is left.
///
/// Compressing was tried first and was wrong: there is simply not enough room
/// above a keyboard for a ten-row board, a video strip and three rows of
/// controls, so something had to be crushed or hidden, and both looked bad.
/// Sliding keeps every part of the screen exactly the size and shape it
/// already was.
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
        private let restingArea = UILayoutGuide()

        init(rootView: C) {
            host = UIHostingController(rootView: rootView)
            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .clear
            // At rest the guide normally parks on the bottom SAFE AREA, which
            // left a dead band under the composer the height of the home
            // indicator. Off, it parks on the bottom of the view instead, so
            // the content fills the screen — the composer keeps its own
            // padding, which is what holds it clear of the indicator.
            view.keyboardLayoutGuide.usesBottomSafeArea = false

            // The space the content occupies when no keyboard is up.
            view.addLayoutGuide(restingArea)
            NSLayoutConstraint.activate([
                restingArea.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
                restingArea.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            ])
            // The content is taller than this container once it has slid, and
            // the overflow must not draw over the status bar.
            view.clipsToBounds = true
            host.view.backgroundColor = .clear
            host.view.translatesAutoresizingMaskIntoConstraints = false
            addChild(host)
            view.addSubview(host.view)
            host.didMove(toParent: self)

            NSLayoutConstraint.activate([
                host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                // Always the full height, keyboard or no keyboard, so the
                // layout inside never changes shape — specifically...
                // ...the height it has at REST, which is from the top safe
                // area down to the bottom of the screen. Expressed as a guide
                // rather than a number so it follows a rotation or a change
                // in the safe area on its own.
                host.view.heightAnchor.constraint(equalTo: restingArea.heightAnchor),
                // ...and only this moves. At rest the guide sits on the safe
                // area; raised, it is the keyboard's top edge, and the whole
                // thing travels up with it.
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
