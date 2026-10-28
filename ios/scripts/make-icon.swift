#!/usr/bin/env swift
// Draws the app icon: the Tenable board, narrow at the top and widening as it
// descends, in the game's green on the game's near-black.
//
// Run it from anywhere:  swift ios/scripts/make-icon.swift
//
// It writes the 1024 iOS icon and the five Android launcher densities, so the
// two apps cannot drift apart.
//
// Core Graphics rather than AppKit, for two reasons learned the hard way:
// NSImage.lockFocus uses the display's backing scale, so it quietly wrote
// 2048px on a Retina Mac, and NSGraphicsContext needs an NSApplication that a
// script does not have — it crashed inside AppKit. Apple also requires the
// 1024 to have no alpha at all, which is what noneSkipLast gives.
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let repoRoot = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()   // scripts
    .deletingLastPathComponent()   // ios
    .deletingLastPathComponent()   // repo

// The five rows read as a pyramid at 40px where ten would read as a smudge.
// Fractions of the icon's width, top row first — the board's direction.
let rowWidths: [CGFloat] = [0.22, 0.35, 0.47, 0.60, 0.72]

let background = (r: CGFloat(0.047), g: CGFloat(0.071), b: CGFloat(0.169))  // slate-950
let greenTop = (r: CGFloat(0.290), g: CGFloat(0.871), b: CGFloat(0.502))    // green-400
let greenBottom = (r: CGFloat(0.157), g: CGFloat(0.549), b: CGFloat(0.333)) // green-700-ish

func drawIcon(size: Int) -> CGImage? {
    let s = CGFloat(size)
    guard let ctx = CGContext(
        data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { return nil }

    ctx.setFillColor(red: background.r, green: background.g, blue: background.b, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))

    // The stack is centred with a margin, so the icon survives the circular
    // mask Android applies and iOS's rounded corners.
    let margin = s * 0.14
    let stackHeight = s - margin * 2
    let gap = stackHeight * 0.06
    let rowHeight = (stackHeight - gap * CGFloat(rowWidths.count - 1)) / CGFloat(rowWidths.count)

    for (i, fraction) in rowWidths.enumerated() {
        let width = s * fraction
        // CoreGraphics counts y upward; row 0 is the narrow one at the top.
        let top = margin + CGFloat(i) * (rowHeight + gap)
        let rect = CGRect(x: (s - width) / 2, y: s - top - rowHeight, width: width, height: rowHeight)

        // Shade from green-400 down to green-700 across the stack, the same
        // top-to-bottom direction the board's capsules run.
        let t = CGFloat(i) / CGFloat(rowWidths.count - 1)
        ctx.setFillColor(
            red: greenTop.r + (greenBottom.r - greenTop.r) * t,
            green: greenTop.g + (greenBottom.g - greenTop.g) * t,
            blue: greenTop.b + (greenBottom.b - greenTop.b) * t,
            alpha: 1
        )
        ctx.addPath(CGPath(roundedRect: rect, cornerWidth: rowHeight / 2, cornerHeight: rowHeight / 2, transform: nil))
        ctx.fillPath()
    }

    return ctx.makeImage()
}

func write(_ image: CGImage, to url: URL) {
    try? FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard let dest = CGImageDestinationCreateWithURL(
        url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        print("✗ could not write \(url.path)"); exit(1)
    }
    CGImageDestinationAddImage(dest, image, nil)
    CGImageDestinationFinalize(dest)
    print("  \(url.path.replacingOccurrences(of: repoRoot.path + "/", with: ""))")
}

// Google Play's feature graphic: 1024×500, shown at the top of the store
// listing and in promotional slots.
//
// Nothing important goes near the edges, and no text goes in the middle: Play
// crops this for different surfaces and overlays a play button on some of
// them. The board sits left, the name sits right, and the middle is empty on
// purpose.
func drawFeatureGraphic() -> CGImage? {
    let w = 1024, h = 500
    guard let ctx = CGContext(
        data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { return nil }

    ctx.setFillColor(red: background.r, green: background.g, blue: background.b, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))

    // A soft green wash behind the board, so the graphic has some depth
    // without resorting to the neon glow every app store is full of.
    if let gradient = CGGradient(
        colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [
            CGColor(red: greenTop.r, green: greenTop.g, blue: greenTop.b, alpha: 0.18),
            CGColor(red: background.r, green: background.g, blue: background.b, alpha: 0),
        ] as CFArray,
        locations: [0, 1]
    ) {
        ctx.saveGState()
        ctx.drawRadialGradient(
            gradient,
            startCenter: CGPoint(x: 250, y: 250), startRadius: 0,
            endCenter: CGPoint(x: 250, y: 250), endRadius: 420,
            options: []
        )
        ctx.restoreGState()
    }

    // The board, left, at the same proportions as the icon's.
    let stackHeight = CGFloat(h) * 0.62
    let maxWidth = stackHeight * 0.95
    let gap = stackHeight * 0.06
    let rowHeight = (stackHeight - gap * CGFloat(rowWidths.count - 1)) / CGFloat(rowWidths.count)
    let centreX: CGFloat = 250
    let topY = (CGFloat(h) - stackHeight) / 2

    for (i, fraction) in rowWidths.enumerated() {
        let width = maxWidth * (fraction / rowWidths.last!)
        let top = topY + CGFloat(i) * (rowHeight + gap)
        let rect = CGRect(
            x: centreX - width / 2, y: CGFloat(h) - top - rowHeight,
            width: width, height: rowHeight)
        let t = CGFloat(i) / CGFloat(rowWidths.count - 1)
        ctx.setFillColor(
            red: greenTop.r + (greenBottom.r - greenTop.r) * t,
            green: greenTop.g + (greenBottom.g - greenTop.g) * t,
            blue: greenTop.b + (greenBottom.b - greenTop.b) * t,
            alpha: 1
        )
        ctx.addPath(CGPath(roundedRect: rect, cornerWidth: rowHeight / 2, cornerHeight: rowHeight / 2, transform: nil))
        ctx.fillPath()
    }

    // The name, in the game's own face, so the listing and the board agree.
    let fontURL = repoRoot.appendingPathComponent(
        "android/app/src/main/res/font/russo_one_regular.ttf")
    guard let provider = CGDataProvider(url: fontURL as CFURL),
          let cgFont = CGFont(provider) else {
        print("✗ could not load Russo One from \(fontURL.path)"); exit(1)
    }

    func line(_ text: String, size: CGFloat, white: CGFloat, alpha: CGFloat) -> CTLine {
        let font = CTFontCreateWithGraphicsFont(cgFont, size, nil, nil)
        return CTLineCreateWithAttributedString(NSAttributedString(
            string: text,
            // Core Text's own keys, spelled out. The familiar `.font` and
            // `.foregroundColor` shorthands are declared by AppKit and UIKit,
            // neither of which a command-line script has.
            attributes: [
                NSAttributedString.Key(kCTFontAttributeName as String): font,
                NSAttributedString.Key(kCTForegroundColorAttributeName as String):
                    CGColor(red: white, green: white, blue: white, alpha: alpha),
                // Large display type reads too loose at its natural tracking.
                NSAttributedString.Key(kCTKernAttributeName as String): size * -0.01,
            ]
        ))
    }

    // Shrink to fit rather than trusting a guessed point size. The first
    // version of this ran "with your mates" off the right-hand edge, which is
    // exactly the kind of thing nobody notices until it is on a store page.
    func draw(_ text: String, size: CGFloat, x: CGFloat, y: CGFloat, maxWidth: CGFloat, white: CGFloat, alpha: CGFloat) {
        var points = size
        var drawn = line(text, size: points, white: white, alpha: alpha)
        while CTLineGetTypographicBounds(drawn, nil, nil, nil) > maxWidth, points > 8 {
            points -= 1
            drawn = line(text, size: points, white: white, alpha: alpha)
        }
        ctx.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(drawn, ctx)
    }

    // The right half, held clear of the edge Play is free to crop.
    let textX: CGFloat = 480
    let textWidth = CGFloat(w) - textX - 48

    draw("TENABLE", size: 96, x: textX, y: 268, maxWidth: textWidth, white: 1, alpha: 1)
    draw("Football trivia, with your mates", size: 32, x: textX + 2, y: 206, maxWidth: textWidth, white: 0.72, alpha: 1)

    return ctx.makeImage()
}

print("▸ iOS")
guard let ios = drawIcon(size: 1024) else { exit(1) }
write(ios, to: repoRoot.appendingPathComponent(
    "ios/Sources/Assets.xcassets/AppIcon.appiconset/icon-1024.png"))

// Android launcher icons. mdpi is 48dp; each density steps up from there.
print("▸ Android")
let densities = [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]
for (name, px) in densities {
    guard let image = drawIcon(size: px) else { exit(1) }
    write(image, to: repoRoot.appendingPathComponent(
        "android/app/src/main/res/mipmap-\(name)/ic_launcher.png"))
}

// Google Play store listing graphics. Not app resources — these are uploaded
// to the Play Console by hand, so they live outside the app and are generated
// from the same geometry as the icon rather than drawn in a design tool and
// left to drift.
print("▸ Play Store")
guard let play = drawIcon(size: 512) else { exit(1) }
write(play, to: repoRoot.appendingPathComponent("store/play/icon-512.png"))

guard let feature = drawFeatureGraphic() else { exit(1) }
write(feature, to: repoRoot.appendingPathComponent("store/play/feature-graphic-1024x500.png"))
