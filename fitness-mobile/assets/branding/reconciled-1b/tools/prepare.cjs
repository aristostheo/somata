// Checkpoint 1B: deterministic composition from approved pixels; no generation/tracing.
// Outputs are confined to reconciled-1b/. Never writes an earlier asset.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'..'),root=path.resolve(out,'..'),repo=path.resolve(root,'../../..');
const {PNG}=require(path.join(repo,'node_modules/.pnpm/pngjs@5.0.0/node_modules/pngjs'));
const before=JSON.parse(fs.readFileSync(path.join(out,'preserved-files.json'))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function preserve(){for(const f of before)assert.equal(hash(fs.readFileSync(path.join(repo,f.path))),f.sha256,f.path);}
preserve();
const read=f=>PNG.sync.read(fs.readFileSync(path.join(root,f)));
const blank=(w,h)=>({width:w,height:h,data:Buffer.alloc(w*h*4)});
function bounds(p,t=128){let b=[p.width,p.height,-1,-1];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>=t)b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];return{x:b[0],y:b[1],width:b[2]-b[0]+1,height:b[3]-b[1]+1};}
function crop(p,[x,y,w,h],omit=()=>false){const q=blank(w,h);for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=((yy+y)*p.width+xx+x)*4,j=(yy*w+xx)*4;if(!omit(xx+x,yy+y)){p.data.copy(q.data,j,i,i+4);assert.equal(q.data.readUInt32BE(j),p.data.readUInt32BE(i));}}return q;}
function copy(q,p,x,y){assert(x>=0&&y>=0&&x+p.width<=q.width&&y+p.height<=q.height);for(let r=0;r<p.height;r++)p.data.copy(q.data,((y+r)*q.width+x)*4,r*p.width*4,(r+1)*p.width*4);return q;}
// Area sampling with premultiplied alpha. All artwork is either copied or downsampled.
function affine(p,w,h,s,ox,oy){assert(s<=1);const q=blank(w,h),area=1/(s*s);for(let y=Math.max(0,Math.floor(oy));y<Math.min(h,Math.ceil(oy+p.height*s));y++)for(let x=Math.max(0,Math.floor(ox));x<Math.min(w,Math.ceil(ox+p.width*s));x++){
 const l=(x-ox)/s,r=(x+1-ox)/s,t=(y-oy)/s,b=(y+1-oy)/s;let a=0,c=[0,0,0];
 for(let yy=Math.max(0,Math.floor(t));yy<Math.min(p.height,Math.ceil(b));yy++)for(let xx=Math.max(0,Math.floor(l));xx<Math.min(p.width,Math.ceil(r));xx++){
 const weight=(Math.min(r,xx+1)-Math.max(l,xx))*(Math.min(b,yy+1)-Math.max(t,yy)),i=(yy*p.width+xx)*4,alpha=p.data[i+3]*weight;a+=alpha;for(let k=0;k<3;k++)c[k]+=p.data[i+k]*alpha;}
 if(a){const i=(y*w+x)*4;for(let k=0;k<3;k++)q.data[i+k]=Math.round(c[k]/a);q.data[i+3]=Math.round(a/area);}}
 return q;}
const down=(p,s)=>affine(p,Math.ceil(p.width*s),Math.ceil(p.height*s),s,0,0);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function mono(p,h){const q={...p,data:Buffer.from(p.data)},c=rgb(h);for(let i=0;i<q.data.length;i+=4)for(let k=0;k<3;k++)q.data[i+k]=c[k];return q;}
function light(p){const q={...p,data:Buffer.from(p.data)};for(let i=0;i<q.data.length;i+=4){const c=[...p.data.subarray(i,i+3)];if(Math.min(...c)>=128&&Math.max(...c)-Math.min(...c)<=32)for(let k=0;k<3;k++)q.data[i+k]=[11,14,18][k];}return q;}
function sameAlpha(p,q){assert.equal(p.data.length,q.data.length);for(let i=3;i<p.data.length;i+=4)assert.equal(p.data[i],q.data[i]);}
const s3=read('somata/symbol-color.png'),f3=read('fitadapt/symbol-color.png');
const master={somata:{file:'somata/symbol-color.png',sha256:hash(fs.readFileSync(path.join(root,'somata/symbol-color.png')))},fitadapt:{file:'fitadapt/symbol-color.png',sha256:hash(fs.readFileSync(path.join(root,'fitadapt/symbol-color.png')))}};
assert.equal(master.somata.sha256,'3be74bd514c7450fc59adb1fa004ac42940d060103c39acb02b08dbfd6f4afb8');
assert.equal(master.fitadapt.sha256,'b7e792f6c40810f695f24d5b03eebb5381299ff2605b9c0780f247ead5955a56');
for(const [tone,hex] of [['bone','#F4F3EE'],['charcoal','#0B0E12']]){
 const old=read(`somata/symbol-mono-${tone}.png`);sameAlpha(old,s3);assert.deepEqual(old.data,mono(s3,hex).data);
}
const outputs=[];
function save(file,p,sources,edits,role){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});const bytes=PNG.sync.write(p,{colorType:6,deflateLevel:9,filterType:-1});fs.writeFileSync(dest,bytes);assert.deepEqual(PNG.sync.read(bytes).data,p.data);outputs.push({file,sources,edits,role,width:p.width,height:p.height,body:bounds(p),bytes:bytes.length,sha256:hash(bytes)});}
const sw=crop(read('source/somata/horizontal.png'),[660,170,1440,430]);
const fw=crop(read('source/fitadapt/powered-by.png'),[765,280,1235,320]);
const fwCompact=crop(read('source/fitadapt/powered-by.png'),[765,280,1235,320],(x,y)=>y>=540&&x<1698);
const powered=crop(read('source/fitadapt/powered-by.png'),[765,150,610,125]);
save('extracted/somata-wordmark-tagline.png',sw,['source/somata/horizontal.png'],'Exact RGBA rectangular crop x660 y170 w1440 h430. No retyping, thresholding, or color changes.','Reusable lettering extraction; not a complete logo.');
save('extracted/fitadapt-wordmark-tagline.png',fw,['source/fitadapt/powered-by.png'],'Exact RGBA rectangular crop x765 y280 w1235 h320. Includes upright wordmark, p descender and original tagline.','Reusable lettering extraction; not a complete logo.');
save('extracted/fitadapt-wordmark-no-tagline.png',fwCompact,['source/fitadapt/powered-by.png'],'Same crop, omit source region x<1698 AND y>=540 to separate the tagline. The p descender at x1706..1757 remains intact. No new lettering.','Compact candidate lettering; explicit tagline omission requires approval.');
save('extracted/powered-by.png',powered,['source/fitadapt/powered-by.png'],'Exact RGBA rectangular crop x765 y150 w610 h125. Retains original Powered by typography.','Existing phrase extraction.');
const recipes=[];
function logo(brand,layout,symbol,layers,w,h,wordSources){
 const family=`${brand}/${layout}`;const made={};
 for(const mode of ['dark','light']){
  const q=blank(w,h);for(const l of layers){const p=l.master?symbol:(mode==='light'?light(l.image):l.image);copy(q,p,l.x,l.y);if(l.master&&p.width===768){assert.deepEqual(crop(q,[l.x,l.y,768,768]).data,symbol.data);}}
  const file=family+'-'+mode+'.png';save(file,q,[master[brand].file,...wordSources],'Place exact approved master pixels at documented coordinates; downsample only where recipe specifies. Lettering is extracted, never retyped. '+(mode==='light'?'Recolor neutral lettering to #0B0E12; symbol RGB untouched.':'Original lettering colors retained.'),'Reconciled lockup candidate; composition/type choices await approval.');made[mode]=q;
 }
 sameAlpha(made.dark,made.light);
 for(const [tone,hex]of[['bone','#F4F3EE'],['charcoal','#0B0E12']]){const p=mono(made.dark,hex);sameAlpha(p,made.dark);save(family+'-mono-'+tone+'.png',p,[family+'-dark.png'],`Set RGB ${hex}, preserve all alpha. Internal gradient shading intentionally collapses.`,'Monochrome reconciled lockup candidate.');}
 recipes.push({brand,layout,width:w,height:h,layers:layers.map(l=>({x:l.x,y:l.y,width:l.master?symbol.width:l.image.width,height:l.master?symbol.height:l.image.height,kind:l.kind,source:l.source,scale:l.scale??1}))});
}
logo('somata','horizontal-s3',s3,[{master:true,x:32,y:32,kind:'approved master',source:master.somata.file},{image:sw,x:832,y:201,kind:'lettering',source:'extracted/somata-wordmark-tagline.png'}],2304,832,['extracted/somata-wordmark-tagline.png']);
logo('somata','stacked-s3',s3,[{master:true,x:192,y:24,kind:'approved master',source:master.somata.file},{image:down(sw,.75),x:36,y:800,scale:.75,kind:'lettering',source:'extracted/somata-wordmark-tagline.png'}],1152,1160,['extracted/somata-wordmark-tagline.png']);
logo('fitadapt','horizontal-f3',f3,[{master:true,x:32,y:32,kind:'approved master',source:master.fitadapt.file},{image:fw,x:832,y:256,kind:'lettering',source:'extracted/fitadapt-wordmark-tagline.png'}],2099,832,['extracted/fitadapt-wordmark-tagline.png']);
// Compact symbol is a proportional downsample of the approved F3, not an extracted F1/F2.
const compactSymbol=down(f3,.5);
logo('fitadapt','powered-by-f3-compact',compactSymbol,[{master:true,x:16,y:16,kind:'approved master downsample',source:master.fitadapt.file,scale:.5},{image:down(powered,.5),x:416,y:76,kind:'phrase',source:'extracted/powered-by.png',scale:.5},{image:down(fwCompact,.5),x:416,y:151,kind:'lettering',source:'extracted/fitadapt-wordmark-no-tagline.png',scale:.5}],1050,416,['extracted/powered-by.png','extracted/fitadapt-wordmark-no-tagline.png']);
for(const [tone,hex]of[['bone','#F4F3EE'],['charcoal','#0B0E12']]){const p=mono(f3,hex);sameAlpha(p,f3);save(`fitadapt/symbol-f3-mono-${tone}.png`,p,[master.fitadapt.file],`Set RGB ${hex}; all 768x768 source alpha values unchanged.`,'Standalone F3 monochrome candidate.');}
const current=read('app/android-adaptive-foreground.png'),oldBody=bounds(current),body=bounds(s3);
const scale=(oldBody.width*1.1135)/body.width,cx=body.x+body.width/2,cy=body.y+body.height/2,ox=512-cx*scale,oy=512-cy*scale;
const adaptive=affine(s3,1024,1024,scale,ox,oy),monoAdaptive=mono(adaptive,'#FFFFFF');sameAlpha(adaptive,monoAdaptive);
save('app/android-adaptive-foreground-s3-plus11_35.png',adaptive,[master.somata.file,'app/android-adaptive-foreground.png'],`Approved S3 uniformly resampled at scale ${scale}, origin (${ox},${oy}); centered body. Target width ${oldBody.width*1.1135}px = old width *1.1135. Full source retained on canvas; no tip removal.`,'Separate enlarged Android candidate; masks/motion need approval.');
save('app/android-monochrome-foreground-s3-plus11_35.png',monoAdaptive,['app/android-adaptive-foreground-s3-plus11_35.png'],'Same alpha, RGB white. No shape changes.','Matching enlarged Android themed mask candidate.');
const maskStats={};for(const diameter of [66,72]){let nonzero=0,bodyPixels=0,maxAlpha=0;for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const a=adaptive.data[(y*1024+x)*4+3];if(a&&Math.hypot(x+.5-512,y+.5-512)>diameter/2/108*1024){nonzero++;if(a>=128)bodyPixels++;maxAlpha=Math.max(maxAlpha,a);}}maskStats['circle'+diameter+'dp']={nonzeroPixelsOutside:nonzero,alpha128PixelsOutside:bodyPixels,maxAlphaOutside:maxAlpha};}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({checkpoint:'1B',status:'Masters approved; new lockup compositions, monochrome F3 and Android enlargement candidates await approval.',masters:master,approvedSomataMonochromeValidation:'PASS: exact alpha and RGB-mask derivation for Bone and Charcoal variants.',sourceColorInterpretation:'sRGB assumed as in 1; no source profile invented.',recipes,android:{currentBody:oldBody,proposedBody:bounds(adaptive),scale,origin:[ox,oy],nominalIncreasePercent:11.35,maskStats},outputs},null,2)+'\n');
preserve();console.log(`PASS: ${before.length} previous files unchanged; ${outputs.length} new PNGs; approved master hashes, native symbol copy identity, extracts, monochrome alpha, dark/light alpha and PNG round trips verified.`);
