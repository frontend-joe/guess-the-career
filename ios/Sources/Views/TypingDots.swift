import SwiftUI

/// The three dots that travel while somebody is typing.
///
/// A drawn ellipsis rather than a "…" in the string, because the point of the
/// indicator is that something is happening right now — and a full stop that
/// never moves says the opposite. The wave is what every messaging app uses
/// for this, so it needs no explaining.
///
/// Driven by a TimelineView rather than a repeating animation on each dot:
/// the bubble is created and destroyed as people start and stop, and
/// per-dot animations restart from zero every time it reappears, which makes
/// the wave stutter on arrival. A clock does not care when it was asked.
struct TypingDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let count = 3
    private static let period: Double = 1.1
    private static let dot: CGFloat = 3.5

    var body: some View {
        if reduceMotion {
            // Still three dots, just still ones. Reduced motion asks for less
            // movement, not less information.
            HStack(spacing: 3) {
                ForEach(0..<Self.count, id: \.self) { _ in circle(opacity: 0.6, lift: 0) }
            }
        } else {
            TimelineView(.animation) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                HStack(spacing: 3) {
                    ForEach(0..<Self.count, id: \.self) { i in
                        // Each dot a third of a cycle behind the one before it.
                        let phase = (t / Self.period - Double(i) / Double(Self.count))
                            .truncatingRemainder(dividingBy: 1)
                        let wave = max(0, sin(phase * .pi))
                        circle(opacity: 0.35 + 0.55 * wave, lift: -2.5 * wave)
                    }
                }
            }
        }
    }

    private func circle(opacity: Double, lift: CGFloat) -> some View {
        Circle()
            .fill(.white.opacity(opacity))
            .frame(width: Self.dot, height: Self.dot)
            .offset(y: lift)
    }
}
