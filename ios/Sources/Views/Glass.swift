import SwiftUI

// Liquid Glass controls, with a hand-rolled press below iOS 26.
//
// The shape of this is taken from the Mearum client's Glass.swift, including
// the part that is easy to get backwards: the glass has to be applied AT REST,
// not while the button is held. `.interactive()` is the system animating its
// own press, and it can only do that if the material is already there — apply
// it on `isPressed` and it arrives fully formed at the moment of the press,
// with nothing left to animate.
//
// Below 26 there is no glass to lift into, so the fill lightens and the disc
// dips instead. The swell is set WITHOUT animation and only the settle is
// animated: a spring in both directions starts at zero velocity and travels a
// couple of percent in the time a tap lasts, which looks like nothing happened.

enum GlassStyle {
    /// Everything in the control row is this across, so the row reads as one
    /// set of controls rather than a line of differently-sized things.
    static let controlHeight: CGFloat = 38
    static let symbol: CGFloat = 16

    /// The resting fill under the glass. Dark enough to separate from the
    /// board, light enough that a symbol on it never needs a shadow.
    static let disc = Color.white.opacity(0.10)
    static let discPressed = Color.white.opacity(0.20)
}

/// A round icon button — the shape iOS uses for a control that is only ever
/// an icon: mute, camera, share.
struct GlassCircleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @ViewBuilder
    func makeBody(configuration: Configuration) -> some View {
        if #available(iOS 26, *) {
            configuration.label
                .frame(width: GlassStyle.controlHeight, height: GlassStyle.controlHeight)
                .background {
                    Circle().fill(GlassStyle.disc)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
        } else {
            LegacyGlass(configuration: configuration, shape: .circle, reduceMotion: reduceMotion)
                .frame(width: GlassStyle.controlHeight, height: GlassStyle.controlHeight)
        }
    }
}

/// A capsule for a control that needs a word. Same height as the circles, so
/// the row has one baseline and one rhythm.
struct GlassCapsuleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @ViewBuilder
    func makeBody(configuration: Configuration) -> some View {
        if #available(iOS 26, *) {
            configuration.label
                .padding(.horizontal, 14)
                .frame(height: GlassStyle.controlHeight)
                .background {
                    Capsule().fill(GlassStyle.disc)
                        .glassEffect(.regular.interactive(), in: .capsule)
                }
        } else {
            LegacyGlass(configuration: configuration, shape: .capsule, reduceMotion: reduceMotion)
                .padding(.horizontal, 14)
                .frame(height: GlassStyle.controlHeight)
        }
    }
}

private struct LegacyGlass: View {
    enum Shape { case circle, capsule }

    let configuration: ButtonStyleConfiguration
    let shape: Shape
    let reduceMotion: Bool

    @State private var scale: CGFloat = 1

    var body: some View {
        configuration.label
            .background {
                let fill = configuration.isPressed ? GlassStyle.discPressed : GlassStyle.disc
                Group {
                    switch shape {
                    case .circle: Circle().fill(fill)
                    case .capsule: Capsule().fill(fill)
                    }
                }
                // A hairline catching the light, which is the cheapest honest
                // imitation of a material edge.
                .overlay {
                    switch shape {
                    case .circle: Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.5)
                    case .capsule: Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 0.5)
                    }
                }
            }
            .scaleEffect(scale)
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed {
                    scale = 0.94           // instantly, so the press is felt
                } else {
                    withAnimation(reduceMotion ? .easeOut(duration: 0.15)
                                               : .spring(response: 0.3, dampingFraction: 0.6)) {
                        scale = 1
                    }
                }
            }
    }
}
