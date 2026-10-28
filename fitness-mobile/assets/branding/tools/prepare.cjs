// Deterministic raster preparation. No tracing, drawing, background removal, or AI.
// Run from any directory: node fitness-mobile/assets/branding/tools/prepare.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '../../..');
// Reuse the already-installed transitive PNG codec; install nothing.
const modules = path.join(repo, 'node_modules/.pnpm');
const codec = fs.readdirSync(modules).sort().find(n => n.startsWith('pngjs@'));
if (!codec) throw new Error('Existing pngjs dependency unavailable; restore the repo dependencies first.');
const { PNG } = require(path.join(modules, codec, 'node_modules/pngjs'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'source-checksums.json')));
function verifySources() {
  for (const entry of baseline) assert.equal(hash(fs.readFileSync(path.join(repo, entry.path))), entry.sha256, `Source changed: ${entry.path}`);
}
verifySources();
const colors = {charcoal:'#0B0E12',graphite:'#1A1F26',slate:'#38434D',bone:'#F4F3EE',somataOrange:'#FF6A00',coralRed:'#FF5A2A',energyYellow:'#FFC629'};
const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
function bounds(p, threshold = 1) {
  let x0=p.width,y0=p.height,x1=-1,y1=-1;
  for(let y=0;y<p.height;y++) for(let x=0;x<p.width;x++) if(p.data[(y*p.width+x)*4+3]>=threshold) {
    x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
  }
  return {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
}
function stats(p) {
  let transparent=0,partial=0,opaque=0,edge=0;
  for(let y=0;y<p.height;y++) for(let x=0;x<p.width;x++) {
    const a=p.data[(y*p.width+x)*4+3];
    if(!a)transparent++; else if(a===255)opaque++; else partial++;
    if(a&&(x===0||y===0||x===p.width-1||y===p.height-1))edge++;
  }
  return {width:p.width,height:p.height,transparentPixels:transparent,partialAlphaPixels:partial,opaquePixels:opaque,nonzeroAlphaEdgePixels:edge,allAlphaBounds:bounds(p),bodyBoundsAlpha128:bounds(p,128)};
}
function chunks(buf) {
  const names=[];for(let i=8;i<buf.length;){const len=buf.readUInt32BE(i),name=buf.toString('ascii',i+4,i+8);if(!names.includes(name))names.push(name);i+=len+12;}return names;
}
const sources=baseline.filter(e=>e.path.endsWith('.png')).map(e=>{
  const buf=fs.readFileSync(path.join(repo,e.path)),p=PNG.sync.read(buf);
  return {...e,path:e.path.replace('fitness-mobile/assets/branding/',''),...stats(p),pngChunks:chunks(buf)};
});
const read = relative => PNG.sync.read(fs.readFileSync(path.join(root,'source',relative)));
function blank(w,h){return {width:w,height:h,data:Buffer.alloc(w*h*4)};}
function crop(p,b){const q=blank(b.width,b.height);for(let y=0;y<b.height;y++)p.data.copy(q.data,y*b.width*4,((y+b.y)*p.width+b.x)*4,((y+b.y)*p.width+b.x+b.width)*4);return q;}
function pad(p,n){const q=blank(p.width+2*n,p.height+2*n);for(let y=0;y<p.height;y++)p.data.copy(q.data,((y+n)*q.width+n)*4,y*p.width*4,(y+1)*p.width*4);return q;}
// Box integration in premultiplied alpha: transparent pixels cannot add dark fringes.
// All outputs are downsampled, never enlarged. No alpha thresholding is applied.
function resize(p,w,h){
  assert(w<=p.width&&h<=p.height,'Upscaling is prohibited');const q=blank(w,h),sx=p.width/w,sy=p.height/h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const left=x*sx,right=(x+1)*sx,top=y*sy,bottom=(y+1)*sy;
    let a=0,r=0,g=0,b=0;
    for(let iy=Math.floor(top);iy<Math.ceil(bottom);iy++)for(let ix=Math.floor(left);ix<Math.ceil(right);ix++){
      const area=(Math.min(right,ix+1)-Math.max(left,ix))*(Math.min(bottom,iy+1)-Math.max(top,iy));
      if(area<=0||ix>=p.width||iy>=p.height)continue;
      const i=(iy*p.width+ix)*4,weight=area*p.data[i+3];a+=weight;r+=p.data[i]*weight;g+=p.data[i+1]*weight;b+=p.data[i+2]*weight;
    }
    const i=(y*w+x)*4;if(a){q.data[i]=Math.round(r/a);q.data[i+1]=Math.round(g/a);q.data[i+2]=Math.round(b/a);q.data[i+3]=Math.round(a/(sx*sy));}
  }return q;
}
function place(p,size,bodyFraction){
  const body=bounds(p,128),all=bounds(p),cx=body.x+body.width/2,cy=body.y+body.height/2;
  const extent=Math.max(cx-all.x,all.x+all.width-cx,cy-all.y,all.y+all.height-cy);
  const scale=Math.min(1,size*bodyFraction/Math.max(body.width,body.height),(size/2-4)/extent);
  const cut=crop(p,all),w=Math.max(1,Math.floor(cut.width*scale)),h=Math.max(1,Math.floor(cut.height*scale));
  const resized=resize(cut,w,h),q=blank(size,size);
  const ox=Math.round(size/2-(cx-all.x)*w/cut.width),oy=Math.round(size/2-(cy-all.y)*h/cut.height);
  assert(ox>=0&&oy>=0&&ox+w<=size&&oy+h<=size,'Clipping');
  for(let y=0;y<h;y++)resized.data.copy(q.data,((oy+y)*size+ox)*4,y*w*4,(y+1)*w*4);
  return q;
}
function mono(p,hex){const q={...p,data:Buffer.from(p.data)},c=rgb(hex);for(let i=0;i<q.data.length;i+=4){q.data[i]=c[0];q.data[i+1]=c[1];q.data[i+2]=c[2];}return q;}
function lightLettering(p){
  const q={...p,data:Buffer.from(p.data)},c=rgb(colors.charcoal);let changed=0;
  for(let i=0;i<p.data.length;i+=4){
    const values=[p.data[i],p.data[i+1],p.data[i+2]];
    // The source separates white lettering from saturated orange/red artwork.
    // Only neutral light pixels are recolored; alpha and all colored pixels stay exact.
    if(p.data[i+3]&&Math.min(...values)>=128&&Math.max(...values)-Math.min(...values)<=32){
      for(let k=0;k<3;k++)q.data[i+k]=c[k];changed++;
    }else for(let k=0;k<3;k++)assert.equal(q.data[i+k],p.data[i+k]);
    assert.equal(q.data[i+3],p.data[i+3]);
  }
  assert(changed>0,'No white lettering identified');return {image:q,changed};
}
function flatten(p,hex){const q={...p,data:Buffer.from(p.data)},c=rgb(hex);for(let i=0;i<q.data.length;i+=4){let a=q.data[i+3]/255;for(let k=0;k<3;k++)q.data[i+k]=Math.round(q.data[i+k]*a+c[k]*(1-a));q.data[i+3]=255;}return q;}
const outputs=[];
function save(file,p,source,edits,usage,status='review-required',opaque=false){
  fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
  // PNG RGB for opaque launcher candidates: no alpha channel. RGBA otherwise.
  const bytes=PNG.sync.write(p,{colorType:opaque?2:6,inputColorType:6,inputHasAlpha:true,deflateLevel:9,filterType:-1});
  fs.writeFileSync(path.join(root,file),bytes);
  const check=PNG.sync.read(bytes);assert.deepEqual(check.data,p.data,'PNG round-trip');
  if(opaque)assert.equal(stats(check).transparentPixels+stats(check).partialAlphaPixels,0);
  else assert(stats(check).transparentPixels>0,'Expected transparent background');
  outputs.push({path:file,source:'source/'+source,edits,usage,status,...stats(check),bytes:bytes.length,sha256:hash(bytes),pngColorType:bytes[25]});
}
for(const [brand,names] of [['somata',['horizontal','stacked']],['fitadapt',['horizontal','powered-by']]])for(const name of names){
  const source=`${brand}/${name}.png`,p=read(source),b=bounds(p),cut=crop(p,b);
  const maxWidth=name==='powered-by'?960:1600,scale=Math.min(1,(maxWidth-32)/cut.width);
  const prepare=im=>pad(resize(crop(im,b),Math.floor(cut.width*scale),Math.floor(cut.height*scale)),16);
  const q=prepare(p),edits=`Crop fully transparent outer padding to ${JSON.stringify(b)}; proportional area downsample; add 16px transparent margin; source RGB/alpha retained; metadata omitted. No edge repairs.`;
  const usage=name==='powered-by'?'Existing attribution lockup; retain original tagline. Not suitable for tiny inline attribution without an approved simpler master.':`${name} brand lockup; no lettering, slogan or mark geometry redrawn.`;
  save(`${brand}/${name}-dark.png`,q,source,edits,usage+' Original white lettering for dark backgrounds.');
  const light=lightLettering(p);
  save(`${brand}/${name}-light.png`,prepare(light.image),source,edits+` Before resize, recolor ${light.changed} neutral white pixels (min RGB>=128, max-min<=32) to Charcoal ${colors.charcoal}; original alpha and every other RGB pixel unchanged.`,usage+' Charcoal lettering for light backgrounds; review small-size contrast.');
  if(brand==='somata')for(const [tone,hex] of [['bone',colors.bone],['charcoal',colors.charcoal]]){
    const m=mono(q,hex);for(let i=3;i<m.data.length;i+=4)assert.equal(m.data[i],q.data[i]);
    save(`${brand}/${name}-mono-${tone}.png`,m,source,edits+` Then set RGB to ${hex}; alpha unchanged. Gradient shading intentionally collapsed.`,`${name} monochrome lockup; Bone for dark, Charcoal for light backgrounds.`);
  }
}
for(const brand of ['somata','fitadapt']){
  const source=`${brand}/symbol.png`,q=place(read(source),768,.80);
  save(`${brand}/symbol-color.png`,q,source,'Center alpha>=128 body; retain all source pixels; proportional downsample onto transparent 768 square. Same color asset for light and dark surfaces.','Standalone mark on light/dark surfaces; review shape consistency with the separate lockup sources.');
  if(brand==='somata')for(const [name,hex] of [['bone',colors.bone],['charcoal',colors.charcoal]]){
    const m=mono(q,hex);for(let i=3;i<m.data.length;i+=4)assert.equal(m.data[i],q.data[i]);
    save(`${brand}/symbol-mono-${name}.png`,m,source,`Same prepared silhouette; set RGB to ${hex}, alpha unchanged. Internal gradient folds intentionally collapse in monochrome.`,'Single-color symbol: Bone on dark, Charcoal on light. Silhouette approval required.');
  }
}
for(const name of ['home','nutrition','training','progress','recovery','community','scan','profile']){
  save(`navigation/${name}.png`,place(read(`navigation/${name}.png`),192,.75),`navigation/${name}.png`,'192 square; center alpha>=128 body; body maximum 144px, reduced only if necessary to keep every nonzero source pixel inside 4px margin. Premultiplied-alpha area downsample. No stroke or color editing.','Existing matching feature icon only; no tab additions. Raster supports up to 64pt at 3x; inspect at 24/32pt.');
}
const symbol=read('somata/symbol.png'),launcher=place(symbol,1024,.72);
for(const name of ['dark','light'])save(`app/launcher-${name}-1024.png`,flatten(launcher,name==='dark'?colors.charcoal:colors.bone),'somata/symbol.png',`Existing S centered at 72% body size, entire source retained; composite onto ${name==='dark'?colors.charcoal:colors.bone}; encode opaque RGB PNG, no rounded corners.`,'Candidate default/legacy launcher or iOS light/dark PNG; platform-required opaque background, not a new logo background.','review-required',true);
save('app/splash-symbol.png',place(symbol,1024,.72),'somata/symbol.png','Same 72% centered S on transparent 1024 square; no background or wordmark added.','expo-splash-screen image; background configured separately in a later checkpoint.');
// Entire source alpha fits inside the central 66/108 safe circle, with margin.
const b=bounds(symbol),body=bounds(symbol,128),cx=body.x+body.width/2,cy=body.y+body.height/2;
let radius=0;for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(symbol.data[(y*symbol.width+x)*4+3])radius=Math.max(radius,Math.hypot(x+.5-cx,y+.5-cy));
const fraction=(1024*33/108-4)/radius*Math.max(body.width,body.height)/1024;
const adaptive=place(symbol,1024,fraction);
for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)if(adaptive.data[(y*1024+x)*4+3])assert(Math.hypot(x+.5-512,y+.5-512)<1024*33/108,'Adaptive safe-circle clipping');
save('app/android-adaptive-foreground.png',adaptive,'somata/symbol.png','Transparent 1024 square; all nonzero alpha fitted inside central 66/108 diameter safe circle with 4px rounding margin. No background.','Android adaptive foreground; eventual background Charcoal or Bone set separately.');
save('app/android-monochrome-foreground.png',mono(adaptive,'#FFFFFF'),'somata/symbol.png','Same adaptive foreground alpha; RGB white; no gradient/fold shading.','Android 13+ themed icon mask; OS supplies color.');
save('app/ios-tinted-candidate-1024.png',flatten(mono(launcher,'#FFFFFF'),'#000000'),'somata/symbol.png','Launcher silhouette RGB white over opaque black, alpha composited; internal shading omitted.','Optional iOS tinted PNG candidate; native appearance review required.','review-required',true);
fs.writeFileSync(path.join(root,'brand-tokens.json'),JSON.stringify({status:'Reference only; not imported by app theme',colorSpace:'sRGB',colors},null,2)+'\n');
fs.writeFileSync(path.join(root,'asset-manifest.json'),JSON.stringify({schemaVersion:1,expoVersion:require(path.join(repo,'fitness-mobile/node_modules/expo/package.json')).version,status:'Asset preparation only; pending visual approval. Source shape variations and tiny attribution remain review items.',codec,processing:'Deterministic raster operations; source colors and alpha preserved except explicitly labeled neutral-lettering recolor, monochrome and launcher composites. Source PNGs have no color profile; interpreted as sRGB. No vector output.',sources,outputs},null,2)+'\n');
verifySources();
console.log(`PASS: ${baseline.length} source files unchanged; ${sources.length} PNGs inspected; ${outputs.length} PNG copies validated; transparent PNGs, opaque launchers, lossless encoding, monochrome alpha and adaptive safe-circle checks passed.`);
