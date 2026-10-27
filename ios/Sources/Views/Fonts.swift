import SwiftUI

// One bundled face: Russo One, for the board and anything display-sized (the
// web game's .font-display). Everything else is the system font.
//
// The names are PostScript names, not file names. Getting one wrong fails
// silently — SwiftUI falls back to the system font and says nothing — so they
// are in one place rather than spelled out at every call site.
extension Font {
    /// Russo One, the board face. The web game's .font-display.
    static func display(_ size: CGFloat) -> Font {
        .custom("RussoOne-Regular", size: size)
    }

    /// The system face, for everything that is not the board.
    ///
    /// San Francisco, not a bundled web font. It already ships optical sizing,
    /// tracking tables and legibility tuning that a downloaded .ttf does not,
    /// it honours the reader's text-size setting, and it is what every other
    /// control on the screen is set in. Russo One earns its place because the
    /// board IS the game's identity; ordinary text does not.
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}
