import AppKit
import Foundation
guard CommandLine.arguments.count == 2 else { fatalError("Pass branding/reconciled-1b directory") }
let checkpoint=URL(fileURLWithPath:CommandLine.arguments[1]).standardizedFileURL
let root=checkpoint.deletingLastPathComponent(), out=checkpoint.appendingPathComponent("review")
func col(_ h:UInt32)->NSColor {NSColor(srgbRed:CGFloat((h>>16)&255)/255,green:CGFloat((h>>8)&255)/255,blue:CGFloat(h&255)/255,alpha:1)}
class Board {
 let w:Int;let h:Int;let bitmap:NSBitmapImageRep
 init(_ width:Int,_ height:Int){w=width;h=height;bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:w,pixelsHigh:h,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:w*4,bitsPerPixel:32)!;NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)!;NSGraphicsContext.current!.imageInterpolation = .high;fill(0,0,CGFloat(w),CGFloat(h),0xE5E4DE)}
 func r(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->NSRect {NSRect(x:x,y:CGFloat(self.h)-y-h,width:w,height:h)}
 func fill(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat,_ c:UInt32){col(c).setFill();r(x,y,w,h).fill()}
 func text(_ s:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat=15,_ c:UInt32=0x0B0E12,_ width:CGFloat=1100){(s as NSString).draw(in:r(x,y,width,44),withAttributes:[.font:NSFont.systemFont(ofSize:size,weight:.medium),.foregroundColor:col(c)])}
 func image(_ im:NSImage,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat){NSGraphicsContext.saveGraphicsState();NSBezierPath(rect:r(x,y,w,h)).addClip();im.draw(in:r(x,y,w,h),from:.zero,operation:.sourceOver,fraction:1);NSGraphicsContext.restoreGraphicsState()}
 func asset(_ path:String)->NSImage {NSImage(contentsOf:root.appendingPathComponent(path))!}
 func save(_ name:String)throws{NSGraphicsContext.restoreGraphicsState();try bitmap.representation(using:.png,properties:[:])!.write(to:out.appendingPathComponent(name));print(name)}
 func icon(_ path:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ android:Bool=false,_ proposed:Bool=false,_ circle:Bool=false,_ bg:UInt32=0x0B0E12){NSGraphicsContext.saveGraphicsState();let rect=r(x,y,size,size);let mask=circle ? NSBezierPath(ovalIn:rect) : NSBezierPath(roundedRect:rect,xRadius:size*0.23,yRadius:size*0.23);mask.addClip();col(bg).setFill();rect.fill();let scale:CGFloat=android ? 1.5*(proposed ? 1.11352283:1):1;let side=size*scale;image(asset(path),x-(side-size)/2,y-(side-size)/2,side,side);NSGraphicsContext.restoreGraphicsState()}
}
let prefix="reconciled-1b/"
let pairs=[("somata/horizontal-dark.png","somata/horizontal-s3-dark.png","Somata horizontal · S1 → S3; same lettering"),("somata/stacked-dark.png","somata/stacked-s3-dark.png","Somata stacked · S2 → S3; horizontal-family lettering"),("fitadapt/horizontal-dark.png","fitadapt/horizontal-f3-dark.png","FitAdapt horizontal · F1 → F3; italic → existing upright lettering"),("fitadapt/powered-by-dark.png","fitadapt/powered-by-f3-compact-dark.png","Powered by · F2 → F3; existing phrase + wordmark; tagline omitted")]
func fitted(_ b:Board,_ file:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat){let im=b.asset(file),s=min(w/im.size.width,h/im.size.height);b.image(im,x+(w-im.size.width*s)/2,y+(h-im.size.height*s)/2,im.size.width*s,im.size.height*s)}
let before=Board(1280,1400);before.text("MASTER IDENTITY RECONCILIATION — BEFORE / AFTER",24,20,24);before.text("Original assets unchanged. New artwork is composed from approved S3/F3 and extracted original lettering.",24,61,14)
for(i,p) in pairs.enumerated(){let y=CGFloat(112+i*316);before.text(p.2,24,y,17);before.text("BEFORE · "+p.0,24,y+34,12,0x38434D,600);before.text("CANDIDATE · "+p.1,660,y+34,12,0x38434D,595);for j in 0...1{let x=CGFloat(24+j*636);before.fill(x,y+66,600,224,0x0B0E12);fitted(before,j==0 ? p.0:prefix+p.1,x+16,y+76,568,204)}}
try before.save("before-after.png")
let small=Board(1440,2100);small.text("SMALL-SIZE REVIEW — EXACT IMAGE WIDTHS AT 100%",24,20,24);small.text("Not device screenshots. Blank space is retained asset padding; do not zoom to judge final reading size.",24,60,14)
for(i,p) in pairs.enumerated(){for side in 0...1{let y=CGFloat(116+(i*2+side)*240),bg:UInt32=side==0 ? 0x0B0E12:0xF4F3EE,fg:UInt32=side==0 ? 0xF4F3EE:0x0B0E12;let file=p.1.replacingOccurrences(of:"-dark.png",with:side==0 ? "-dark.png":"-light.png");small.fill(16,y,1408,228,bg);small.text(file,30,y+14,12,fg,330);let sizes=i==1 ? [80,120,180]:[160,240,320];let im=small.asset(prefix+file);for(j,size) in sizes.enumerated(){let x=CGFloat(355+j*354),w=CGFloat(size),h=w*im.size.height/im.size.width;small.text("\(size)px wide",x,y+10,12,fg,300);small.image(im,x,y+36,w,h)}}}
try small.save("small-sizes.png")
let a=Board(1280,1160);a.text("ANDROID +11.35% CANDIDATE — MASK COMPARISON",24,18,24);a.text("Files are transparent and unmasked. Only these review renderings apply masks. No redraw or tip removal.",24,58,14)
let old="app/android-adaptive-foreground.png",new=prefix+"app/android-adaptive-foreground-s3-plus11_35.png"
func mask(_ file:String,_ x:CGFloat,_ y:CGFloat,_ side:CGFloat,_ diameter:CGFloat,_ circle:Bool){NSGraphicsContext.saveGraphicsState();let rect=a.r(x,y,side,side);let p=circle ? NSBezierPath(ovalIn:rect):NSBezierPath(roundedRect:rect,xRadius:side*0.23,yRadius:side*0.23);p.addClip();col(0x0B0E12).setFill();rect.fill();let sz=side*108/diameter;a.image(a.asset(file),x-(sz-side)/2,y-(sz-side)/2,sz,sz);NSGraphicsContext.restoreGraphicsState()}
for(i,item) in [(old,"Current · 72dp circle",CGFloat(72),true),(new,"New · 72dp circle",CGFloat(72),true),(new,"New · rounded mask",CGFloat(72),false),(new,"New · 66dp stress circle",CGFloat(66),true)].enumerated(){let x=CGFloat(30+i*312);a.text(item.1,x,109,14,0x0B0E12,300);mask(item.0,x+48,151,192,item.2,item.3)}
a.text("Masks above enlarged for inspection. The 66dp stress circle visibly shaves the tips; it is not the export.",24,374,15)
a.fill(24,428,604,604,0x0B0E12);a.image(a.asset(new),36,440,580,580)
for(d,c) in [(CGFloat(66),UInt32(0xFF6A00)),(CGFloat(72),UInt32(0xF4F3EE))]{let size=580*d/108;let circle=NSBezierPath(ovalIn:a.r(36+(580-size)/2,440+(580-size)/2,size,size));col(c).setStroke();circle.lineWidth=1.5;circle.stroke()}
a.text("Orange: 66dp circle / Bone: 72dp circle",660,439,18,0x0B0E12,580);a.text("Full enlarged source remains visible behind the guides.",660,484,15,0x38434D,580);a.text("72dp test: zero nonzero-alpha pixels outside.",660,534,15,0x38434D,580);a.text("66dp stress test: 393 nonzero-alpha pixels outside;",660,580,15,0x38434D,580);a.text("231 have alpha ≥128. Native motion remains unverified.",660,614,15,0x38434D,580)
a.text("48dp viewport examples · current / new / monochrome",660,685,15,0x0B0E12,580);mask(old,690,747,48,72,true);mask(new,790,747,48,72,true);mask(prefix+"app/android-monochrome-foreground-s3-plus11_35.png",890,747,48,72,true)
a.text("Preferred iOS launcher stays unchanged:",660,846,15,0x0B0E12,580);a.icon("app/launcher-dark-1024.png",690,904,60);a.text("app/launcher-dark-1024.png",776,922,14,0x38434D,450)
a.text("Candidate uses the approved 768px S3 master. Raster rounding gives a 479×458px visible body on a 1024px canvas.",24,1060,16);a.text("Circular and rounded masks here are illustrations; native OEM masks, tinting and motion still require a later build.",24,1102,14)
try a.save("android-masks.png")
