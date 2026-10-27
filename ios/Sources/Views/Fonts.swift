import SwiftUI

// The web game's faces, bundled so the apps read as the same product:
// Russo One for the board and anything display-sized (client/src/index.css
// calls it .font-display), Noto Sans for everything you read as text.
//
// The names are PostScript names, not file names. Getting one wrong fails
// silently — SwiftUI falls back to the system font and says nothing — so they
// are in one place rather than spelled out at every call site.
extension Font {
    /// Russo One, the board face. The web game's .font-display.
    static func display(_ size: CGFloat) -> Font {
        .custom("RussoOne-Regular", size: size)
    }

    /// Noto Sans, the reading face.
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold, .heavy, .black: return .custom("NotoSans-Bold", size: size)
        case .semibold, .medium: return .custom("NotoSans-SemiBold", size: size)
        default: return .custom("NotoSans-Regular", size: size)
        }
    }
}
