const bt="phonon-tts-v1";async function yt(){if(typeof caches>"u")return null;try{return await caches.open(bt)}catch{return null}}async function _t(n,{cache:e=!0,write:t=!0,onProgress:r}={}){const o=e?await yt():null;if(o){const l=await o.match(n).catch(()=>{});if(l){const f=new Uint8Array(await l.arrayBuffer());return r?.({loaded:f.length,total:f.length,cached:!0}),f}}const i=await fetch(n);if(!i.ok)throw new Error(`failed to fetch ${n}: HTTP ${i.status}`);const s=o&&t?o.put(n,i.clone()).catch(l=>{console.warn(`[phonon-tts] could not cache ${n}: ${l}`)}):null,a=Number(i.headers.get("content-length")),u=Number.isFinite(a)&&a>0?a:null,c=await kt(i,u,l=>r?.({loaded:l,total:u,cached:!1}));return await s,c}async function kt(n,e,t){if(!n.body)return new Uint8Array(await n.arrayBuffer());const r=n.body.getReader();let o=new Uint8Array(e??1<<20),i=0;for(;;){const{done:s,value:a}=await r.read();if(s)break;if(i+a.length>o.length){const u=new Uint8Array(Math.max(o.length*2,i+a.length));u.set(o.subarray(0,i)),o=u}o.set(a,i),i+=a.length,t(i)}return i===o.length?o:o.slice(0,i)}function xt({requested:n,quant:e,hasWebGpu:t,fallbackAdapter:r=!1}){return n===void 0?{device:"cpu",reason:"default"}:n==="cpu"?{device:"cpu",reason:"requested"}:n==="webgpu"?{device:"webgpu",reason:"requested"}:e!=="q8"?{device:"cpu",reason:"WebGPU needs q8 weights"}:t?r?{device:"cpu",reason:"the browser's WebGPU adapter is a software fallback"}:{device:"webgpu",reason:"'auto', and the browser has a WebGPU adapter"}:{device:"cpu",reason:"this browser offers no WebGPU adapter"}}function St({requested:n,choice:e,unsupported:t}){return e.device!=="webgpu"||t===null?e:n==="webgpu"?{error:t}:{device:"cpu",reason:t,warning:`${t}; generating on the CPU instead`}}function At(n){return n.length>=4&&n[0]===71&&n[1]===71&&n[2]===85&&n[3]===70}const Mt=3;function Pt({requested:n="auto",isolated:e,hardwareConcurrency:t}){return n===1?{threads:1,reason:"requested"}:e?t>1?n!=="auto"?{threads:Math.min(n,t),reason:"requested"}:{threads:Math.min(Mt,t),reason:"default"}:{threads:1,reason:"the browser reports one core or none"}:{threads:1,reason:"the page is not cross-origin isolated"}}const qt=new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,61,1,59,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,133,2,11]);function Et(){try{return WebAssembly.validate(qt)}catch{return!1}}const N={F32:0,F16:1,Q8_0:8,BF16:30},Tt={[N.F32]:4,[N.F16]:2,[N.BF16]:2};function Ke(n){const e=new DataView(n.buffer,n.byteOffset,n.byteLength);let t=0;const r=()=>{const d=e.getUint32(t,!0);return t+=4,d},o=()=>{const d=Number(e.getBigUint64(t,!0));return t+=8,d},i=()=>{const d=o(),w=new TextDecoder().decode(n.subarray(t,t+d));return t+=d,w};if(n.length<8||r()!==1179993927)throw new Error("the weights are not a GGUF file");const s=r();if(s<2)throw new Error(`GGUF version ${s} is not supported`);const a=o(),u=o(),c={0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8},l=d=>{if(d===8)return i();if(d===9){const b=r(),y=o();for(let A=0;A<y;A++)l(b);return}if(!(d in c))throw new Error(`GGUF metadata type ${d} is not supported`);const w=d===4?e.getUint32(t,!0):void 0;return t+=c[d],w},f={};for(let d=0;d<u;d++){const w=i();f[w]=l(r())}const g=new Map;for(let d=0;d<a;d++){const w=i(),b=r(),y=[];for(let _=0;_<b;_++)y.push(o());const A=r(),q=o();g.set(w,{dims:y,type:A,off:q,n:y.reduce((_,x)=>_*x,1)})}const v=Number(f["general.alignment"]??32);return{tensors:g,dataStart:Math.ceil(t/v)*v,buf:n}}function H(n,e){const t=n.tensors.get(e);if(!t)throw new Error(`the checkpoint has no tensor ${e}`);const r=t.type===N.Q8_0?t.n/32*34:Tt[t.type]*t.n;if(!r)throw new Error(`tensor ${e} has unsupported type ${t.type}`);const o=n.dataStart+t.off;return n.buf.subarray(o,o+r)}function Ut(n,e,t=[]){const r=[...n.tensors.keys()].filter(g=>e.some(v=>g.startsWith(v))&&!t.some(v=>g.startsWith(v))),o={[N.F32]:"F32",[N.F16]:"F16",[N.BF16]:"BF16"},i={},s=[];let a=0;for(const g of r){const v=n.tensors.get(g);if(!o[v.type])throw new Error(`tensor ${g} has type ${v.type}, expected f32, f16 or bf16`);const d=H(n,g);i[g]={dtype:o[v.type],shape:[...v.dims].reverse(),data_offsets:[a,a+d.length]},s.push(d),a+=d.length}let u=new TextEncoder().encode(JSON.stringify(i));const c=(8-u.length%8)%8;c&&(u=new TextEncoder().encode(JSON.stringify(i)+" ".repeat(c)));const l=new Uint8Array(8+u.length+a);new DataView(l.buffer).setBigUint64(0,BigInt(u.length),!0),l.set(u,8);let f=8+u.length;for(const g of s)l.set(g,f),f+=g.length;return l}const De=new Float32Array(1),Bt=new Uint32Array(De.buffer);function ve(n){De[0]=n;const e=Bt[0],t=e>>>16&32768,r=e>>>23&255;let o=e&8388607;if(r===255)return t|31744|(o?512:0);const i=r-127+15;return i>=31?t|31744:i<=0?i<-10?t:(o=(o|8388608)>>>1-i,t|o+4095+(o>>>13&1)>>>13):t|(i<<10)+(o+4095+(o>>>13&1)>>>13)}function We(n){const e=n&32768?-1:1,t=n>>10&31,r=n&1023;return t===0?e*r*2**-24:t===31?r?NaN:e*(1/0):e*(1+r/1024)*2**(t-15)}function L(n,e){const t=n.tensors.get(e);if(!t)throw new Error(`the checkpoint has no tensor ${e}`);const r=H(n,e),o=t.n,i=r.byteOffset%4===0;if(t.type===N.F32)return i?new Float32Array(r.buffer,r.byteOffset,o).slice():new Float32Array(r.slice().buffer);if(t.type===N.BF16){const s=i?new Uint16Array(r.buffer,r.byteOffset,o):new Uint16Array(r.slice().buffer),a=new Uint32Array(o);for(let u=0;u<o;u++)a[u]=s[u]<<16;return new Float32Array(a.buffer)}if(t.type===N.F16){const s=i?new Uint16Array(r.buffer,r.byteOffset,o):new Uint16Array(r.slice().buffer);return Float32Array.from(s,We)}if(t.type===N.Q8_0){const s=new DataView(r.buffer,r.byteOffset,r.byteLength),a=new Float32Array(o);for(let u=0;u<o/32;u++){const c=We(s.getUint16(u*34,!0));for(let l=0;l<32;l++)a[u*32+l]=c*s.getInt8(u*34+2+l)}return a}throw new Error(`tensor ${e} has unsupported type ${t.type}`)}class jt{constructor(){this.parts=[],this.words=0}push(e){this.words%4&&(this.parts.push(new Uint32Array(4-this.words%4)),this.words+=4-this.words%4);const t=this.words;return this.parts.push(e),this.words+=e.length,t}finish(){const e=new Uint32Array(Math.ceil(this.words/4)*4);let t=0;for(const r of this.parts)e.set(r,t),t+=r.length;return this.parts=[],e}f32(e){return this.push(new Uint32Array(new Float32Array(e).buffer))}f16(e){const t=new Uint32Array(Math.ceil(e.length/2));for(let r=0;r<e.length;r+=2)t[r>>1]=(ve(e[r])|(r+1<e.length?ve(e[r+1]):0)<<16)>>>0;return{wo:this.push(t)/4}}q8(e){const t=e.length/34,r=new Uint8Array(t*32),o=new Uint32Array(Math.ceil(t/2));for(let s=0;s<t;s++)o[s>>1]|=(e[s*34]|e[s*34+1]<<8)<<(s&1)*16,r.set(e.subarray(s*34+2,s*34+34),s*32);return{wo:this.push(new Uint32Array(r.buffer))/4,so:this.push(o)}}}const Fe=(...n)=>{const e=new Float32Array(n.reduce((r,o)=>r+o.length,0));let t=0;for(const r of n)e.set(r,t),t+=r.length;return e};function Wt(n,e){const t=(i,s)=>{const a=`flow_lm.flow_net.time_embed.${i}`,u=L(n,`${a}.freqs`),c=L(n,`${a}.mlp.0.weight`),l=L(n,`${a}.mlp.0.bias`),f=L(n,`${a}.mlp.2.weight`),g=L(n,`${a}.mlp.2.bias`),v=L(n,`${a}.mlp.3.alpha`),d=u.length,w=new Float32Array(d*2);for(let _=0;_<d;_++)w[_]=Math.cos(s*u[_]),w[d+_]=Math.sin(s*u[_]);const b=l.length,y=new Float32Array(b);for(let _=0;_<b;_++){let x=l[_];for(let k=0;k<w.length;k++)x+=c[_*w.length+k]*w[k];y[_]=x/(1+Math.exp(-x))}const A=new Float32Array(b);for(let _=0;_<b;_++){let x=g[_];for(let k=0;k<b;k++)x+=f[_*b+k]*y[k];A[_]=x}let q;if(e==="rms")q=Math.sqrt(A.reduce((_,x)=>_+x*x,0)/b+1e-5);else{const _=A.reduce((x,k)=>x+k,0)/b;q=Math.sqrt(A.reduce((x,k)=>x+(k-_)**2,0)/(b-1)+1e-5)}return A.map((_,x)=>_/q*v[x])},r=t(0,0),o=t(1,1);return r.map((i,s)=>(i+o[s])/2)}function Ft(n,e){const t=e.flow_lm,r=new jt,o=d=>L(n,d),i=[];for(let d=0;d<t.num_layers;d++){const w=`flow_lm.transformer.layers.${d}`;i.push({qkv:r.q8(H(n,`${w}.self_attn.in_proj.weight`)),out:r.q8(H(n,`${w}.self_attn.out_proj.weight`)),fc1:r.q8(H(n,`${w}.linear1.weight`)),fc2:r.q8(H(n,`${w}.linear2.weight`)),n1w:r.f32(o(`${w}.norm1.weight`)),n1b:r.f32(o(`${w}.norm1.bias`)),n2w:r.f32(o(`${w}.norm2.weight`)),n2b:r.f32(o(`${w}.norm2.bias`))})}const s="flow_lm.flow_net",a=Wt(n,t.time_rms_norm??"rms_var"),u={cond:{...r.f16(o(`${s}.cond_embed.weight`)),bo:r.f32(o(`${s}.cond_embed.bias`).map((d,w)=>d+a[w]))},inproj:{...r.f16(o(`${s}.input_proj.weight`)),bo:r.f32(o(`${s}.input_proj.bias`))},blocks:[]},c=[],l=[];for(let d=0;d<t.flow_depth;d++){const w=`${s}.res_blocks.${d}`;c.push(o(`${w}.adaLN_modulation.1.weight`)),l.push(o(`${w}.adaLN_modulation.1.bias`)),u.blocks.push({lw:r.f32(o(`${w}.in_ln.weight`)),lb:r.f32(o(`${w}.in_ln.bias`)),fc1:{...r.f16(o(`${w}.mlp.0.weight`)),bo:r.f32(o(`${w}.mlp.0.bias`))},fc2:{...r.f16(o(`${w}.mlp.2.weight`)),bo:r.f32(o(`${w}.mlp.2.bias`))}})}c.push(o(`${s}.final_layer.adaLN_modulation.1.weight`)),l.push(o(`${s}.final_layer.adaLN_modulation.1.bias`)),u.ada={...r.f16(Fe(...c)),bo:r.f32(Fe(...l)),rows:l.reduce((d,w)=>d+w.length,0)},u.final={...r.f16(o(`${s}.final_layer.linear.weight`)),bo:r.f32(o(`${s}.final_layer.linear.bias`))};const f={outNormW:r.f32(o("flow_lm.out_norm.weight")),outNormB:r.f32(o("flow_lm.out_norm.bias")),eosW:r.f32(o("flow_lm.out_eos.weight")),eosB:r.f32(o("flow_lm.out_eos.bias")),inLinear:r.f16(o("flow_lm.input_linear.weight")),cond:r.f32(new Float32Array(t.d_model))},g=Gt(n,r,e),v={bos:o("flow_lm.bos_emb"),inLinear:o("flow_lm.input_linear.weight"),embed:o("flow_lm.condition_provider.conditioners.transcript_in_segment.embed.weight")};return{layers:i,flow:u,top:f,codec:g,host:v,blob:r}}function Gt(n,e,t){const r=t.mimi,o=l=>L(n,l),i=l=>{const f=n.tensors.get(l);if(!f)throw new Error(`the checkpoint has no tensor ${l}`);return f.dims},s=l=>{const[f,g,v]=i(`${l}.weight`),d=o(`${l}.weight`),w=new Float32Array(d.length);for(let b=0;b<v;b++)for(let y=0;y<g;y++)for(let A=0;A<f;A++)w[(b*f+A)*g+y]=d[(b*g+y)*f+A];return{...e.f16(w),bo:e.f32(o(`${l}.bias`))}},a=(l,f)=>{const[g,v,d]=i(`${l}.weight`);if(g!==2*f)throw new Error(`${l}: kernel ${g} is not twice the stride ${f}`);const w=o(`${l}.weight`),b=new Float32Array(f*v*2*d);for(let y=0;y<f;y++)for(let A=0;A<v;A++)for(let q=0;q<d;q++){const _=(y*v+A)*2*d;b[_+q]=w[(q*v+A)*g+y+f],b[_+d+q]=w[(q*v+A)*g+y]}return{...e.f16(b),wph:v*2*d/8,bo:e.f32(o(`${l}.bias`))}},u=[];for(let l=0;l<r.transformer_num_layers;l++){const f=`mimi.decoder_transformer.transformer.layers.${l}`;u.push({qkv:e.f16(o(`${f}.self_attn.in_proj.weight`)),out:e.f16(o(`${f}.self_attn.out_proj.weight`)),fc1:e.f16(o(`${f}.linear1.weight`)),fc2:e.f16(o(`${f}.linear2.weight`)),n1w:e.f32(o(`${f}.norm1.weight`)),n1b:e.f32(o(`${f}.norm1.bias`)),n2w:e.f32(o(`${f}.norm2.weight`)),n2b:e.f32(o(`${f}.norm2.bias`)),ls1:e.f32(o(`${f}.layer_scale_1.scale`)),ls2:e.f32(o(`${f}.layer_scale_2.scale`))})}const c="mimi.decoder.model";return{quant:e.f16(o("mimi.quantizer.output_proj.weight")),up:e.f32(o("mimi.upsample.convtr.convtr.weight")),embStd:e.f32(o("flow_lm.emb_std")),embMean:e.f32(o("flow_lm.emb_mean")),layers:u,seanet:{init:s(`${c}.0.conv`),up:[a(`${c}.2.convtr`,6),a(`${c}.5.convtr`,5),a(`${c}.8.convtr`,4)],res:[3,6,9].map(l=>[s(`${c}.${l}.block.1.conv`),s(`${c}.${l}.block.3.conv`)]),final:s(`${c}.11.conv`)}}}const j={pos:0,frame:1,end:2,stop:3,seed:4,scale:5,after:6,limit:7,cpos:8,rows:9},fe=16,he=["wo","so","bo","lg","lb","sh","sc","ga","xo","yo","ko","a0","M","ab","arow","wph","yb","rb","lso","p0"],Nt=he.length*4,K=8,de=68,ke=512,zt=`struct Params {
  ${he.map(n=>`${n}: u32,`).join(" ")}
}`,Ot=Object.entries(j).map(([n,e])=>`const ST_${n.toUpperCase()} = ${e}u;`).join(`
`);function B(n,e){const t=n?["enable subgroups;"]:[];return t.push(zt,Ot,'// "No key yet": finite, so that subtracting it never meets an infinity.',"const SENT = -3.0e38;"),e.forEach(([r,o,i],s)=>{o&&t.push(`@group(0) @binding(${s}) var<storage, ${r==="ro"?"read":"read_write"}> ${o}: array<${i}>;`)}),t.push(`@group(0) @binding(${e.length}) var<uniform> p: Params;`),t.join(`
`)}const ee=`
fn bw(i: u32) -> u32 { return W[i >> 2u][i & 3u]; }
fn bf(i: u32) -> f32 { return bitcast<f32>(W[i >> 2u][i & 3u]); }
fn bf4(i: u32) -> vec4<f32> { return bitcast<vec4<f32>>(W[i >> 2u]); }
fn bh(i: u32) -> f32 { return unpack2x16float(W[i >> 3u][(i >> 1u) & 3u])[i & 1u]; }`,Q=`
fn hlo(w: vec4<u32>) -> vec4<f32> { return vec4<f32>(unpack2x16float(w.x), unpack2x16float(w.y)); }
fn hhi(w: vec4<u32>) -> vec4<f32> { return vec4<f32>(unpack2x16float(w.z), unpack2x16float(w.w)); }
fn i8q(w: u32) -> vec4<f32> {
  let i = bitcast<i32>(w);
  return vec4<f32>(vec4<i32>(i << 24u, i << 16u, i << 8u, i) >> vec4<u32>(24u));
}`,Le=`
fn erfnr(z: f32) -> f32 {
  let a = abs(z);
  let t = 1.0 / (1.0 + 0.5 * a);
  let r = t * exp(-a * a - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return select(r - 1.0, 1.0 - r, z >= 0.0);
}
fn gelu(v: f32) -> f32 { return 0.5 * v * (1.0 + erfnr(v * 0.70710678118654752)); }`,Ct=`
fn silu(v: f32) -> f32 { return v / (1.0 + exp(min(-v, 80.0))); }`,Rt=`
fn elu4(v: vec4<f32>) -> vec4<f32> { return select(exp(min(v, vec4<f32>(0.0))) - 1.0, v, v > vec4<f32>(0.0)); }`,Kt=n=>{const e=Math.fround(n).toPrecision(9);return/[.e]/.test(e)?e:`${e}.0`};function xe(n){const e=Number(n);if(!(e>1))throw new Error(`RoPE base ${n} is not a number above 1`);return`
var<private> OMEGA: array<f32, 32> = array<f32, 32>(${Array.from({length:32},(r,o)=>Kt(e**(-o/32))).join(", ")});
fn rot(x: vec2<f32>, a: f32) -> vec2<f32> {
  let k = round(a * 0.15915494309189535);
  let r = fma(-k, -1.7484556e-7, fma(-k, 6.2831854820251465, a));
  let c = cos(r);
  let s = sin(r);
  return vec2<f32>(x.x * c - x.y * s, x.x * s + x.y * c);
}`}function Ie(n,e){return n?"fn gsum(v: f32, lid: u32) -> f32 { return subgroupAdd(v); }":`
var<workgroup> gred: array<f32, ${e}>;
fn gsum(v: f32, lid: u32) -> f32 {
  gred[lid] = v;
  workgroupBarrier();
  let b = lid & ~31u;
  var s = 0.0;
  for (var i = 0u; i < 32u; i++) { s += gred[b + i]; }
  workgroupBarrier();
  return s;
}`}function pe(n,e,t,r){const o=t==="Add"?(s,a)=>`${s} + ${a}`:(s,a)=>`max(${s}, ${a})`,i=e/32;return n?`
var<workgroup> ${r}m: array<f32, ${i}>;
fn ${r}(v: f32, lid: u32) -> f32 {
  let s = subgroup${t}(v);
  if ((lid & 31u) == 0u) { ${r}m[lid >> 5u] = s; }
  workgroupBarrier();
  var r = ${r}m[0];
  for (var i = 1u; i < ${i}u; i++) { r = ${o("r",`${r}m[i]`)}; }
  return r;
}`:`
var<workgroup> ${r}m: array<f32, ${e}>;
fn ${r}(v: f32, lid: u32) -> f32 {
  ${r}m[lid] = v;
  workgroupBarrier();
  for (var s = ${e/2}u; s > 0u; s >>= 1u) {
    if (lid < s) { ${r}m[lid] = ${o(`${r}m[lid]`,`${r}m[lid + s]`)}; }
    workgroupBarrier();
  }
  return ${r}m[0];
}`}const F="@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_index) lid: u32",Se="if (st[ST_STOP] != 0u) { return; }",se="if (st[ST_END] != 0u && st[ST_CPOS] >= st[ST_END]) { return; }",W=["x","y","z","w"];function Ve(n){return n>=4096&&n%8===0?{rw:2,groups:4}:n>=1024&&n%16===0?{rw:4,groups:4}:n>=256&&n%4===0?{rw:1,groups:4}:{rw:1,groups:1}}function Dt(n){const{rw:e,groups:t}=Ve(n);return Math.ceil(n/(e*t))}function Lt({sg:n,K:e,N:t,wmode:r,pro:o="none",affine:i=!1,modulate:s=!1,store:a=!1,eps:u="1e-5",bias:c=!1,actv:l="none",res:f="none"}){const g=r==="q8";if(!g&&r!=="f16")throw new Error(`gemv: unknown weight format ${r}`);const v=g?16:8;if(!(e>0)||e%(32*v)!==0)throw new Error(`gemv: a row of ${e} ${r} weights is not a multiple of 32 words of 16 bytes`);if(o!=="none"&&e!==512)throw new Error(`gemv: the '${o}' prologue is for K = 512, not ${e}`);if(!["none","ln","combine"].includes(o))throw new Error(`gemv: unknown prologue ${o}`);const{rw:d,groups:w}=Ve(t),b=32*w,y=e/v,A=y/32,q=v/4,x=B(n,[["ro",o==="combine"?null:"xin","vec4<f32>"],["ro","W","vec4<u32>"],["rw","y","f32"],["ro",s||f==="gate"?"md":null,"vec4<f32>"],["ro",o==="combine"?"part":null,"vec4<f32>"],["rw",a?"aux":null,"vec4<f32>"],["ro","st","u32"]]),k=Array.from({length:d},(p,$)=>$),h=[Se,"let lane = lid & 31u;",`let row = (wg.x * ${w}u + (lid >> 5u)) * ${d}u;`];for(const p of k)h.push(`let n${p} = min(row + ${p}u, ${t-1}u);`);for(const p of k)for(let $=0;$<A;$++)h.push(`let w${p}_${$} = W[p.wo + n${p} * ${y}u + lane + ${32*$}u];`);if(g)for(const p of k)for(let $=0;$<A;$++)h.push(`let s${p}_${$} = bh(2u * p.so + n${p} * ${e/32}u + ((lane + ${32*$}u) >> 1u));`);for(const p of k)c&&h.push(`let bv${p} = bf(p.bo + n${p});`),f!=="none"&&h.push(`let yv${p} = y[p.yo + n${p}];`),f==="gate"&&h.push(`let gv${p} = md[(p.ga + n${p}) >> 2u][(p.ga + n${p}) & 3u];`);const m=[];for(let p=0;p<A;p++)for(let $=0;$<q;$++)m.push({v:`x${p}_${$}`,q:`q${p}_${$}`});for(const{q:p}of m){const[$,P]=p.slice(1).split("_").map(Number);h.push(`let ${p} = (lane + ${32*$}u) * ${q}u + ${P}u;`)}if(o==="none")for(const{v:p,q:$}of m)h.push(`let ${p} = xin[(p.xo >> 2u) + ${$}];`);else if(o==="ln"){for(const{v:p,q:$}of m)h.push(`let r${p} = xin[(p.xo >> 2u) + ${$}];`);h.push(`let mean = gsum(${m.map(({v:p})=>`dot(r${p}, vec4<f32>(1.0))`).join(" + ")}, lid) / 512.0;`);for(const{v:p}of m)h.push(`let d${p} = r${p} - mean;`);h.push(`let inv = inverseSqrt(gsum(${m.map(({v:p})=>`dot(d${p}, d${p})`).join(" + ")}, lid) / 512.0 + ${u});`);for(const{v:p,q:$}of m){let P=`d${p} * inv`;i&&(P=`${P} * bf4(p.lg + 4u * ${$}) + bf4(p.lb + 4u * ${$})`),s&&(P=`(${P}) * (1.0 + md[(p.sc >> 2u) + ${$}]) + md[(p.sh >> 2u) + ${$}]`),h.push(`let ${p} = ${P};`)}a&&h.push(`if (wg.x == 0u && lid < 32u) {
    ${m.map(({v:p,q:$})=>`aux[${$}] = ${p};`).join(`
    `)}
  }`)}else{h.push(`for (var e = lid; e < 128u; e += ${b}u) {
    let h = e >> 4u;
    var mx = SENT;
    for (var s = 0u; s < ${K}u; s++) { mx = max(mx, part[(h * ${K}u + s) * ${de/4}u + 16u].x); }
    var num = vec4<f32>(0.0);
    var den = 0.0;
    for (var s = 0u; s < ${K}u; s++) {
      let at = (h * ${K}u + s) * ${de/4}u;
      let ml = part[at + 16u];
      let f = exp(ml.x - mx);
      num += f * part[at + (e & 15u)];
      den += f * ml.y;
    }
    xs[e] = num / den;
  }
  workgroupBarrier();`);for(const{v:p,q:$}of m)h.push(`let ${p} = xs[${$}];`)}for(const p of k){const $=[];for(let P=0;P<A;P++)g?$.push(`s${p}_${P} * (${W.map((O,D)=>`dot(i8q(w${p}_${P}.${O}), x${P}_${D})`).join(" + ")})`):$.push(`dot(hlo(w${p}_${P}), x${P}_0) + dot(hhi(w${p}_${P}), x${P}_1)`);h.push(`let tot${p} = gsum(${$.join(`
    + `)}, lid);`)}if(!["none","gelu","silu"].includes(l))throw new Error(`gemv: unknown activation ${l}`);if(!["none","add","gate"].includes(f))throw new Error(`gemv: unknown residual ${f}`);const M=p=>{const $=[`var v = tot${p};`];return c&&$.push(`v += bv${p};`),l!=="none"&&$.push(`v = ${l}(v);`),f==="add"?$.push(`v = yv${p} + v;`):f==="gate"&&$.push(`v = yv${p} + gv${p} * v;`),$.push(`y[p.yo + n${p}] = v;`),`if (lane == ${p}u && row + ${p}u < ${t}u) {
    ${$.join(`
    `)}
  }`};return h.push(...k.map(M)),`${x}
${ee}
${Q}
${l==="gelu"?Le:""}${l==="silu"?Ct:""}
${Ie(n,b)}
${o==="combine"?"var<workgroup> xs: array<vec4<f32>, 128>;":""}
@compute @workgroup_size(${b})
fn main(${F}) {
  ${h.join(`
  `)}
}
`}function Ye({row:n,q:e}){const t=[];for(let i=0;i<8;i++)t.push(`let k${i} = K[${n("jk")} + ${i}u];`);t.push(`let sc = ${Array.from({length:8},(i,s)=>`dot(hlo(k${s}), ${e(2*s)}) + dot(hhi(k${s}), ${e(2*s+1)})`).join(`
      + `)};`);const r=[],o=[];for(let i=0;i<8;i++)r.push(`let jv${i} = min(jb + g + ${32*i}u, j1 - 1u);`,`let v${i} = V[${n(`jv${i}`)} + c];`),o.push(`let p${i} = ps[g + ${32*i}u];`,`a0 = fma(vec4<f32>(p${i}), hlo(v${i}), a0);`,`a1 = fma(vec4<f32>(p${i}), hhi(v${i}), a1);`,`ls += p${i};`);return`
  let g = lid >> 3u;
  let c = lid & 7u;
  var mx = SENT;
  var lt = 0.0;
  var o0 = vec4<f32>(0.0);
  var o1 = vec4<f32>(0.0);
  for (var jb = j0; jb < j1; jb += 256u) {
    ${r.join(`
    `)}
    let jk = min(jb + lid, j1 - 1u);
    ${t.join(`
    `)}
    let live = jb + lid < j1;
    let mn = max(mx, bmax(select(SENT, sc, live), lid));
    let al = exp(mx - mn);
    ps[lid] = select(0.0, exp(sc - mn), live);
    workgroupBarrier();
    var a0 = vec4<f32>(0.0);
    var a1 = vec4<f32>(0.0);
    var ls = 0.0;
    ${o.join(`
    `)}
    o0 = o0 * al + a0;
    o1 = o1 * al + a1;
    lt = lt * al + ls;
    mx = mn;
  }
  red[2u * lid] = o0;
  red[2u * lid + 1u] = o1;
  if (c == 0u) { lsum[g] = lt; }
  workgroupBarrier();
  var o = 0.0;
  var den = 0.0;
  if (lid < 64u) {
    let at = 2u * (lid >> 3u) + ((lid >> 2u) & 1u);
    for (var gg = 0u; gg < 32u; gg++) {
      o += red[16u * gg + at][lid & 3u];
      den += lsum[gg];
    }
  }`}function It({sg:n,row:e,ql:t,qh:r}){const o=[0,1,2,3,4,5,6,7],i=[];for(const s of o)i.push(`let jk${s} = jb + g + ${32*s}u;`,`let r${s} = ${e(`min(jk${s}, j1 - 1u)`)};`),i.push(`let k${s} = K[r${s} + 2u * c];`,`let l${s} = K[r${s} + 2u * c + 1u];`,`let v${s} = V[r${s} + 2u * c];`,`let u${s} = V[r${s} + 2u * c + 1u];`,`let d${s} = dot(k${s}, ql) + dot(l${s}, qh);`);if(n)for(const s of o)i.push(`var s${s} = d${s} + subgroupShuffleXor(d${s}, 1u);`,`s${s} += subgroupShuffleXor(s${s}, 2u);`,`s${s} += subgroupShuffleXor(s${s}, 4u);`);else{for(const s of o)i.push(`wsc[8u * (g + ${32*s}u) + c] = d${s};`);i.push("workgroupBarrier();");for(const s of o)i.push(`var s${s} = ${o.map(a=>`wsc[8u * (g + ${32*s}u) + ${a}u]`).join(" + ")};`)}for(const s of o)i.push(`s${s} = select(SENT, s${s}, jk${s} < j1);`);i.push("let mn = max(mx, bmax(max(max(max(s0, s1), max(s2, s3)), max(max(s4, s5), max(s6, s7))), lid));","let al = exp(mx - mn);"),i.push("var a0 = vec4<f32>(0.0);","var a1 = vec4<f32>(0.0);","var ls = 0.0;");for(const s of o)i.push(`let p${s} = exp(s${s} - mn);`,`a0 = fma(vec4<f32>(p${s}), v${s}, a0);`,`a1 = fma(vec4<f32>(p${s}), u${s}, a1);`),i.push(`ls += p${s};`);return`
  let g = lid >> 3u;
  let c = lid & 7u;
  let ql = ${t};
  let qh = ${r};
  var mx = SENT;
  var lt = 0.0;
  var o0 = vec4<f32>(0.0);
  var o1 = vec4<f32>(0.0);
  for (var jb = j0; jb < j1; jb += 256u) {
    ${i.join(`
    `)}
    o0 = o0 * al + a0;
    o1 = o1 * al + a1;
    lt = lt * al + ls;
    mx = mn;
  }
  ${[0,1,2,3].map(s=>`wsc[8u * lid + ${s}u] = o0.${W[s]};
  wsc[8u * lid + ${s+4}u] = o1.${W[s]};`).join(`
  `)}
  if (c == 0u) { lsum[g] = lt; }
  workgroupBarrier();
  var o = 0.0;
  var den = 0.0;
  if (lid < 64u) {
    for (var gg = 0u; gg < 32u; gg++) {
      o += wsc[64u * gg + lid];
      den += lsum[gg];
    }
  }`}const Qe=`
var<workgroup> ps: array<f32, 256>;
var<workgroup> red: array<vec4<f32>, 512>;
var<workgroup> lsum: array<f32, 32>;`,Vt=`
var<workgroup> wsc: array<f32, 2048>;
var<workgroup> lsum: array<f32, 32>;`;function Yt({sg:n,theta:e="10000.0"}){return`${B(n,[["ro","qkv","vec4<f32>"],["rw","K","vec4<u32>"],["rw","V","vec4<u32>"],["rw","part","f32"],["ro","st","u32"]])}
${Q}
${xe(e)}
${pe(n,256,"Max","bmax")}
${Qe}
var<workgroup> qs: array<vec4<f32>, 16>;
fn rot4(x: vec4<f32>, pos: f32, t: u32) -> vec4<f32> {
  return vec4<f32>(rot(x.xy, pos * OMEGA[t]), rot(x.zw, pos * OMEGA[t + 1u]));
}
fn pk(a: vec4<f32>, b: vec4<f32>) -> vec4<u32> {
  return vec4<u32>(pack2x16float(a.xy), pack2x16float(a.zw), pack2x16float(b.xy), pack2x16float(b.zw));
}
@compute @workgroup_size(256)
fn main(${F}) {
  ${Se}
  let h = wg.y;
  let P = st[ST_POS];
  let cs = (P + ${K}u) / ${K}u;
  let j0 = wg.x * cs;
  let j1 = min(P + 1u, j0 + cs);
  // Invocation t < 8 rotates channels 8t .. 8t + 7: the query (scaled by 1 / 8) into qs, and,
  // in the split holding P, the key into the cache, with the value.
  if (lid < 8u) {
    let pos = f32(P);
    let qa = qkv[16u * h + 2u * lid];
    let qb = qkv[16u * h + 2u * lid + 1u];
    qs[2u * lid] = rot4(qa, pos, 4u * lid) * 0.125;
    qs[2u * lid + 1u] = rot4(qb, pos, 4u * lid + 2u) * 0.125;
    if (j0 <= P && P < j1) {
      let at = (p.ko >> 2u) + 64u * P + 8u * h + lid;
      K[at] = pk(rot4(qkv[128u + 16u * h + 2u * lid], pos, 4u * lid), rot4(qkv[128u + 16u * h + 2u * lid + 1u], pos, 4u * lid + 2u));
      V[at] = pk(qkv[256u + 16u * h + 2u * lid], qkv[256u + 16u * h + 2u * lid + 1u]);
    }
  }
  workgroupBarrier();
  storageBarrier();
  ${Ye({row:r=>`(p.ko >> 2u) + 64u * ${r} + 8u * h`,q:r=>`qs[${r}]`})}
  let at = (h * ${K}u + wg.x) * ${de}u;
  if (lid < 64u) { part[at + lid] = o; }
  if (lid == 0u) {
    part[at + 64u] = mx;
    part[at + 65u] = den;
  }
}
`}function Qt({sg:n}){return`${B(n,[["ro","pq","vec4<f32>"],["ro","K","vec4<u32>"],["ro","V","vec4<u32>"],["rw","att","f32"],["ro","st","u32"]])}
${Q}
${pe(n,256,"Max","bmax")}
${Qe}
@compute @workgroup_size(256)
fn main(${F}) {
  let m = wg.x;
  if (m >= st[ST_ROWS]) { return; }
  let h = wg.y;
  let j0 = 0u;
  let j1 = st[ST_POS] + m + 1u;
  ${Array.from({length:16},(t,r)=>`let q${r} = pq[128u * m + 16u * h + ${r}u];`).join(`
  `)}
  ${Ye({row:t=>`(p.ko >> 2u) + 64u * ${t} + 8u * h`,q:t=>`q${t}`})}
  if (lid < 64u) { att[512u * m + 64u * h + lid] = o / den; }
}
`}function Ht({sg:n}){const e=B(n,[["ro","q","vec4<f32>"],["ro","K","vec4<f32>"],["ro","V","vec4<f32>"],["rw","att","f32"],["ro","st","u32"]]),t=r=>`(p.ko >> 2u) + 128u * (${r} & ${ke-1}u) + 16u * h`;return`${e}
${pe(n,256,"Max","bmax")}
${Vt}
@compute @workgroup_size(256)
fn main(${F}) {
  ${se}
  let m = wg.x;
  let h = wg.y;
  let P = 16u * st[ST_CPOS] + m;
  let j0 = max(P, 249u) - 249u;
  let j1 = P + 1u;
  ${It({sg:n,row:t,ql:"q[128u * m + 16u * h + 2u * (lid & 7u)]",qh:"q[128u * m + 16u * h + 2u * (lid & 7u) + 1u]"})}
  if (lid < 64u) { att[512u * m + 64u * h + lid] = o / den; }
}
`}const Xt=`
fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn gauss(seed: u32, f: u32, i: u32) -> f32 {
  let a = pcg(seed ^ pcg(32u * f + i));
  let b = pcg(a ^ 0x9E3779B9u);
  let u1 = (f32(a >> 8u) + 0.5) / 16777216.0;
  let u2 = f32(b >> 8u) / 16777216.0;
  let t = 6.283185307179586 * u2;
  // cos(t) for t in [0, 2 pi), taken as -cos(t - pi) to stay in the range GPUs keep accurate.
  let r = fma(-1.0, -8.742278e-8, t - 3.1415927410125732);
  return sqrt(-2.0 * log(u1)) * -cos(r);
}`;function Jt(){return`${B(!1,[["rw","cur","vec4<f32>"],["ro","W","vec4<u32>"],["rw","hf","f32"],["ro","st","u32"]])}
${ee}
${Q}
${Xt}
var<workgroup> zs: array<vec4<f32>, 8>;
@compute @workgroup_size(256)
fn main(${F}) {
  ${Se}
  if (lid < 8u) {
    let sd = st[ST_SEED];
    let f = st[ST_FRAME];
    let z = vec4<f32>(gauss(sd, f, 4u * lid), gauss(sd, f, 4u * lid + 1u), gauss(sd, f, 4u * lid + 2u), gauss(sd, f, 4u * lid + 3u))
      * bitcast<f32>(st[ST_SCALE]);
    zs[lid] = z;
    if (wg.x == 0u) { cur[lid] = z; }
  }
  let n = 256u * wg.x + lid;
  let w0 = W[p.wo + 4u * n];
  let w1 = W[p.wo + 4u * n + 1u];
  let w2 = W[p.wo + 4u * n + 2u];
  let w3 = W[p.wo + 4u * n + 3u];
  let b = bf(p.bo + n);
  workgroupBarrier();
  hf[n] = b + dot(hlo(w0), zs[0]) + dot(hhi(w0), zs[1]) + dot(hlo(w1), zs[2]) + dot(hhi(w1), zs[3])
    + dot(hlo(w2), zs[4]) + dot(hhi(w2), zs[5]) + dot(hlo(w3), zs[6]) + dot(hhi(w3), zs[7]);
}
`}function Zt({sg:n}){const e=B(n,[["ro","cur","vec4<f32>"],["ro","tout","vec2<f32>"],["ro","W","vec4<u32>"],["rw","x","f32"],["rw","lats","vec4<f32>"],["rw","st","u32"]]),t=r=>`bf(p.sh + ${r}) + ${[0,1,2,3].map(o=>`dot(hlo(W[p.wo + 4u * ${r} + ${o}u]), c${2*o}) + dot(hhi(W[p.wo + 4u * ${r} + ${o}u]), c${2*o+1})`).join(`
    + `)}`;return`${e}
${ee}
${Q}
${pe(n,256,"Add","wsum")}
var<workgroup> flag: u32;
@compute @workgroup_size(256)
fn main(${F}) {
  // st is read-write here, so the stop flag reaches every invocation through workgroup memory.
  let f = st[ST_FRAME];
  if (lid == 0u) { flag = st[ST_STOP]; }
  if (workgroupUniformLoad(&flag) != 0u) { return; }
  ${Array.from({length:8},(r,o)=>`let c${o} = cur[${o}u];`).join(`
  `)}
  if (lid < 8u) { lats[8u * f + lid] = cur[lid]; }
  let n0 = lid;
  let n1 = lid + 256u;
  x[n0] = ${t("n0")};
  x[n1] = ${t("n1")};
  let t = tout[lid];
  let logit = wsum(t.x * bf(p.lg + 2u * lid) + t.y * bf(p.lg + 2u * lid + 1u), lid) + bf(p.lb);
  if (lid == 0u) {
    let nf = f + 1u;
    var ne = st[ST_END];
    if (ne == 0u && logit > bitcast<f32>(p.a0)) {
      ne = nf + st[ST_AFTER];
      st[ST_END] = ne;
    }
    st[ST_FRAME] = nf;
    st[ST_POS] = st[ST_POS] + 1u;
    if ((ne != 0u && nf >= ne) || nf >= st[ST_LIMIT]) { st[ST_STOP] = 1u; }
  }
}
`}function He({sg:n,gate:e=!1}){const t=B(n,[["ro","xin","vec4<f32>"],["ro","W","vec4<u32>"],["rw","dst","vec4<f32>"],["ro","st","u32"]]),r=[0,1,2,3];return`${t}
${ee}
${Ie(n,32)}
@compute @workgroup_size(32)
fn main(${F}) {
  ${e?se:""}
  let m = wg.x;
  let b = (p.ab >> 2u) + 128u * m;
  ${r.map(o=>`let x${o} = xin[b + lid + ${32*o}u];`).join(`
  `)}
  let mean = gsum(${r.map(o=>`dot(x${o}, vec4<f32>(1.0))`).join(" + ")}, lid) / 512.0;
  ${r.map(o=>`let d${o} = x${o} - mean;`).join(`
  `)}
  let inv = inverseSqrt(gsum(${r.map(o=>`dot(d${o}, d${o})`).join(" + ")}, lid) / 512.0 + 1e-5);
  ${r.map(o=>`dst[128u * m + lid + ${32*o}u] = d${o} * inv * bf4(p.lg + 4u * (lid + ${32*o}u)) + bf4(p.lb + 4u * (lid + ${32*o}u));`).join(`
  `)}
}
`}function er({theta:n="10000.0"}={}){return`${B(!1,[["ro","qkv","vec2<f32>"],["rw","pq","vec2<f32>"],["rw","kc","u32"],["rw","vc","u32"],["ro","st","u32"]])}
${xe(n)}
@compute @workgroup_size(256)
fn main(${F}) {
  let m = wg.x;
  if (m >= st[ST_ROWS]) { return; }
  let P = st[ST_POS] + m;
  let a = f32(P) * OMEGA[lid & 31u];
  let i = 768u * m + lid;
  pq[256u * m + lid] = rot(qkv[i], a) * 0.125;
  let at = p.ko + 256u * P + lid;
  kc[at] = pack2x16float(rot(qkv[i + 256u], a));
  vc[at] = pack2x16float(qkv[i + 512u]);
}
`}function tr(){return`${B(!1,[["ro","qkv","vec2<f32>"],["rw","q","vec2<f32>"],["rw","kr","vec2<f32>"],["rw","vr","vec2<f32>"],["ro","st","u32"]])}
${xe("10000.0")}
@compute @workgroup_size(256)
fn main(${F}) {
  ${se}
  let m = wg.x;
  if (m >= p.M) { return; }
  let P = 16u * st[ST_CPOS] + m;
  let a = f32(P) * OMEGA[lid & 31u];
  let i = 768u * m + lid;
  q[256u * m + lid] = rot(qkv[i], a) * 0.125;
  let at = (p.ko >> 1u) + 256u * (P & ${ke-1}u) + lid;
  kr[at] = rot(qkv[i + 256u], a);
  vr[at] = qkv[i + 512u];
}
`}function rr(){return`${B(!1,[["rw","st","u32"]])}
@compute @workgroup_size(1)
fn main() {
  st[ST_POS] = st[ST_POS] + st[ST_ROWS];
}
`}function or(){return`${B(!1,[["ro","lats","vec4<f32>"],["ro","W","vec4<u32>"],["rw","tr","f32"],["ro","st","u32"]])}
${ee}
${Q}
var<workgroup> lat: array<vec4<f32>, 16>;
@compute @workgroup_size(256)
fn main(${F}) {
  ${se}
  let row = wg.x >> 1u;
  if (row >= p.M) { return; }
  let f = st[ST_CPOS] + (row >> 4u);
  let j = row & 15u;
  // lat[0..8): frame f, lat[8..16): frame f - 1 (zeros at the chunk's first frame).
  if (lid < 16u) {
    let i = lid & 7u;
    var v = vec4<f32>(0.0);
    if (lid < 8u) { v = lats[8u * f + i] * bf4(p.lg + 4u * i) + bf4(p.lb + 4u * i); }
    else if (f > 0u) { v = lats[8u * (f - 1u) + i] * bf4(p.lg + 4u * i) + bf4(p.lb + 4u * i); }
    lat[lid] = v;
  }
  let c = 256u * (wg.x & 1u) + lid;
  ${[0,1,2,3].map(e=>`let w${e} = W[p.wo + 4u * c + ${e}u];`).join(`
  `)}
  let u0 = bf(p.bo + 32u * c + j);
  let u1 = bf(p.bo + 32u * c + j + 16u);
  workgroupBarrier();
  var pf = 0.0;
  var pp = 0.0;
  ${[0,1,2,3].map(e=>`pf += dot(hlo(w${e}), lat[${2*e}]) + dot(hhi(w${e}), lat[${2*e+1}]);
  pp += dot(hlo(w${e}), lat[${8+2*e}]) + dot(hhi(w${e}), lat[${9+2*e}]);`).join(`
  `)}
  tr[p.yb + 512u * row + c] = select(pf * u0, pf * u0 + pp * u1, f > 0u);
}
`}function nr(n,e){if(n.length>8)throw new Error(`shift: ${n.length} stages, more than 8 storage bindings`);const t=B(!1,n.map((o,i)=>["rw",`b${i}`,"f32"])),r=n.map((o,i)=>`if (e < ${o.ctx*o.ch}u) { b${i}[e] = b${i}[${o.rate*e*o.ch}u + e]; }`);return`${t}
@compute @workgroup_size(256)
fn main(${F}) {
  let e = 256u * wg.x + lid;
  ${r.join(`
  `)}
}
`}const Ge=new Map;function Xe({K:n,N:e,wmode:t="f16",phases:r=1,eluA:o=!1,bias:i=!1,act:s="none",res:a="none",rowsFromState:u=!1,gate:c=!1}){if(!(n>0)||n%32!==0)throw new Error(`gemm: K = ${n} is not a multiple of 32`);if(t!=="q8"&&t!=="f16")throw new Error(`gemm: unknown weight format ${t}`);if(!["none","gelu"].includes(s))throw new Error(`gemm: unknown activation ${s}`);if(!["none","add","addy","ls"].includes(a))throw new Error(`gemm: unknown residual ${a}`);const l=JSON.stringify([n,e,t,r,o,i,s,a,u,c]);let f=Ge.get(l);return f===void 0&&(f=sr({K:n,N:e,q8:t==="q8",phases:r,eluA:o,bias:i,act:s,res:a,rowsFromState:u,gate:c}),Ge.set(l,f)),f}function sr(n){const{K:e,N:t,q8:r,eluA:o,act:i,res:s,rowsFromState:a,gate:u}=n,c=t%4===0,l=B(!1,[["ro","A","vec4<f32>"],["ro","W","vec4<u32>"],["rw","Y",c?"vec4<f32>":"f32"],["ro",s==="add"?"rsd":null,"f32"],["ro","st","u32"]]),f=`
const K = ${e}u;
const N = ${t}u;
fn ldA(m: u32, k: u32, M: u32) -> vec4<f32> {
  if (m >= M || k >= K) { return vec4<f32>(0.0); }
  return ${o?"elu4(":""}A[(p.ab >> 2u) + m * (p.arow >> 2u) + (k >> 2u)]${o?")":""};
}
${r?`fn ldW(n: u32, k: u32, ph: u32) -> vec4<u32> {
  if (n >= N || k >= K) { return vec4<u32>(0u); }
  return W[p.wo + n * ${e/16}u + (k >> 4u)];
}
fn ldS(n: u32, k: u32) -> f32 {
  if (n >= N || k >= K) { return 0.0; }
  return bh(2u * p.so + n * ${e/32}u + (k >> 5u));
}`:`fn ldW(n: u32, k: u32, ph: u32) -> vec4<u32> {
  if (n >= N || k >= K) { return vec4<u32>(0u); }
  return W[p.wo + ph * p.wph + n * ${e/8}u + (k >> 3u)];
}`}
fn swz(q: u32) -> u32 { return q ^ ((q >> 3u) & 3u); }`;return`${l}
${ee}
${Q}
${i==="gelu"?Le:""}
${o?Rt:""}
${f}
${ir(n,c)}
var<workgroup> sm: array<vec4<f32>, 1024>;
${t<=4?ar(n):`${ur(n)}
${Ne(16,4,n)}
${Ne(32,r?2:4,n)}`}
@compute @workgroup_size(256)
fn main(${F}) {
  ${u?se:""}
  let M = ${a?"st[ST_ROWS]":"p.M"};
  let m0 = 64u * wg.y;
  if (m0 >= M) { return; }
  ${t<=4?"thin(lid, m0, wg.z, M);":`let mt = min(64u, M - m0);
  if (mt <= 16u) { nar16(lid, m0, 64u * wg.x, wg.z, mt); }
  else if (mt <= 32u) { nar32(lid, m0, 64u * wg.x, wg.z, mt); }
  else { wide(lid, m0, 64u * wg.x, wg.z, M); }`}
}
`}function ir({N:n,bias:e,act:t,res:r,phases:o},i){const s=o,a=(c,l)=>{const f=`n + ${l}u`,g=[`var ${c} = acc.${W[l]};`];return e&&g.push(`${c} += bf(p.bo + ${f});`),t==="gelu"&&g.push(`${c} = gelu(${c});`),g};if(i){const c=["if (n >= N) { return; }","let o = (p.yb + ro * N + n) >> 2u;"];for(let f=0;f<4;f++)c.push(...a(`v${f}`,f));const l="vec4<f32>(v0, v1, v2, v3)";return r==="none"?c.push(`Y[o] = ${l};`):r==="add"?c.push("let r = p.rb + ro * N + n;",`Y[o] = ${l} + vec4<f32>(rsd[r], rsd[r + 1u], rsd[r + 2u], rsd[r + 3u]);`):r==="addy"?c.push(`Y[o] = Y[o] + ${l};`):c.push(`Y[o] = Y[o] + vec4<f32>(bf(p.lso + n), bf(p.lso + n + 1u), bf(p.lso + n + 2u), bf(p.lso + n + 3u)) * ${l};`),`fn put(m: u32, ph: u32, n: u32, acc: vec4<f32>) {
  let ro = m * ${s}u + ph;
  ${c.join(`
  `)}
}`}const u=[];for(let c=0;c<4;c++){const l=[...a("v",c),`let o = p.yb + ro * N + n + ${c}u;`];r==="none"?l.push("Y[o] = v;"):r==="add"?l.push(`Y[o] = v + rsd[p.rb + ro * N + n + ${c}u];`):r==="addy"?l.push("Y[o] = Y[o] + v;"):l.push(`Y[o] = Y[o] + bf(p.lso + n + ${c}u) * v;`),u.push(`if (n + ${c}u < N) {
    ${l.join(`
    `)}
  }`)}return`fn put(m: u32, ph: u32, n: u32, acc: vec4<f32>) {
  let ro = m * ${s}u + ph;
  ${u.join(`
  `)}
}`}function ar({N:n,q8:e}){const t=e?16:8,r=Array.from({length:n},(i,s)=>s),o=i=>e?`ldS(${i}u, ${t}u * w) * (${W.map((s,a)=>`dot(i8q(x${i}.${s}), a${a})`).join(" + ")})`:`dot(hlo(x${i}), a0) + dot(hhi(x${i}), a1)`;return`fn thin(lid: u32, m0: u32, ph: u32, M: u32) {
  let m = m0 + (lid >> 2u);
  var acc = vec4<f32>(0.0);
  for (var w = lid & 3u; w < K / ${t}u; w += 4u) {
    ${Array.from({length:t/4},(i,s)=>`let a${s} = ldA(m, ${t}u * w + ${4*s}u, M);`).join(`
    `)}
    ${r.map(i=>`let x${i} = ldW(${i}u, ${t}u * w, ph);`).join(`
    `)}
    acc += vec4<f32>(${[0,1,2,3].map(i=>i<n?o(i):"0.0").join(`,
      `)});
  }
  sm[lid] = acc;
  workgroupBarrier();
  if (lid < 64u && m0 + lid < M) {
    put(m0 + lid, ph, 0u, sm[4u * lid] + sm[4u * lid + 1u] + sm[4u * lid + 2u] + sm[4u * lid + 3u]);
  }
}`}function ur({q8:n}){const e=[0,1,2,3],t=[0,1,2,3,4,5,6,7],r=n?a=>["if (lid < 128u) {",`  rw = ldW(n0 + wc, ${a} + 16u * wh, ph);`,`  rs = ldS(n0 + wc, ${a});`,"}"]:a=>[`rw = ldW(n0 + wc, ${a} + 8u * wh, ph);`],o=a=>[`ra0 = ldA(m0 + ar, ${a} + 4u * aq, M);`,`ra1 = ldA(m0 + ar + 32u, ${a} + 4u * aq, M);`,...r(a)],i=n?["if (lid < 128u) {",...e.map(a=>`  sm[wt + ((4u * wh + ${a}u) ^ wsw)] = i8q(rw.${W[a]}) * rs;`),"}"]:["sm[wt + ((2u * wh) ^ wsw)] = hlo(rw);","sm[wt + ((2u * wh + 1u) ^ wsw)] = hhi(rw);"],s=a=>["{",`  let pw = ${a}u ^ sx;`,...e.map(u=>`  let w${u} = sm[wb + ${8*u}u + pw];`),...e.map(u=>`  let t${u} = vec4<f32>(w0.${W[u]}, w1.${W[u]}, w2.${W[u]}, w3.${W[u]});`),...e.flatMap(u=>[`  let a${u} = sm[ab + ${128*u+a}u];`,`  c${u} = fma(vec4<f32>(a${u}.x), t0, fma(vec4<f32>(a${u}.y), t1, fma(vec4<f32>(a${u}.z), t2, fma(vec4<f32>(a${u}.w), t3, c${u}))));`]),"}"];return`fn wide(lid: u32, m0: u32, n0: u32, ph: u32, M: u32) {
  let tx = lid & 15u;
  let ty = lid >> 4u;
  let sx = tx & 7u;
  let wb = 512u + 32u * tx;
  let ab = 8u * ty;
  let ar = lid >> 3u;
  let aq = lid & 7u;
  let wc = ${n?"(lid >> 1u) & 63u":"lid >> 2u"};
  let wh = lid & ${n?1:3}u;
  let wt = 512u + 8u * wc;
  let wsw = (wc >> 2u) & 7u;
  ${e.map(a=>`var c${a} = vec4<f32>(0.0);`).join(`
  `)}
  var ra0 = vec4<f32>(0.0);
  var ra1 = vec4<f32>(0.0);
  var rw = vec4<u32>(0u);
  ${n?"var rs = 0.0;":""}
  ${o("0u").join(`
  `)}
  for (var k0 = 0u; k0 < K; k0 += 32u) {
    workgroupBarrier();
    sm[8u * ar + aq] = ra0;
    sm[8u * ar + 256u + aq] = ra1;
    ${i.join(`
    `)}
    workgroupBarrier();
    if (k0 + 32u < K) {
      ${o("k0 + 32u").join(`
      `)}
    }
    ${t.flatMap(s).join(`
    `)}
  }
  ${e.map(a=>`if (ty + ${16*a}u < M - m0) { put(m0 + ty + ${16*a}u, ph, n0 + 4u * tx, c${a}); }`).join(`
  `)}
}`}function Ne(n,e,{q8:t}){const r=4*e,o=4096/n,i=o/4,s=t?16:8,a=o/r/s;if(!Number.isInteger(a)||a<1)throw new Error(`gemm: no ${n}-row tiling with ${e} columns per invocation`);const u=64/n,c=`vec${e}<f32>`,l=Array.from({length:n},(h,m)=>m),f=Array.from({length:a},(h,m)=>m),g=Array.from({length:e},(h,m)=>m),v=[0,1,2,3],d=h=>[...v.map(m=>`ra${m} = ldA(m0 + ar${m}, ${h} + 4u * aq${m}, M);`),...f.flatMap(m=>g.flatMap(M=>[`w${M}_${m} = ldW(nc${M}, ${h} + ${s}u * (g + ${r*m}u), ph);`,...t?[`s${M}_${m} = ldS(nc${M}, ${h} + 16u * (g + ${r*m}u));`]:[]]))],w=(h,m)=>{const M=t?`4u * (g + ${r*h}u) + ${m}u`:`2u * (g + ${r*h}u) + ${m}u`,p=$=>t?`i8q(x${$}_${h}.${W[m]}) * y${$}_${h}`:`${m?"hhi":"hlo"}(x${$}_${h})`;return["{",`  let pq = swz(${M});`,...g.map($=>`  let v${$} = ${p($)};`),...v.map($=>`  let t${$} = ${c}(${g.map(P=>`v${P}.${W[$]}`).join(", ")});`),...l.flatMap($=>[`  let a${$} = sm[${$*i}u + pq];`,`  c${$} = fma(${c}(a${$}.x), t0, fma(${c}(a${$}.y), t1, fma(${c}(a${$}.z), t2, fma(${c}(a${$}.w), t3, c${$}))));`]),"}"]},b=f.flatMap(h=>Array.from({length:t?4:2},(m,M)=>w(h,M)).flat()),y=n*e/4,A=Array.from({length:y},(h,m)=>e===4?[`c${m}`]:[`c${2*m}`,`c${2*m+1}`]),q=h=>e===4?A[h][0]:`vec4<f32>(${A[h][0]}, ${A[h][1]})`,_=(h,m)=>e===4?`${A[h][0]} + ${m}`:`vec4<f32>(${A[h][0]} + ${m}.xy, ${A[h][1]} + ${m}.zw)`,x=[];for(let h=r;h>0;h-=u){const m=h-u;x.push("workgroupBarrier();");const M=[];for(let p=0;p<y;p++){const $=`${16*n}u * (g - ${m}u) + ${y}u * cg + ${p}u`;h===r?M.push(`sm[${$}] = ${q(p)};`):M.push(`{ let v = sm[${$}]; sm[${$}] = ${_(p,"v")}; }`)}x.push(`if (g >= ${m}u && g < ${h}u) {
    ${M.join(`
    `)}
  }`)}x.push("workgroupBarrier();");const k=[];for(let h=0;h<n/16;h++){const m=M=>e===4?`v += sm[${16*n*M}u + ${n}u * cq + r];`:`{ let x = sm[${16*n*M}u + ${n}u * cq + (r >> 1u)]; let y = sm[${16*n*M}u + ${n}u * cq + ${n/2}u + (r >> 1u)]; v += select(vec4<f32>(x.xy, y.xy), vec4<f32>(x.zw, y.zw), (r & 1u) == 1u); }`;k.push(`{
    let r = (lid >> 4u) + ${16*h}u;
    var v = vec4<f32>(0.0);
    ${Array.from({length:u},(M,p)=>m(p)).join(`
    `)}
    if (r < mt) { put(m0 + r, ph, n0 + 4u * cq, v); }
  }`)}return`fn nar${n}(lid: u32, m0: u32, n0: u32, ph: u32, mt: u32) {
  let M = m0 + mt;
  let g = lid & ${r-1}u;
  let cg = lid / ${r}u;
  let cq = lid & 15u;
  ${g.map(h=>`let nc${h} = n0 + ${e}u * cg + ${h}u;`).join(`
  `)}
  ${v.map(h=>`let ar${h} = ${256*h/i}u + lid / ${i}u;
  let aq${h} = lid % ${i}u;
  let as${h} = ${i}u * ar${h} + swz(aq${h});`).join(`
  `)}
  ${l.map(h=>`var c${h} = ${c}(0.0);`).join(`
  `)}
  ${v.map(h=>`var ra${h} = vec4<f32>(0.0);`).join(`
  `)}
  ${f.flatMap(h=>g.map(m=>`var w${m}_${h} = vec4<u32>(0u);${t?` var s${m}_${h} = 0.0;`:""}`)).join(`
  `)}
  ${d("0u").join(`
  `)}
  for (var k0 = 0u; k0 < K; k0 += ${o}u) {
    workgroupBarrier();
    ${v.map(h=>`sm[as${h}] = ra${h};`).join(`
    `)}
    workgroupBarrier();
    ${f.flatMap(h=>g.map(m=>`let x${m}_${h} = w${m}_${h};${t?` let y${m}_${h} = s${m}_${h};`:""}`)).join(`
    `)}
    if (k0 + ${o}u < K) {
      ${d(`k0 + ${o}u`).join(`
      `)}
    }
    ${b.join(`
    `)}
  }
  ${x.join(`
  `)}
  ${k.join(`
  `)}
}`}const te=256;class lr{constructor(e){this.device=e,this.layouts=new Map,this.kinds=new Map,this.pipes=new Map,this.lists=new Map}layout(e,t){const r=this.kinds.get(e);if(r!==void 0&&r!==t.join())throw new Error(`bind group layout '${e}' asked for as [${t}] after [${r}]`);return this.kinds.set(e,t.join()),this.layouts.has(e)||this.layouts.set(e,this.device.createBindGroupLayout({label:e,entries:[...t.map((o,i)=>({binding:i,visibility:GPUShaderStage.COMPUTE,buffer:{type:o==="ro"?"read-only-storage":"storage"}})),{binding:t.length,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]})),e}pipe(e,t,r){if(!this.pipes.has(e)){const{device:o}=this;this.pipes.set(e,{layout:t,promise:o.createComputePipelineAsync({label:e,layout:o.createPipelineLayout({bindGroupLayouts:[this.layouts.get(t)]}),compute:{module:o.createShaderModule({code:r,label:e}),entryPoint:"main"}})})}return e}add(e,t,r,o,i){for(const s of Object.keys(o))if(!he.includes(s))throw new Error(`${t}: no uniform field ${s}`);this.lists.has(e)||this.lists.set(e,[]),this.lists.get(e).push({key:t,groups:r,params:o,bind:i})}async build(){const{device:e}=this,t=new Map,r=await Promise.all([...this.pipes].map(async([c,l])=>[c,{pipeline:await l.promise,layout:l.layout}]));for(const[c,l]of r)t.set(c,l);const o=[...this.lists.values()].flat(),i=e.createBuffer({label:"params",size:Math.max(te,o.length*te),usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),s=new Uint32Array(o.length*(te/4));o.forEach((c,l)=>he.forEach((f,g)=>{s[l*(te/4)+g]=c.params[f]??0})),e.queue.writeBuffer(i,0,s);const a={};let u=0;for(const[c,l]of this.lists)a[c]=l.map(f=>{const{pipeline:g,layout:v}=t.get(f.key),d=e.createBindGroup({label:f.key,layout:this.layouts.get(v),entries:[...f.bind.map((b,y)=>({binding:y,resource:{buffer:b}})),{binding:f.bind.length,resource:{buffer:i,offset:u*te,size:Nt}}]});u++;const w=typeof f.groups=="function"?null:f.groups;return{pipeline:g,bg:d,fn:w?null:f.groups,x:w?.[0],y:w?.[1]??1,z:w?.[2]??1}});return a}}function be(n,e,t=1,r=0){let o=null;for(let i=0;i<t;i++)for(let s=0;s<e.length;s++){const a=e[s];if(a.pipeline!==o&&(n.setPipeline(a.pipeline),o=a.pipeline),n.setBindGroup(0,a.bg),a.fn){const[u,c=1,l=1]=a.fn(r);n.dispatchWorkgroups(u,c,l)}else n.dispatchWorkgroups(a.x,a.y,a.z)}}const re=2048,ye=1024,z=512,T=512,ze=n=>new Uint32Array(new Float32Array([n]).buffer)[0];class _e{constructor(e,t,r,o){this.device=e,this.w=t,this.W=r,this.o=o,this.layers=o.layers;const i=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,s=(a,u)=>e.createBuffer({size:Math.max(16,a*4),usage:i,label:u});this.st=s(fe,"state"),this.X=s(T,"x"),this.QKV=s(3*T,"qkv"),this.FF=s(2048,"ff"),this.PART=s(8*K*de,"part"),this.TOUT=s(T,"tout"),this.YA=s(T,"ya"),this.ADA=s(t.flow.ada.rows,"ada"),this.CUR=s(32,"cur"),this.HF=s(T,"hf"),this.TF=s(T,"tf"),this.KC=s(this.layers*re*T/2,"kc"),this.VC=s(this.layers*re*T/2,"vc"),this.LATS=s(ye*32,"lats"),this.ROWS=s(z*T,"prompt-rows"),this.PH=s(z*T,"prompt-h"),this.PQKV=s(z*3*T,"prompt-qkv"),this.PQ=s(z*T,"prompt-q"),this.PATT=s(z*T,"prompt-att"),this.PFF=s(z*2048,"prompt-ff"),this.DR=s(4096,"dummy-ro"),this.DW=s(4096,"dummy-rw")}static layerBytes(){return re*T*2}addLists(e){const{w:t,W:r,st:o,X:i,QKV:s,FF:a,PART:u,TOUT:c,YA:l,ADA:f,CUR:g,HF:v,TF:d,KC:w,VC:b,DR:y,DW:A}=this,q=this.o.subgroups,_={gemv:e.layout("gemv",["ro","ro","rw","ro","ro","rw","ro"]),attn:e.layout("attn",["ro","rw","rw","rw","ro"]),inproj:e.layout("inproj",["rw","ro","rw","ro"]),finish:e.layout("finish",["ro","ro","ro","rw","rw","rw"]),ln:e.layout("ln",["ro","ro","rw","ro"]),gemm:e.layout("gemm",["ro","ro","rw","ro","ro"]),rope:e.layout("rope",["ro","rw","rw","rw","ro"]),pattn:e.layout("pattn",["ro","ro","ro","rw","ro"]),padv:e.layout("padv",["rw"])},x=S=>[Dt(S)],k=re*T/2,h=(S,U)=>e.pipe(`lm-${S}`,_.gemv,Lt({sg:q,...U})),m=h("qkv",{K:512,N:1536,wmode:"q8",pro:"ln",affine:!0}),M=h("out",{K:512,N:512,wmode:"q8",pro:"combine",res:"add"}),p=h("fc1",{K:512,N:2048,wmode:"q8",pro:"ln",affine:!0,actv:"gelu"}),$=h("fc2",{K:2048,N:512,wmode:"q8",res:"add"}),P=h("cond",{K:512,N:512,wmode:"f16",pro:"ln",affine:!0,store:!0,bias:!0,actv:"silu"}),O=h("ada",{K:512,N:t.flow.ada.rows,wmode:"f16",bias:!0}),D=h("b1",{K:512,N:512,wmode:"f16",pro:"ln",affine:!0,modulate:!0,eps:"1e-6",bias:!0,actv:"silu"}),I=h("b2",{K:512,N:512,wmode:"f16",bias:!0,res:"gate"}),ie=h("fin",{K:512,N:32,wmode:"f16",pro:"ln",modulate:!0,eps:"1e-6",bias:!0,res:"add"}),ut=e.pipe("lm-attn",_.attn,Yt({sg:q})),lt=e.pipe("lm-in",_.inproj,Jt()),ct=e.pipe("lm-finish",_.finish,Zt({sg:q})),C=(S,U,{md:$e=y,part:gt=y,aux:vt=A}={})=>[S,r,U,$e,gt,vt,o];t.layers.forEach((S,U)=>{e.add("step",m,x(1536),{wo:S.qkv.wo,so:S.qkv.so,lg:S.n1w,lb:S.n1b},C(i,s)),e.add("step",ut,[K,8],{ko:U*k},[s,w,b,u,o]),e.add("step",M,x(512),{wo:S.out.wo,so:S.out.so},C(y,i,{part:u})),e.add("step",p,x(2048),{wo:S.fc1.wo,so:S.fc1.so,lg:S.n2w,lb:S.n2b},C(i,a)),e.add("step",$,x(512),{wo:S.fc2.wo,so:S.fc2.so},C(a,i))}),e.add("step",P,x(512),{wo:t.flow.cond.wo,bo:t.flow.cond.bo,lg:t.top.outNormW,lb:t.top.outNormB},C(i,l,{aux:c})),e.add("step",O,x(t.flow.ada.rows),{wo:t.flow.ada.wo,bo:t.flow.ada.bo},C(l,f)),e.add("step",lt,[2],{wo:t.flow.inproj.wo,bo:t.flow.inproj.bo},[g,r,v,o]),t.flow.blocks.forEach((S,U)=>{e.add("step",D,x(512),{wo:S.fc1.wo,bo:S.fc1.bo,lg:S.lw,lb:S.lb,sh:U*1536,sc:U*1536+512},C(v,d,{md:f})),e.add("step",I,x(512),{wo:S.fc2.wo,bo:S.fc2.bo,ga:U*1536+1024},C(d,v,{md:f}))});const qe=t.flow.blocks.length*1536;e.add("step",ie,x(32),{wo:t.flow.final.wo,bo:t.flow.final.bo,sh:qe,sc:qe+512},C(v,g,{md:f})),e.add("step",ct,[1],{wo:t.top.inLinear.wo,lg:t.top.eosW,lb:t.top.eosB,sh:t.top.cond,a0:ze(this.o.eosThreshold)},[g,c,r,i,this.LATS,o]);const{ROWS:ae,PH:ue,PQKV:Ee,PQ:Te,PATT:Ue,PFF:Be}=this,je=e.pipe("lm-pln",_.ln,He({sg:q})),le=(S,U)=>e.pipe(`lm-p${S}`,_.gemm,Xe({wmode:"q8",rowsFromState:!0,...U})),ft=le("qkv",{K:512,N:1536}),ht=le("out",{K:512,N:512,res:"addy"}),dt=le("fc1",{K:512,N:2048,act:"gelu"}),pt=le("fc2",{K:2048,N:512,res:"addy"}),wt=e.pipe("lm-prope",_.rope,er()),mt=e.pipe("lm-pattn",_.pattn,Qt({sg:q})),$t=e.pipe("lm-padv",_.padv,rr()),ce=S=>U=>[Math.ceil(S/64),Math.ceil(U/64)],me=S=>[S];t.layers.forEach((S,U)=>{e.add("prompt",je,me,{lg:S.n1w,lb:S.n1b},[ae,r,ue,o]),e.add("prompt",ft,ce(1536),{arow:512,wo:S.qkv.wo,so:S.qkv.so},[ue,r,Ee,y,o]),e.add("prompt",wt,me,{ko:U*k},[Ee,Te,w,b,o]),e.add("prompt",mt,$e=>[$e,8],{ko:U*k},[Te,w,b,Ue,o]),e.add("prompt",ht,ce(512),{arow:512,wo:S.out.wo,so:S.out.so},[Ue,r,ae,y,o]),e.add("prompt",je,me,{lg:S.n2w,lb:S.n2b},[ae,r,ue,o]),e.add("prompt",dt,ce(2048),{arow:512,wo:S.fc1.wo,so:S.fc1.so},[ue,r,Be,y,o]),e.add("prompt",pt,ce(512),{arow:2048,wo:S.fc2.wo,so:S.fc2.so},[Be,r,ae,y,o])}),e.add("prompt",$t,[1],{},[o])}setLists(e){this.stepList=e.step,this.promptList=e.prompt}encodeSteps(e,t){be(e,this.stepList,t)}encodePrompt(e,t){be(e,this.promptList,1,t)}stateWords({pos:e,rows:t=0,seed:r=0,temperature:o=.3,after:i=1,limit:s=ye}){const a=new Uint32Array(fe);return a[j.pos]=e,a[j.rows]=t,a[j.seed]=r>>>0,a[j.scale]=ze(Math.sqrt(o)),a[j.after]=i,a[j.limit]=s,a}inputRow(e,t){const r=this.w.host.inLinear,o=new Float32Array(T);for(let i=0;i<T;i++){let s=t[i];for(let a=0;a<32;a++)s+=r[i*32+a]*e[a];o[i]=s}return o}}const V=[1,2,4,8],Oe=8,X=1920,R=512,ge=ke;class cr{constructor(e,t,{subgroups:r}){this.lm=e,this.cw=t,this.subgroups=r;const{device:o}=e,i=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,s=16*Oe,a=(c,l,f,g)=>({name:c,ctx:l,rate:f,ch:g,buf:o.createBuffer({size:(l+f*s)*g*4,usage:i,label:c})});this.tr=a("tr",6,1,512),this.s0=a("s0",1,1,512),this.s1=a("s1",2,6,256),this.s1r=a("s1r",1,6,256),this.s2=a("s2",2,30,128),this.s2r=a("s2r",1,30,128),this.s3=a("s3",2,120,64),this.s3r=a("s3r",2,120,64),this.ctxStages=[this.tr,this.s0,this.s1,this.s1r,this.s2,this.s2r,this.s3,this.s3r],this.s1h=a("s1h",0,6,128),this.s2h=a("s2h",0,30,64),this.s3h=a("s3h",0,120,32);const u=(c,l)=>o.createBuffer({size:c*4,usage:i,label:l});this.H=u(s*R,"codec-h"),this.QKV=u(s*3*R,"codec-qkv"),this.Q=u(s*R,"codec-q"),this.ATT=u(s*R,"codec-att"),this.FF=u(s*2048,"codec-ff"),this.KR=u(t.layers.length*ge*R,"codec-kring"),this.VR=u(t.layers.length*ge*R,"codec-vring"),this.audio=u(Oe*X,"audio")}addLists(e){const{lm:t,cw:r}=this,o=this.subgroups,i={gemm:e.layout("gemm",["ro","ro","rw","ro","ro"]),ln:e.layout("ln",["ro","ro","rw","ro"]),cin:e.layout("cin",["ro","ro","rw","ro"]),rope:e.layout("rope",["ro","rw","rw","rw","ro"]),attn:e.layout("cattn",["ro","ro","ro","rw","ro"]),shift:e.layout("shift",this.ctxStages.map(()=>"rw"))},{W:s,st:a}=t,u=t.DR,c=w=>e.pipe(`codec-gemm-${JSON.stringify(w)}`,i.gemm,Xe({gate:!0,...w})),l=e.pipe("codec-ln",i.ln,He({sg:o,gate:!0})),f=e.pipe("codec-in",i.cin,or()),g=e.pipe("codec-rope",i.rope,tr()),v=e.pipe("codec-attn",i.attn,Ht({sg:o})),d=(w,b)=>[Math.ceil(b/64),Math.ceil(w/64)];for(const w of V){const b=16*w,y=`codec${w}`,A=this.tr.ctx*R;e.add(y,f,[Math.ceil(b*R/256)],{M:b,wo:r.quant.wo,lg:r.embStd,lb:r.embMean,bo:r.up,yb:A},[t.LATS,s,this.tr.buf,a]),r.layers.forEach((m,M)=>{const p=M*ge*R;e.add(y,l,[b],{ab:A,lg:m.n1w,lb:m.n1b},[this.tr.buf,s,this.H,a]),e.add(y,c({K:512,N:1536}),d(b,1536),{M:b,arow:512,wo:m.qkv.wo},[this.H,s,this.QKV,u,a]),e.add(y,g,[b],{M:b,ko:p},[this.QKV,this.Q,this.KR,this.VR,a]),e.add(y,v,[b,8],{ko:p},[this.Q,this.KR,this.VR,this.ATT,a]),e.add(y,c({K:512,N:512,res:"ls"}),d(b,512),{M:b,arow:512,wo:m.out.wo,yb:A,lso:m.ls1},[this.ATT,s,this.tr.buf,u,a]),e.add(y,l,[b],{ab:A,lg:m.n2w,lb:m.n2b},[this.tr.buf,s,this.H,a]),e.add(y,c({K:512,N:2048,act:"gelu"}),d(b,2048),{M:b,arow:512,wo:m.fc1.wo},[this.H,s,this.FF,u,a]),e.add(y,c({K:2048,N:512,res:"ls"}),d(b,512),{M:b,arow:2048,wo:m.fc2.wo,yb:A,lso:m.ls2},[this.FF,s,this.tr.buf,u,a])});const q={buf:this.audio,ctx:0},_=(m,M,p,{cin:$,cout:P,k:O,elu:D,res:I})=>{const ie=(M===q?m.rate:M.rate)*b;e.add(y,c({K:O*$,N:P,eluA:D,bias:!0,res:I?"add":"none"}),d(ie,P),{M:ie,ab:(m.ctx-(O-1))*$,arow:$,wo:p.wo,bo:p.bo,yb:M.ctx*P,rb:I?I.ctx*P:0},[m.buf,s,M.buf,I?I.buf:u,a])},x=(m,M,p,{cin:$,cout:P,s:O})=>{const D=m.rate*b;e.add(y,c({K:2*$,N:P,phases:O,eluA:!0,bias:!0}),[...d(D,P),O],{M:D,ab:(m.ctx-1)*$,arow:$,wo:p.wo,wph:p.wph,bo:p.bo,yb:M.ctx*P},[m.buf,s,M.buf,u,a])},k=r.seanet;_(this.tr,this.s0,k.init,{cin:512,cout:512,k:7,elu:!1}),x(this.s0,this.s1,k.up[0],{cin:512,cout:256,s:6}),_(this.s1,this.s1h,k.res[0][0],{cin:256,cout:128,k:3,elu:!0}),_(this.s1h,this.s1r,k.res[0][1],{cin:128,cout:256,k:1,elu:!0,res:this.s1}),x(this.s1r,this.s2,k.up[1],{cin:256,cout:128,s:5}),_(this.s2,this.s2h,k.res[1][0],{cin:128,cout:64,k:3,elu:!0}),_(this.s2h,this.s2r,k.res[1][1],{cin:64,cout:128,k:1,elu:!0,res:this.s2}),x(this.s2r,this.s3,k.up[2],{cin:128,cout:64,s:4}),_(this.s3,this.s3h,k.res[2][0],{cin:64,cout:32,k:3,elu:!0}),_(this.s3h,this.s3r,k.res[2][1],{cin:32,cout:64,k:1,elu:!0,res:this.s3}),_(this.s3r,q,k.final,{cin:64,cout:1,k:3,elu:!0});const h=e.pipe(`codec-shift${w}`,i.shift,nr(this.ctxStages,b));e.add(y,h,[Math.ceil(Math.max(...this.ctxStages.map(m=>m.ctx*m.ch))/256)],{},this.ctxStages.map(m=>m.buf))}}setLists(e){this.lists=Object.fromEntries(V.map(t=>[t,e[`codec${t}`]]))}reset(e){for(const t of this.ctxStages)e.clearBuffer(t.buf,0,t.ctx*t.ch*4)}encode(e,t){be(e,this.lists[t])}dispatchesPerChunk(e){return this.lists[e].length}}const fr={sample_rate:24e3,frame_rate:12.5,dimension:512,quantizer_dimension:32,quantizer_output_dimension:512,n_filters:64,n_residual_layers:1,kernel_size:7,last_kernel_size:3,residual_kernel_size:3,dilation_base:2,compress:2,transformer_d_model:512,transformer_num_heads:8,transformer_num_layers:2,transformer_context:250,transformer_max_period:1e4,transformer_dim_feedforward:2048};function Je(n){const e=n?.flow_lm,t=n?.mimi;if(!e||!t)return"the config has no flow_lm or mimi section";const r=n.model_id?"erf":"tanh",o=[[(e.gelu??r)!=="erf",`the flow LM's ${e.gelu??r} GELU (only the exact, erf, GELU is written)`],[(t.gelu??r)!=="erf",`the Mimi decoder's ${t.gelu??r} GELU (only the exact, erf, GELU is written)`],[(e.flow_type??"lsd")!=="lsd",`the ${e.flow_type} flow head (only LSD is written)`],[(n.lsd_decode_steps??1)!==1,`lsd_decode_steps ${n.lsd_decode_steps} (only one solver step is written)`],[e.d_model!==512,`a flow LM of width ${e.d_model} (512 is written)`],[e.num_heads!==8,`${e.num_heads} attention heads (8 are written)`],[e.num_kv_heads!==void 0&&e.num_kv_heads!==e.num_heads,`grouped-query attention (num_kv_heads ${e.num_kv_heads})`],[e.attn_dim!==void 0&&e.attn_dim!==e.d_model,`attn_dim ${e.attn_dim}`],[e.z_dim!==void 0,`a z_proj (z_dim ${e.z_dim})`],[e.dim_feedforward!==2048,`a feed-forward width of ${e.dim_feedforward} (2048 is written)`],[e.flow_dim!==512,`a flow net of width ${e.flow_dim} (512 is written)`],[e.ldim!==32,`${e.ldim}-wide latents (32 are written)`],[e.lut_dim!==e.d_model,`a low-rank text table (lut_dim ${e.lut_dim})`],[e.max_period!==1e4,`a RoPE period of ${e.max_period} (10000 is written)`],[!(e.num_layers>=1),`${e.num_layers} flow-LM layers`],[!(e.flow_depth>=1),`a flow net of depth ${e.flow_depth}`],[(n.prefix_sinks?.length??0)>0,"prefix sinks"],[(n.audio_delay??0)!==0,`an audio delay of ${n.audio_delay} frames`],[(n.voices?.length??0)>0,"baked-in voices"],[t.decoder_dimension!==void 0&&t.decoder_dimension!==t.dimension,`a Mimi decoder of width ${t.decoder_dimension}`],[JSON.stringify(t.ratios)!=="[6,5,4]",`Mimi ratios ${JSON.stringify(t.ratios)} ([6, 5, 4] are written)`],[!(t.transformer_layer_scale>0),"a Mimi transformer without layer scale"]];for(const[i,s]of o)if(i)return`the WebGPU engine does not run ${s}`;for(const[i,s]of Object.entries(fr))if(t[i]!==s)return`the WebGPU engine does not run this Mimi decoder (${i} ${t[i]}, ${s} is written)`;return null}const hr=8;function dr(n,e){for(let t=0;t<e.flow_lm.num_layers;t++)for(const r of["self_attn.in_proj","self_attn.out_proj","linear1","linear2"]){const o=`flow_lm.transformer.layers.${t}.${r}.weight`,i=n.tensors.get(o);if(!i)return`the weights have no tensor ${o}`;if(i.type!==hr)return`the WebGPU engine reads q8_0 weights, and ${o} has ggml type ${i.type}`}return null}function pr(n){if(!n.features.has("subgroups"))return{subgroups:!1,reason:"the adapter has no subgroups"};const{subgroupMinSize:e,subgroupMaxSize:t}=n.info??{};return e!==32||t!==32?{subgroups:!1,reason:`the adapter's subgroups are ${e??"?"} to ${t??"?"} wide, not 32`}:{subgroups:!0,reason:"32-wide subgroups"}}function wr(n){const e=BigInt.asUintN(64,BigInt(n));return Number(BigInt.asUintN(32,e^e>>32n))}const G=512,Ze=3,oe=fe*4,mr=oe+V[V.length-1]*X*4;class Ae{static async create(e,{gguf:t,config:r,conditions:o,subgroups:i}){const s=Je(r);if(s)throw new Error(s);const a=Ke(t),u=dr(a,r);if(u)throw new Error(u);const c=Ft(a,r),l=c.blob.finish(),f=e.limits.maxStorageBufferBindingSize;if(l.byteLength>f)throw new Error(`the weights take ${l.byteLength} bytes on the GPU, more than the ${f} one storage binding allows here`);const g=e.createBuffer({label:"weights",size:l.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(g,0,l),e.queue.writeBuffer(g,c.top.cond*4,o);const v=new _e(e,c,g,{subgroups:i,eosThreshold:r.eos_threshold??4,layers:r.flow_lm.num_layers}),d=new cr(v,c.codec,{subgroups:i}),w=new lr(e);v.addLists(w),d.addLists(w);const b=await w.build();return v.setLists(b),d.setLists(b),new Ae(e,c,v,d,o)}constructor(e,t,r,o,i){this.device=e,this.w=t,this.lm=r,this.codec=o,this.x0=r.inputRow(t.host.bos,i),this.voices=[],this.readbacks=Array.from({length:Ze},()=>e.createBuffer({label:"readback",size:mr,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}))}#e=Promise.resolve();#t(e){const t=this.#e.then(e);return this.#e=t.catch(()=>{}),t}get dispatches(){return{step:this.lm.stepList.length,prompt:this.lm.promptList.length,codecChunk:this.codec.dispatchesPerChunk(8)}}addVoice(e){return this.#t(()=>this.#r(e))}async#r(e){const{lm:t,device:r}=this,o=e.frames;if(o>z)throw new Error(`the voice prompt has ${o} frames, more than the ${z} the WebGPU engine takes`);if(e.kind==="kv"){if(e.k.length!==t.layers||e.v.length!==t.layers)throw new Error(`the voice's KV cache has ${e.k.length} key and ${e.v.length} value layers, the model ${t.layers}`);for(const a of[...e.k,...e.v])if(a.length!==o*G)throw new Error(`the voice's KV cache has ${a.length} values in a layer, not ${o} frames of ${G}`)}const i=o*G*2,s=r.createBuffer({label:"voice",size:Math.max(16,2*t.layers*i),usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});if(e.kind==="kv")for(let a=0;a<t.layers;a++)r.queue.writeBuffer(s,2*a*i,Ce(e.k[a],o*G)),r.queue.writeBuffer(s,(2*a+1)*i,Ce(e.v[a],o*G));else{r.queue.writeBuffer(t.ROWS,0,e.rows),r.queue.writeBuffer(t.st,0,t.stateWords({pos:0,rows:o}));const a=r.createCommandEncoder(),u=a.beginComputePass();t.encodePrompt(u,o),u.end();const c=_e.layerBytes();for(let l=0;l<t.layers;l++)a.copyBufferToBuffer(t.KC,l*c,s,2*l*i,i),a.copyBufferToBuffer(t.VC,l*c,s,(2*l+1)*i,i);r.queue.submit([a.finish()])}return await r.queue.onSubmittedWorkDone(),this.voices.push({kv:s,frames:o}),this.voices.length-1}speakChunk(e,{voice:t,seed:r,temperature:o,onAudio:i,cancelled:s=()=>!1}){return this.#t(()=>this.#o(e,{voice:t,seed:r,temperature:o,onAudio:i,cancelled:s}))}async#o(e,{voice:t,seed:r,temperature:o,onAudio:i,cancelled:s}){const{device:a,lm:u}=this,c=this.voices[t];if(!c)throw new Error(`unknown voice index ${t}`);const l=e.tokens.length;if(l>z)throw new Error(`a chunk of ${l} tokens is more than the ${z} the WebGPU engine prompts at once`);const f=Math.min(e.frameBudget,ye,re-c.frames-l-1),g=this.w.host.embed,v=new Float32Array(Math.max(1,l)*G);return e.tokens.forEach((d,w)=>v.set(g.subarray(d*G,d*G+G),w*G)),a.queue.writeBuffer(u.ROWS,0,v),a.queue.writeBuffer(u.X,0,this.x0),a.queue.writeBuffer(u.st,0,u.stateWords({pos:c.frames,rows:l,seed:r,temperature:o,after:e.framesAfterEos,limit:f})),new $r(this,{voice:c,tokens:l,maxFrames:f,onAudio:i,cancelled:s}).run()}}class $r{issued=0;decodes=0;keep=null;delivered=0;flight=[];constructor(e,{voice:t,tokens:r,maxFrames:o,onAudio:i,cancelled:s}){this.engine=e,this.voice=t,this.tokens=r,this.maxFrames=o,this.onAudio=i,this.cancelled=s,this.free=[...e.readbacks]}async run(){let e=this.cancelled();try{for(;;){const t=this.keep??this.maxFrames;for(;!e&&this.flight.length<Ze&&this.issued<t;)this.#e();const r=this.flight[0];if(!r)break;await r.mapped,!e&&this.cancelled()&&(e=!0);const o=this.#o(r,!e);o&&(this.delivered+=o.length/X,this.onAudio(o))}}finally{for(const t of this.flight)t.buffer.mapState!=="unmapped"&&t.buffer.unmap()}return{frames:this.delivered,cancelled:e}}#e(){const{device:e,lm:t,codec:r}=this.engine,o=this.issued,i=this.#r(),s=oe+i*X*4,a=this.free.pop(),u=e.createCommandEncoder();this.decodes===0&&this.#t(u);const c=u.beginComputePass();this.decodes===0&&this.tokens>0&&t.encodePrompt(c,this.tokens),t.encodeSteps(c,i),r.encode(c,i),c.end(),u.copyBufferToBuffer(t.st,0,a,0,oe),u.copyBufferToBuffer(r.audio,0,a,oe,i*X*4),e.queue.writeBuffer(t.st,j.cpos*4,new Uint32Array([o])),e.queue.submit([u.finish()]);const l=a.mapAsync(GPUMapMode.READ,0,s);l.catch(()=>{}),this.flight.push({buffer:a,mapped:l,first:o,frames:i,bytes:s}),this.issued+=i,this.decodes++}#t(e){const{lm:t,codec:r}=this.engine,{kv:o,frames:i}=this.voice,s=i*G*2,a=_e.layerBytes();if(s>0)for(let u=0;u<t.layers;u++)e.copyBufferToBuffer(o,2*u*s,t.KC,u*a,s),e.copyBufferToBuffer(o,(2*u+1)*s,t.VC,u*a,s);r.reset(e)}#r(){const e=V.filter(r=>this.issued+r<=this.maxFrames);if(this.keep!==null){const r=e.find(o=>this.issued+o>=this.keep);if(r!==void 0)return r}const t=V[Math.min(this.decodes,V.length-1)];return e.filter(r=>r<=t).at(-1)}#o(e,t){let r=null;try{if(t){const o=e.buffer.getMappedRange(0,e.bytes);this.#n(new Uint32Array(o,0,fe));const i=Math.min(e.frames,(this.keep??1/0)-e.first);i>0&&(r=new Float32Array(o,oe,i*X).slice())}}finally{e.buffer.unmap(),this.flight.shift(),this.free.push(e.buffer)}return r}#n(e){this.keep===null&&(e[j.end]!==0?this.keep=Math.min(e[j.end],this.maxFrames):e[j.stop]!==0&&(this.keep=Math.min(e[j.frame],this.maxFrames)))}}function Ce(n,e){const t=new Uint16Array(e+(e&1));for(let r=0;r<e;r++)t[r]=ve(n[r]);return new Uint32Array(t.buffer)}let E=null,we=0,ne=null;const J=new Map,Y=new Set,Z=(n,e=[])=>self.postMessage(n,e),et=new MessageChannel,tt=[];et.port1.onmessage=()=>tt.shift()?.();const gr=()=>new Promise(n=>{tt.push(n),et.port2.postMessage(null)}),vr=Et();function rt(n,e,t){return vr?n?{module_or_path:n}:void 0:{module_or_path:e??t}}async function br(n){const e=Pt({requested:n.threads,isolated:self.crossOriginIsolated===!0,hardwareConcurrency:navigator.hardwareConcurrency});let t=e.reason;if(e.threads>1)try{const r=await import("./phonon_tts-qUMAJ39j.js");await r.default(rt(n.threadsWasmUrl,n.threadsSimdWasmUrl,new URL("/Logos/assets/phonon_tts_simd_bg-DLYaXM1L.wasm",import.meta.url)));const o=e.threads-1;return await r.initThreadPool(o),{wasm:r,threads:r.start_cpu_pool(o),reason:t}}catch(r){t=`threads failed to start: ${r instanceof Error?r.message:r}`}return{wasm:await ot(n),threads:1,reason:t}}async function ot(n){const e=await import("./phonon_tts-MjYw3Otn.js");try{await e.default(rt(n.wasmUrl,n.simdWasmUrl,new URL("/Logos/assets/phonon_tts_simd_bg-BZBr1l8C.wasm",import.meta.url)))}catch(t){throw t instanceof WebAssembly.CompileError?new Error(`this browser cannot run phonon-tts: it needs WebAssembly SIMD (${t.message})`):t}return e}async function yr(){try{const n=await navigator.gpu?.requestAdapter({powerPreference:"high-performance"});return n?{hasWebGpu:!0,adapter:n,fallbackAdapter:!!(n.info?.isFallbackAdapter??n.isFallbackAdapter)}:{hasWebGpu:!1}}catch{return{hasWebGpu:!1}}}async function _r(n,e){ne=e;const{model:t,quant:r}=e,i=e.device==="webgpu"||e.device==="auto"?await yr():{hasWebGpu:!1};let s=xt({requested:e.device,quant:r,hasWebGpu:i.hasWebGpu,fallbackAdapter:i.fallbackAdapter});if(s.device==="webgpu"&&!i.hasWebGpu)throw new Error("this browser offers no WebGPU adapter");const a=t.weights[r];if(!a)throw new Error(`this model has no '${r}' weights`);const u=x=>k=>Z({type:"progress",id:n,file:x,...k}),c={},l=(x,k)=>c[x]??=Me(k,u(x)),f=()=>l("weights",a),g=()=>l("tokenizer",t.tokenizer),v=()=>l("config",t.config);if(s.device==="webgpu"){const x=nt((await v()).bytes),k=St({requested:e.device,choice:s,unsupported:Je(x)});if("error"in k)throw new Error(k.error);k.warning&&console.warn(`[phonon-tts] ${k.warning}`),s=k}if(s.device==="webgpu"){let x=null;try{x=await kr(e,i.adapter,{weights:f,tokenizer:g,config:v},s.reason)}catch(k){if(e.device==="webgpu")throw k;const h=`WebGPU failed to start: ${k instanceof Error?k.message:k}`;console.warn(`[phonon-tts] ${h}; generating on the CPU instead`),s={device:"cpu",reason:h},E=null}if(x)return await Re(e,u),x}const{wasm:d,threads:w,reason:b}=await br(e),y=await Promise.all([f(),g(),v()]),[A,q,_]=y.map(x=>x.bytes);E=await d.Model.load(A,q,_,r,e.lang,e.rewrites,e.conditions,"cpu"),we=E.frame_size();for(const x of y)x.keep();return await Re(e,u),{sampleRate:E.sample_rate(),features:d.cpu_features(),device:"cpu",languages:E.languages(),deviceReason:s.reason,threads:w,threadsReason:b}}async function Re(n,e){for(const t of n.preload)await Pe(t,e(`voice:${t}`))}function nt(n){try{return JSON.parse(new TextDecoder().decode(n))}catch(e){throw new Error(`cannot parse config.json: ${e instanceof Error?e.message:e}`)}}async function kr(n,e,t,r){const o=await ot(n),i=pr(e),s=await e.requestDevice({requiredFeatures:i.subgroups?["subgroups"]:[]});s.lost.then(u=>{u.reason!=="destroyed"&&console.error(`[phonon-tts] the WebGPU device was lost: ${u.message}`)});let a=null;try{const u=await Promise.all([t.weights(),t.tokenizer(),t.config()]),[c,l,f]=u.map(y=>y.bytes);if(!At(c))throw new Error("WebGPU needs q8 weights in a GGUF file");const g="flow_lm.condition_provider.conditioners.",v=Ut(Ke(c),[g],[`${g}transcript_in_segment.`]);a=new o.Preparer(l,f,v,n.lang,n.rewrites,n.conditions),s.pushErrorScope("validation");const d=await Ae.create(s,{gguf:c,config:nt(f),conditions:new Float32Array(a.conditions()),subgroups:i.subgroups}),w=await s.popErrorScope();if(w)throw new Error(`WebGPU rejected the engine: ${w.message}`);const b={sampleRate:a.sample_rate(),features:o.cpu_features(),device:"webgpu",languages:a.languages(),deviceReason:r,threads:1,threadsReason:"generation runs on the GPU"};E={gpu:!0,preparer:a,engine:d,device:s},we=a.frame_size();for(const y of u)y.keep();return b}catch(u){throw a?.free(),s.destroy(),u}}async function Me(n,e){let t=!1;const r=await _t(n,{cache:ne.cache,write:!1,onProgress:i=>{t=i.cached,e?.(i)}});return{bytes:r,keep:()=>{if(!ne.cache||t)return;const i=r.byteLength===r.buffer.byteLength?r.buffer:r.slice().buffer;Z({type:"store",url:n,bytes:i},[i])}}}function Pe(n,e){let t=J.get(n);if(t===void 0){const r=ne.model.voices[n];if(!r){const o=[...new Set([...Object.keys(ne.model.voices),...J.keys()])];return Promise.reject(new Error(`unknown voice '${n}'; known: ${o.join(", ")}`))}t=Me(r,e).then(async({bytes:o,keep:i})=>{const s=await st(o);return i(),s}).catch(o=>{throw J.delete(n),o}),J.set(n,t)}return Promise.resolve(t)}async function xr(n,e){const{bytes:t,keep:r}=typeof e=="string"?await Me(e):{bytes:new Uint8Array(e),keep(){}},o=st(t);J.set(n,o);try{await o,r()}catch(i){throw J.delete(n),i}}async function st(n){if(E.gpu)return E.engine.addVoice(E.preparer.voice(n));const e=E.add_voice(n);return await E.flush(),e}async function Sr(n,e){return E.gpu?Ar(n,e):Mr(n,e)}function it(n){return{chunks:n,tokens:0,frames:0,samples:0,promptMs:0,stepMs:{avg:0,min:0,max:0},firstAudioMs:null,totalMs:0,cancelled:!1}}function at(n){let e=0,t=1/0;return{add(r,o){const i=r/o;e+=r,t=Math.min(t,i),n.stepMs.max=Math.max(n.stepMs.max,i)},finish(){n.frames>0&&(n.stepMs.avg=e/n.frames,n.stepMs.min=t)}}}async function Ar(n,{text:e,voice:t,temperature:r,seed:o}){const i=await Pe(t),s=performance.now(),a=E.preparer.plan(e),u=it(a.length),c=at(u),l=wr(o);try{for(let f=0;f<a.length;f++){if(Y.has(n)){u.cancelled=!0;break}const g=a[f];u.tokens+=g.tokens.length;let v=performance.now();if((await E.engine.speakChunk(g,{voice:i,seed:(l^Math.imul(f+1,2654435769))>>>0,temperature:r,cancelled:()=>Y.has(n),onAudio:w=>{const b=performance.now(),y=Math.max(1,Math.round(w.length/we));c.add(b-v,y),v=b,u.frames+=y,u.samples+=w.length,u.firstAudioMs??=b-s,Z({type:"chunk",id:n,pcm:w},[w.buffer])}})).cancelled){u.cancelled=!0;break}}}finally{Y.delete(n)}return c.finish(),u.totalMs=performance.now()-s,u}async function Mr(n,{text:e,voice:t,temperature:r,seed:o}){const i=await Pe(t),s=performance.now(),a=E.start_generation(i,e,r,o),u=it(a),c=at(u);try{e:for(;;){if(Y.has(n)){u.cancelled=!0;break}const l=performance.now(),f=E.next_chunk();if(f===void 0)break;for(u.tokens+=f,u.promptMs+=performance.now()-l;;){if(Y.has(n)){u.cancelled=!0;break e}const g=performance.now(),v=await E.generation_step();if(v===void 0)break;const d=Math.max(1,Math.round(v.length/we));c.add(performance.now()-g,d),u.frames+=d,u.samples+=v.length,u.firstAudioMs??=performance.now()-s,Z({type:"chunk",id:n,pcm:v},[v.buffer]),await gr()}}}finally{try{E.stop_generation()}catch{}Y.delete(n)}return c.finish(),u.totalMs=performance.now()-s,u}self.onmessage=async({data:n})=>{const{type:e,id:t}=n;if(e==="cancel"){Y.add(t);return}try{let r;if(e==="init")r=await _r(t,n.options);else if(e==="add_voice")r=await xr(n.name,n.source);else if(e==="generate")r=await Sr(t,n);else throw new Error(`unknown message type '${e}'`);Z({type:"result",id:t,value:r})}catch(r){Z({type:"error",id:t,message:r instanceof Error?r.message:String(r)})}};
