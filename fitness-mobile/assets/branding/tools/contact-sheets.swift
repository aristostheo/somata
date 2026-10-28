// macOS-only review renderer using built-in AppKit. Does not edit brand artwork.
// swift -module-cache-path /private/tmp/somata-brand-swift-cache tools/contact-sheets.swift <branding-directory>
import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else { fatalError("Pass the branding directory") }
let root = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("asset-manifest.json"))) as! [String: Any]
let assets = manifest["outputs"] as! [[String: Any]]
try FileManager.default.createDirectory(at: root.appendingPathComponent("review"), withIntermediateDirectories: true)
func color(_ hex: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 255)/255, green: CGFloat((hex >> 8) & 255)/255, blue: CGFloat(hex & 255)/255, alpha: 1)
}
for group in ["somata", "fitadapt", "navigation", "app"] {
    let rows = assets.filter { ($0["path"] as! String).hasPrefix(group + "/") }
    let width = 1600, height = 112 + ((rows.count + 1)/2)*334
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: width*4, bitsPerPixel: 32)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.current!.imageInterpolation = .high
    func rect(_ x: CGFloat, _ top: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect { NSRect(x: x, y: CGFloat(height)-top-h, width: w, height: h) }
    func fill(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ hex: UInt32) { color(hex).setFill();rect(x,y,w,h).fill() }
    func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ hex: UInt32) {
        (value as NSString).draw(in: rect(x,y,1520,32), withAttributes: [.font: NSFont.systemFont(ofSize:size, weight:.medium), .foregroundColor:color(hex)])
    }
    fill(0,0,CGFloat(width),CGFloat(height),0xE5E4DE)
    text("SOMATA / \(group.uppercased()) / ASSET REVIEW",28,18,24,0x0B0E12)
    text("Source-preserving copies. Not integrated or approved. Left: Charcoal / Right: Bone.",28,56,17,0x38434D)
    for (index, asset) in rows.enumerated() {
        let x = CGFloat(28 + (index%2)*786), y = CGFloat(112 + (index/2)*334)
        let name = asset["path"] as! String
        let image = NSImage(contentsOf:root.appendingPathComponent(name))!
        text(name,x,y,16,0x0B0E12)
        let status = asset["status"] as! String
        text("\(asset["width"]!) × \(asset["height"]!) px · \(status)",x,y+25,14,0x38434D)
        for side in 0...1 {
            let sx=x+CGFloat(side)*374
            fill(sx,y+54,366,244,side==0 ? 0x0B0E12 : 0xF4F3EE)
            let scale=min(342/image.size.width,220/image.size.height)
            let w=image.size.width*scale,h=image.size.height*scale
            image.draw(in:rect(sx+(366-w)/2,y+54+(244-h)/2,w,h), from:.zero, operation:.sourceOver, fraction:1)
        }
    }
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using:.png, properties:[:])!.write(to:root.appendingPathComponent("review/contact-\(group).png"))
    print("Rendered review/contact-\(group).png")
}
