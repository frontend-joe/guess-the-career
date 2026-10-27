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
