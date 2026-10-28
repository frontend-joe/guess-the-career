import SwiftUI
import UIKit

/// The system share sheet, presented by whoever owns the screen.
///
/// This exists because a ShareLink INSIDE the actions popover did not work: the
/// tap dismissed the popover and presented the sheet in the same instant, so
/// the sheet's presenter was being torn down as it presented. The sheet flashed
/// and vanished, and SwiftUI was left believing something was still up — after
/// which the ellipsis button opened nothing at all.
///
/// So the share is presented from the room itself, once the popover has
/// finished closing, and the popover only ever records that it was asked for.
struct ActivitySheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// A URL that can drive `.sheet(item:)`, which needs an Identifiable.
struct ShareRequest: Identifiable {
    let id = UUID()
    let url: URL
}
