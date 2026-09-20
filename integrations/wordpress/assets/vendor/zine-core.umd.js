(function(e,t){typeof exports==`object`&&typeof module<`u`?t(exports):typeof define==`function`&&define.amd?define([`exports`],t):(e=typeof globalThis<`u`?globalThis:e||self,t(e.ZineJS={}))})(this,function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t=Object.defineProperty,n=(e,t,n)=>()=>{if(n)throw n[0];try{return e&&(t=e(e=0)),t}catch(e){throw n=[e],e}},r=(e,n)=>{let r={};for(var i in e)t(r,i,{get:e[i],enumerable:!0});return n||t(r,Symbol.toStringTag,{value:`Module`}),r};function i(e,t={}){let{direction:n=`ltr`,mode:r=`cover`}=t;if(e<=0)return[];let i=t=>t>=0&&t<e?t:null,a=[];if(r===`single`)for(let t=0;t<e;t++)a.push({left:null,right:t});else if(r===`double`)for(let t=0;t<e;t+=2)a.push({left:i(t),right:i(t+1)});else if(r===`cover`){a.push({left:null,right:0});for(let t=1;t<e;t+=2)a.push({left:i(t),right:i(t+1)})}else if(a.push({left:null,right:0}),e>1){for(let t=1;t<=e-2;t+=2)a.push({left:i(t),right:t+1<=e-2?i(t+1):null});a.push({left:e-1,right:null})}return n===`rtl`?a.map(e=>({left:e.right,right:e.left})):a}function a(e,t){return e<t}function o(e,t,n){let r=[],i=Math.max(0,e-n),a=Math.min(t-1,e+n);for(let e=i;e<=a;e++)r.push(e);return r}var s=class{#e;#t=new Set;constructor(e=2){this.#e=e}get mounted(){return[...this.#t].sort((e,t)=>e-t)}update(e,t){let n=new Set(o(e,t,this.#e)),r=[...n].filter(e=>!this.#t.has(e)).sort((e,t)=>e-t),i=[...this.#t].filter(e=>!n.has(e)).sort((e,t)=>e-t);for(let e of i)this.#t.delete(e);for(let e of r)this.#t.add(e);return{toMount:r,toEvict:i}}},c=class{#e=new Map;on(e,t){let n=this.#e.get(e);return n||(n=new Set,this.#e.set(e,n)),n.add(t),()=>this.off(e,t)}off(e,t){this.#e.get(e)?.delete(t)}emit(e,...t){let n=t[0],r=this.#e.get(e);if(r)for(let e of[...r])e(n)}clear(){this.#e.clear()}},l={idle:{grab:`dragging`,panStart:`zoomed-panning`,flip:`animating`},dragging:{release:`animating`},animating:{settle:`idle`},"zoomed-panning":{panEnd:`idle`}};function u(e,t){return l[e][t]??null}var d=class{#e;constructor(e=`idle`){this.#e=e}get state(){return this.#e}send(e){let t=u(this.#e,e);return t!==null&&(this.#e=t),t}},f=.3,p=class{#e;#t=null;#n=null;#r=null;#i=null;constructor(e={}){this.#e=e}get active(){return this.#t!==null}down(e,t,n,r){if(this.#t!==null)return;this.#t=e;let i={x:t,y:n,t:r};this.#n=i,this.#r=i,this.#i=i,this.#e.onStart?.({x:t,y:n,t:r})}move(e,t,n,r){e!==this.#t||this.#n===null||(this.#r=this.#i,this.#i={x:t,y:n,t:r},this.#e.onMove?.({x:t,y:n,dx:t-this.#n.x,dy:n-this.#n.y}))}up(e,t,n,r){this.#a(e,t,n,r,!1)}cancel(e,t,n,r){this.#a(e,t,n,r,!0)}#a(e,t,n,r,i){if(e!==this.#t||this.#n===null)return;let a=this.#n,o=this.#i??a,s=this.#r??a,c=o.t-s.t,l=c>0?(o.x-s.x)/c:0,u=c>0?(o.y-s.y)/c:0,d=Math.hypot(l,u);this.#o(),this.#e.onEnd?.({x:t,y:n,dx:t-a.x,dy:n-a.y,dt:r-a.t,vx:l,vy:u,swipe:!i&&d>f,canceled:i})}#o(){this.#t=null,this.#n=null,this.#r=null,this.#i=null}};function m(e,t){let{pointer:n,pinch:r}=t,i=e=>{let t=e;n?.down(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.down(t.pointerId,t.clientX,t.clientY)},a=e=>{let t=e;n?.move(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.move(t.pointerId,t.clientX,t.clientY)},o=e=>{let t=e;n?.up(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.up(t.pointerId)},s=e=>{let t=e;n?.cancel(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.cancel(t.pointerId)};return e.addEventListener(`pointerdown`,i),e.addEventListener(`pointermove`,a),e.addEventListener(`pointerup`,o),e.addEventListener(`pointercancel`,s),()=>{e.removeEventListener(`pointerdown`,i),e.removeEventListener(`pointermove`,a),e.removeEventListener(`pointerup`,o),e.removeEventListener(`pointercancel`,s)}}function h(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}var g=class{#e;#t=new Map;#n=0;#r=!1;constructor(e={}){this.#e=e}get pinching(){return this.#r}down(e,t,n){if(!(this.#t.has(e)||this.#t.size>=2)&&(this.#t.set(e,{x:t,y:n}),this.#t.size===2)){let{a:e,b:t}=this.#a();this.#n=h(e,t),this.#r=!0,this.#e.onPinchStart?.({centerX:(e.x+t.x)/2,centerY:(e.y+t.y)/2,distance:this.#n})}}move(e,t,n){let r=this.#t.get(e);if(!r||(r.x=t,r.y=n,!this.#r))return;let{a:i,b:a}=this.#a();this.#e.onPinchMove?.({centerX:(i.x+a.x)/2,centerY:(i.y+a.y)/2,scale:this.#n>0?h(i,a)/this.#n:1})}up(e){this.#i(e)}cancel(e){this.#i(e)}#i(e){this.#t.delete(e)&&this.#r&&this.#t.size<2&&(this.#r=!1,this.#n=0,this.#e.onPinchEnd?.())}#a(){let e=[...this.#t.values()],t=e[0],n=e[1];if(!t||!n)throw Error(`Zine: pinch requires two active pointers.`);return{a:t,b:n}}},_=`page`,v=!1;function y(){return v?!1:(v=!0,!0)}function b(){v=!1}function x(e){let t=new URLSearchParams(e.replace(/^#/,``)).get(_);if(t===null)return null;let n=Number(t);return Number.isInteger(n)&&n>=1?n-1:null}function S(e,t){let n=new URLSearchParams(e.replace(/^#/,``));return n.set(_,String(t+1)),`#${n.toString()}`}function C(e,t){let n=null,r=()=>{let r=x(e.location.hash);r===null||r===n||(n=r,t(r))};return e.addEventListener(`hashchange`,r),{push(t){if(t===n)return;n=t;let r=S(e.location.hash,t);r!==e.location.hash&&e.history?.replaceState?.(e.history.state,``,r)},stop(){e.removeEventListener(`hashchange`,r)}}}var w,T,ee,E=n((()=>{w=[`cone`,`simple`],T=[`roll`,`leaf`,`flick`,`silk`],ee=`cone`}));function te(e){let t=e<0?0:e>1?1:e,n=Math.sin(t*Math.PI);return{angle:t*Math.PI,curl:n,shadowAlpha:n}}var ne=n((()=>{})),re=r({CssRenderer:()=>se});function ie(e){return e.left===null==(e.right===null)?0:e.right===null?1:-1}function ae(e){let t=e===`forward`?`to right`:`to left`;return[`linear-gradient(${t}, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0) 60%)`,`linear-gradient(${t}, transparent 40%, rgba(255,255,255,0.32) 66%, transparent 90%)`,`linear-gradient(${t}, transparent 66%, rgba(0,0,0,0.35))`].join(`,`)}var oe,se,ce=n((()=>{ne(),oe=180/Math.PI,se=class{#e=null;#t;#n;#r;#i;#a;#o;#s;#c;#l;#u=0;#d=0;#f=0;#p=0;#m=`contain`;#h=0;#g=!1;#_=0;mount(e){let t=e.ownerDocument;return this.#e=e,this.#t=t.createElement(`div`),this.#t.className=`zine-clip`,this.#t.style.cssText=`position:relative;width:100%;height:100%;overflow:hidden;`,this.#n=t.createElement(`div`),this.#n.className=`zine-viewport`,this.#n.style.cssText=`position:absolute;inset:0;transform-origin:0 0;`,this.#r=t.createElement(`div`),this.#r.className=`zine-book`,this.#r.style.cssText=`position:absolute;inset:0;perspective:2000px;transform-style:preserve-3d;`,this.#i=this.#w(t,`zine-page-left`,`left:0;`),this.#a=this.#w(t,`zine-page-right`,`right:0;`),this.#o=t.createElement(`div`),this.#o.className=`zine-leaf`,this.#o.style.cssText=`position:absolute;top:0;width:50%;height:100%;transform-style:preserve-3d;display:none;`,this.#s=t.createElement(`canvas`),this.#s.className=`zine-leaf-front`,this.#s.style.cssText=`position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;`,this.#c=t.createElement(`canvas`),this.#c.className=`zine-leaf-back`,this.#c.style.cssText=`position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;transform:rotateY(180deg);`,this.#l=t.createElement(`div`),this.#l.className=`zine-leaf-shadow`,this.#l.style.cssText=`position:absolute;inset:0;opacity:0;pointer-events:none;`,this.#l.style.background=ae(`forward`),this.#o.append(this.#s,this.#c,this.#l),this.#r.append(this.#i,this.#a,this.#o),this.#n.append(this.#r),this.#t.append(this.#n),e.append(this.#t),Promise.resolve()}destroy(){this.#t?.remove(),this.#e=null}renderSpread(e,t,n){n?.fill?(this.#i.style.width=`100%`,this.#a.style.display=`none`,this.#T(this.#i,t.right??t.left)):(this.#i.style.width=`50%`,this.#a.style.display=``,this.#T(this.#i,t.left),this.#T(this.#a,t.right)),this.#g=n?.fill??!1,n?.fit&&(this.#m=n.fit),this.#_=this.#g?0:ie(t),this.#y(t),this.#x(),this.#v(this.#_),this.#o.style.display=`none`,this.#o.style.transform=``,this.#l.style.opacity=`0`}beginFlip(e,t,n,r){r?.fill?(this.#i.style.width=`100%`,this.#a.style.display=`none`,this.#o.style.width=`100%`,this.#o.style.left=`0`,this.#o.style.transformOrigin=n===`forward`?`left center`:`right center`,this.#T(this.#i,t.right??t.left),this.#T(this.#s,e.right??e.left),this.#T(this.#c,t.right??t.left)):(this.#i.style.width=`50%`,this.#a.style.display=``,this.#o.style.width=`50%`,n===`forward`?(this.#T(this.#i,e.left),this.#T(this.#a,t.right),this.#T(this.#s,e.right),this.#T(this.#c,t.left),this.#o.style.left=`50%`,this.#o.style.transformOrigin=`left center`):(this.#T(this.#a,e.right),this.#T(this.#i,t.left),this.#T(this.#s,e.left),this.#T(this.#c,t.right),this.#o.style.left=`0`,this.#o.style.transformOrigin=`right center`)),this.#u=r?.fill?0:ie(e),this.#d=r?.fill?0:ie(t),this.#g=r?.fill??!1,r?.fit&&(this.#m=r.fit),this.#y(t),this.#x(),this.#v(this.#u),this.#o.style.display=`block`,this.#o.style.transform=`rotateY(0deg)`,this.#l.style.background=ae(n),this.#l.style.opacity=`0`}setFlipProgress(e,t){let n=te(e),r=n.angle*oe;this.#v(this.#u+(this.#d-this.#u)*e),this.#o.style.display=`block`,this.#o.style.transform=`rotateY(${t===`forward`?-r:r}deg)`,this.#l.style.opacity=String(n.shadowAlpha)}#v(e){let t=e*(this.#h/4);this.#r.style.transform=t?`translateX(${t}px)`:``}#y(e){let t=e.left??e.right;t&&t.height&&(this.#f=t.width/t.height,this.#p===0&&(this.#p=this.#f))}#b(){return this.#m===`fill`&&this.#p>0?this.#p:this.#f}#x(){let e=this.#S();this.#h=e.width;let t=this.#r.style;t.inset=`auto`,t.left=`${e.x}px`,t.top=`${e.y}px`,t.width=`${e.width}px`,t.height=`${e.height}px`}#S(){let e=this.#e?.clientWidth??0,t=this.#e?.clientHeight??0,n=this.#b();if(n<=0||e<=0||t<=0)return{x:0,y:0,width:e,height:t};let r=(this.#g?1:2)*n,i=e,a=t;return r>e/t?a=e/r:i=t*r,{x:(e-i)/2,y:(t-a)/2,width:i,height:a}}#C(){let e=this.#S();return this.#_===0?e:{x:e.x+e.width/4,y:e.y,width:e.width/2,height:e.height}}setViewTransform(e,t,n){this.#n.style.transform=`translate(${t}px, ${n}px) scale(${e})`}measure(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#f>0,i=r?this.#S():void 0,a=r?this.#C():void 0,o=a?e=>({x:a.x*e,y:a.y*e,width:a.width*e,height:a.height*e}):void 0;return{containerWidth:t,containerHeight:n,pageWidth:t/2,pageHeight:n,book:i,content:a,screenAt:o,containerAspect:this.#p>0?(this.#g?1:2)*this.#p:void 0}}#w(e,t,n){let r=e.createElement(`canvas`);return r.className=t,r.style.cssText=`position:absolute;top:0;width:50%;height:100%;${n}`,r}#T(e,t){let n=e.getContext(`2d`);if(t===null){n?.clearRect(0,0,e.width,e.height);return}e.width=t.width,e.height=t.height,n?.drawImage(t,0,0)}}}));function le(e,t){let n=e+1,r=t+1,i=n*r,a=new Float32Array(i*2);for(let i=0;i<r;i++)for(let r=0;r<n;r++){let o=i*n+r;a[o*2]=r/e,a[o*2+1]=i/t}return{cols:e,rows:t,uvs:a,positions:new Float32Array(i*3),normals:new Float32Array(i*3)}}function ue(e){let t=e.cols+1,n=e.rows+1,r=e.positions,i=e.normals;for(let e=0;e<n;e++)for(let a=0;a<t;a++){let o=a>0?a-1:a,s=a<t-1?a+1:a,c=e>0?e-1:e,l=e<n-1?e+1:e,u=(e*t+s)*3,d=(e*t+o)*3,f=(l*t+a)*3,p=(c*t+a)*3,m=r[u]-r[d],h=r[u+1]-r[d+1],g=r[u+2]-r[d+2],_=r[f]-r[p],v=r[f+1]-r[p+1],y=r[f+2]-r[p+2],b=h*y-g*v,x=g*_-m*y,S=m*v-h*_,C=Math.hypot(b,x,S)||1;b/=C,x/=C,S/=C;let w=(e*t+a)*3;i[w]=b,i[w+1]=x,i[w+2]=S}}var de=n((()=>{}));function fe(e,t,n,r,i){let a=e.cols+1,o=e.rows+1,s=e.positions,c=r>=D?1:r/D,l=Math.sin(Math.PI*c),u=Math.PI/2-l*(Math.PI/2-pe),d=Math.sin(u),f=Math.cos(u),p=1/Math.max(d,1e-6),m=n*(me+(he-me)*l),h=(i.y-.5)*2,g=h>=0,_=Math.min(1,Math.abs(h)/ge),v=1-_,y=g?n+m:-m,b=Math.hypot(t,.5*n-y),x=Math.max(b*d,t/Math.PI),S=Math.min(1,r/_e),C=-Math.PI*S,w=Math.cos(C),T=Math.sin(C);if(l<1e-4){for(let r=0;r<o;r++){let i=r/e.rows*n;for(let n=0;n<a;n++){let o=n/e.cols*t,c=(r*a+n)*3;s[c]=o*w,s[c+1]=i,s[c+2]=-o*T}}ue(e);return}for(let r=0;r<o;r++){let i=r/e.rows*n;for(let o=0;o<a;o++){let c=o/e.cols*t,l=c,u=i,h=0;if(_>1e-5){let e=g?n-i:i,t=-m,r=Math.hypot(c,e-t);if(r>1e-8){let e=r*d,i=Math.asin(Math.min(1,Math.max(0,c/r)))*p,a=1-Math.cos(i),o=r+t-e*a*d;l=e*Math.sin(i),u=g?n-o:o,h=e*a*f}}let y=l,b=u,S=h;if(v>1e-5){let e=c/x,t=x*Math.sin(e),n=x*(1-Math.cos(e));y=_*l+v*t,b=_*u+v*i,S=_*h+v*n}let C=(r*a+o)*3;s[C]=y*w+S*T,s[C+1]=b,s[C+2]=-y*T+S*w}}ue(e)}var pe,me,he,ge,D,_e,ve=n((()=>{de(),pe=30*Math.PI/180,me=1.35,he=.7,ge=.42,D=.84,_e=.88}));function ye(e,t,n,r){let i=e.cols+1,a=e.rows+1,o=e.positions,s=r*Math.PI,c=Math.cos(s),l=Math.sin(s);for(let r=0;r<i;r++){let s=r/e.cols*t,u=s*c,d=s*l;for(let t=0;t<a;t++){let a=(t*i+r)*3;o[a]=u,o[a+1]=t/e.rows*n,o[a+2]=d}}ue(e)}var be=n((()=>{de()}));function xe(e){if(typeof e!=`string`)return e;let t=O[e];if(t)return t;throw T.includes(e)?Error(`Zine: the '${e}' curl is not bundled. Import it and pass the model: import { ${e} } from '@zinejs/core/curls'  →  curl: ${e}`):Error(`Zine: unknown curl ${JSON.stringify(e)}.`)}var Se,Ce,O,we=n((()=>{ve(),be(),E(),Se={deform:fe,anchored:!0},Ce={deform:ye,anchored:!1,flat:!0,gloss:!1},O={cone:Se,simple:Ce}}));function Te(e){let t=e.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!0,depth:!1,stencil:!1,preserveDrawingBuffer:!0});if(t===null)throw Error(`WebglRenderer: could not create a WebGL2 context.`);return t}var Ee=n((()=>{}));function De(e,t,n){let r=e.createProgram();if(r===null)throw Error(`WebglRenderer: could not create a program.`);let i=Oe(e,e.VERTEX_SHADER,t),a=Oe(e,e.FRAGMENT_SHADER,n);if(e.attachShader(r,i),e.attachShader(r,a),e.linkProgram(r),e.deleteShader(i),e.deleteShader(a),!e.getProgramParameter(r,e.LINK_STATUS)){let t=e.getProgramInfoLog(r);throw e.deleteProgram(r),Error(`WebglRenderer: program link failed: ${t??`unknown error`}`)}return r}function Oe(e,t,n){let r=e.createShader(t);if(r===null)throw Error(`WebglRenderer: could not create a shader.`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`WebglRenderer: shader compile failed: ${t??`unknown error`}`)}return r}var ke=n((()=>{}));function Ae(e){let t=e.createTexture();if(t===null)throw Error(`WebglRenderer: could not create a texture.`);return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),t}function je(e,t,n){let r=Me(n,e.getParameter(e.MAX_TEXTURE_SIZE));return e.bindTexture(e.TEXTURE_2D,t),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,r),{width:r.width,height:r.height}}function Me(e,t){let n=e,r=Math.max(n.width,n.height);if(!Number.isFinite(t)||t<=0||r<=t)return n;let i=t/r,a=document.createElement(`canvas`);return a.width=Math.max(1,Math.floor(n.width*i)),a.height=Math.max(1,Math.floor(n.height*i)),a.getContext(`2d`)?.drawImage(e,0,0,a.width,a.height),a}var Ne=n((()=>{})),Pe=r({WebglRenderer:()=>Ue});function k(e){return e.left===null==(e.right===null)?0:e.right===null?1:-1}var Fe,Ie,Le,Re,A,j,ze,Be,Ve,He,Ue,We=n((()=>{de(),we(),E(),Ee(),ke(),Ne(),Fe=`#version 300 es
in vec2 aUnit;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform vec3 uView;
out vec2 vUv;
void main() {
  vec2 px = uRect.xy + aUnit * uRect.zw;
  px = px * uView.x + uView.yz;
  vec2 clip = px / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUnit;
}`,Ie=`#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uGutterSide; // +1 = spine at right edge, -1 = at left edge, 0 = none
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv);
  if (uGutterSide != 0.0) {
    float d = uGutterSide > 0.0 ? (1.0 - vUv.x) : vUv.x;
    c.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.10, d));
  }
  outColor = c;
}`,Le=`#version 300 es
in vec3 aPos;    // leaf-local device px: x = bent offset from spine, y 0..H, z depth
in vec3 aNormal;
in vec2 aUv;
uniform vec2 uViewport;
uniform vec3 uView;   // scale, tx, ty
uniform float uOriginX; // spine x in device px
uniform float uDir;     // +1 leaf to the right of spine, -1 to the left
uniform float uLeafW;   // leaf width in device px (perspective scale)
out vec2 vUv;
out float vFacing;
out float vU;
void main() {
  float bookX = uOriginX + uDir * aPos.x;
  float bookY = aPos.y;
  float Z = aPos.z;
  // Eye distance, in leaf widths. Keeps the perspective resolution-independent. 5.3 puts the
  // roll's deepest point ~14% larger than flat; stronger than that (a nearer eye) balloons the
  // turning sheet and reads more like a fisheye than a page lifting.
  float D = uLeafW * 5.3;
  float persp = D / max(D - Z, 1.0);
  float cx = uViewport.x * 0.5;
  float cy = uViewport.y * 0.5;
  float px = cx + (bookX - cx) * persp;
  float py = cy + (bookY - cy) * min(persp, 1.0); // Y only shrinks (top-safe)
  vec2 p = vec2(px, py) * uView.x + uView.yz;
  vec2 clip = p / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUv;
  vFacing = aNormal.z;
  vU = aUv.x;
}`,Re=`#version 300 es
precision mediump float;
in vec2 vUv;
in float vFacing;
in float vU;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform highp float uDir;
uniform float uGloss; // 0 disables the specular highlight (e.g. the flat 'simple' curl)
uniform float uAlpha; // leaf opacity; a lone page dissolves into the page landing beneath it
uniform float uCrease; // spine-crease strength: 1 matches a spread's gutter; ramps from 0 for a lone leaf
out vec4 outColor;
void main() {
  // The turn mesh carries its own facing in the normal; the front points at the viewer
  // (normal.z > 0) until the leaf passes vertical, for both flip directions. u->x still
  // flips with uDir so a left-hand leaf reads spine-inward.
  bool showFront = vFacing > 0.0;
  float fx = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
  vec4 c = showFront ? texture(uFront, vec2(fx, vUv.y)) : texture(uBack, vec2(1.0 - fx, vUv.y));

  // Fold shading: the sheet darkens sharply where it curves away from the viewer, so the
  // rolled edge reads as a deep crease with a soft highlight riding the ridge.
  float diff = clamp(abs(vFacing), 0.0, 1.0);
  float lit = mix(0.42, 1.0, diff);
  // Spine crease matches the gutter shadow on a spread. A lone page has no gutter, so uCrease
  // ramps it in from 0 as the leaf lifts — otherwise a still-flat leaf paints a shadow band on
  // the anchor edge before the turn even begins.
  lit *= mix(1.0, mix(0.7, 1.0, smoothstep(0.0, 0.12, vU)), uCrease);

  // Glossy specular: brightest where the surface tilts ~30 deg from facing the viewer,
  // so a thin glossy highlight rides across the sheet as it rolls.
  float spec = pow(max(cos(acos(diff) - 0.52), 0.0), 220.0) * 0.22 * uGloss;

  c.rgb = clamp(c.rgb * lit + spec, 0.0, 1.0);
  // Premultiplied alpha (blendFunc ONE, ONE_MINUS_SRC_ALPHA): scale colour as well as alpha,
  // or fading would brighten the sheet additively instead of dissolving it.
  outColor = vec4(c.rgb * uAlpha, c.a * uAlpha);
}`,A=28,j=36,ze=.7,Be=.78,Ve=4e3,He=256*1024*1024,Ue=class{#e=null;#t=null;#n=null;#r=null;#i=null;#a=null;#o=null;#s=null;#c=null;#l=0;#u=le(A,j);#d=new Map;#f=0;#p=null;#m=0;#h={};#g={};#_={scale:1,tx:0,ty:0};#v=1;#y=null;#b=!1;#x=null;#S=0;#C=O[ee];#w={y:.5};#T=0;#E=0;#D=0;#O=0;#k=0;#A=`contain`;#j=0;#M=0;#N=!1;#P=!1;#F=null;#I=null;mount(e){this.#e=e;let t=e.ownerDocument,n=t.createElement(`canvas`);return n.style.cssText=`display:block;width:100%;height:100%;`,e.append(n),this.#t=n,n.addEventListener(`webglcontextlost`,this.#V),n.addEventListener(`webglcontextrestored`,this.#H),t.addEventListener(`visibilitychange`,this.#U),this.#n=Te(n),this.#m=this.#n.getParameter(this.#n.MAX_TEXTURE_SIZE),this.#K(),Promise.resolve()}destroy(){this.#G();let e=this.#t;e!==null&&(e.removeEventListener(`webglcontextlost`,this.#V),e.removeEventListener(`webglcontextrestored`,this.#H),e.ownerDocument.removeEventListener(`visibilitychange`,this.#U));let t=this.#n;if(t!==null){for(let e of this.#d.values())t.deleteTexture(e.tex);this.#p!==null&&t.deleteTexture(this.#p),this.#a!==null&&t.deleteVertexArray(this.#a),this.#o!==null&&t.deleteVertexArray(this.#o),this.#r!==null&&t.deleteProgram(this.#r),this.#i!==null&&t.deleteProgram(this.#i),t.getExtension(`WEBGL_lose_context`)?.loseContext()}e?.remove(),this.#d.clear(),this.#f=0,this.#p=null,this.#e=null,this.#t=null,this.#n=null,this.#y=null,this.#x=null}onFatal(e){this.#I=e}get maxTextureSize(){return this.#m||void 0}renderSpread(e,t,n){this.#y=t,this.#b=n?.fill??!1,n?.fit&&(this.#A=n.fit),this.#x=null,this.#L(t),this.#Y()}#L(e){let t=e.left??e.right;t&&t.height&&(this.#O=t.width/t.height,this.#k===0&&(this.#k=this.#O))}#R(){return this.#A===`fill`&&this.#k>0?this.#k:this.#O}beginFlip(e,t,n,r){let i=r?.fill??!1;r?.fit&&(this.#A=r.fit),this.#S=0,r?.curl&&(this.#C=xe(r.curl)),r?.anchor&&(this.#w=r.anchor),this.#E=i?0:k(e),this.#D=i?0:k(t),this.#L(t),i?this.#x={underLeft:null,underRight:null,underFull:t.right??t.left,front:e.right??e.left,back:e.right??e.left,dir:n===`forward`?1:-1,fill:!0}:n===`forward`?this.#x={underLeft:e.left,underRight:t.right,underFull:null,front:e.right,back:t.left,dir:1,fill:!1}:this.#x={underLeft:t.left,underRight:e.right,underFull:null,front:e.left,back:t.right,dir:-1,fill:!1},this.#Y()}setFlipProgress(e,t){this.#S=e,this.#Y()}setViewTransform(e,t,n){this.#_={scale:e,tx:t,ty:n},this.#Y()}measure(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#O>0,i=r?this.#z():void 0,a=r?this.#B():void 0,o=a?e=>{let t=this.#T/this.#v;return{x:(a.x-t)*e+t,y:a.y*e,width:a.width*e,height:a.height*e}}:void 0;return{containerWidth:t,containerHeight:n,pageWidth:t/2,pageHeight:n,book:i,content:a,screenAt:o,containerAspect:this.#k>0?(this.#b?1:2)*this.#k:void 0}}#z(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#R();if(r<=0||t<=0||n<=0)return{x:0,y:0,width:t,height:n};let i=(this.#b?1:2)*r,a=t,o=n;return i>t/n?o=t/i:a=n*i,{x:(t-a)/2,y:(n-o)/2,width:a,height:o}}#B(){let e=this.#z();return!this.#b&&this.#y!==null&&k(this.#y)!==0?{x:e.x+e.width/4,y:e.y,width:e.width/2,height:e.height}:e}#V=e=>{e.preventDefault(),this.#N=!0,this.#F===null&&(this.#F=setTimeout(()=>this.#W(),Ve))};#H=()=>{this.#G(),this.#N=!1,this.#K(),this.#Y()};#U=()=>{this.#t?.ownerDocument.visibilityState===`visible`&&this.#Y()};#W(){this.#P||(this.#P=!0,this.#I?.())}#G(){this.#F!==null&&(clearTimeout(this.#F),this.#F=null)}#K(){let e=this.#n;if(e!==null){this.#r=De(e,Fe,Ie),this.#i=De(e,Le,Re);for(let t of[`uViewport`,`uRect`,`uView`,`uTex`,`uGutterSide`])this.#h[t]=e.getUniformLocation(this.#r,t);for(let t of[`uViewport`,`uView`,`uOriginX`,`uDir`,`uLeafW`,`uFront`,`uBack`,`uGloss`,`uAlpha`,`uCrease`])this.#g[t]=e.getUniformLocation(this.#i,t);this.#a=this.#q(e,this.#r),this.#J(e,this.#i),this.#d.clear(),this.#f=0,this.#p=this.#ae(e),e.useProgram(this.#r),e.uniform1i(this.#h.uTex??null,0),e.useProgram(this.#i),e.uniform1i(this.#g.uFront??null,0),e.uniform1i(this.#g.uBack??null,1),e.clearColor(0,0,0,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)}}#q(e,t){let n=e.createVertexArray(),r=e.createBuffer();if(n===null||r===null)throw Error(`WebglRenderer: could not create buffers.`);e.bindVertexArray(n),e.bindBuffer(e.ARRAY_BUFFER,r),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW);let i=e.getAttribLocation(t,`aUnit`);return e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),n}#J(e,t){let n=[];for(let e=0;e<j;e++)for(let t=0;t<A;t++){let r=e*29+t,i=r+1,a=r+29,o=a+1;n.push(r,a,i,i,a,o)}this.#l=n.length;let r=e.createVertexArray();this.#s=e.createBuffer(),this.#c=e.createBuffer();let i=e.createBuffer(),a=e.createBuffer();if(r===null||this.#s===null||this.#c===null||i===null||a===null)throw Error(`WebglRenderer: could not create mesh buffers.`);e.bindVertexArray(r),e.bindBuffer(e.ARRAY_BUFFER,this.#s),e.bufferData(e.ARRAY_BUFFER,this.#u.positions,e.DYNAMIC_DRAW);let o=e.getAttribLocation(t,`aPos`);e.enableVertexAttribArray(o),e.vertexAttribPointer(o,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,this.#c),e.bufferData(e.ARRAY_BUFFER,this.#u.normals,e.DYNAMIC_DRAW);let s=e.getAttribLocation(t,`aNormal`);e.enableVertexAttribArray(s),e.vertexAttribPointer(s,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,this.#u.uvs,e.STATIC_DRAW);let c=e.getAttribLocation(t,`aUv`);e.enableVertexAttribArray(c),e.vertexAttribPointer(c,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,a),e.bufferData(e.ELEMENT_ARRAY_BUFFER,new Uint16Array(n),e.STATIC_DRAW),e.bindVertexArray(null),this.#o=r}#Y(){let e=this.#n,t=this.#t;e===null||t===null||this.#N||e.isContextLost()||(this.#oe(),e.clear(e.COLOR_BUFFER_BIT),this.#X(),this.#x===null?this.#y!==null&&this.#Z():this.#Q())}#X(){let e=this.#n,t=this.#t,n=t.width,r=t.height,i=this.#R();if(i>0){let e=(this.#b?1:2)*i;e>n/r?(this.#j=n,this.#M=Math.round(n/e)):(this.#M=r,this.#j=Math.round(r*e))}else this.#j=n,this.#M=r;let a=Math.round((n-this.#j)/2),o=Math.round((r-this.#M)/2);e.viewport(a,o,this.#j,this.#M)}#Z(){let e=this.#j,t=this.#M,n=this.#y;this.#T=this.#b?0:k(n)*(e/4),this.#ee(),this.#b?this.#te({x:0,y:0,w:e,h:t},n.right??n.left):(this.#te({x:0,y:0,w:e/2,h:t},n.left,+!!n.right),this.#te({x:e/2,y:0,w:e/2,h:t},n.right,n.left?-1:0))}#Q(){let e=this.#n,t=this.#j,n=this.#M,r=this.#x;if(this.#T=r.fill?0:(this.#E+(this.#D-this.#E)*this.#S)*(t/4),this.#ee(),r.fill?this.#te({x:0,y:0,w:t,h:n},r.underFull):(this.#te({x:0,y:0,w:t/2,h:n},r.underLeft,1),this.#te({x:t/2,y:0,w:t/2,h:n},r.underRight,-1)),r.front===null&&r.back===null)return;let i=r.fill?t:t/2,a=r.fill?r.dir>0?0:t:t/2;this.#C.deform(this.#u,i,n,this.#S,{y:this.#w.y,fill:r.fill}),e.bindBuffer(e.ARRAY_BUFFER,this.#s),e.bufferSubData(e.ARRAY_BUFFER,0,this.#u.positions),e.bindBuffer(e.ARRAY_BUFFER,this.#c),e.bufferSubData(e.ARRAY_BUFFER,0,this.#u.normals),this.#ne(e.TEXTURE0,r.front),this.#ne(e.TEXTURE1,r.back),e.activeTexture(e.TEXTURE0),e.useProgram(this.#i),e.bindVertexArray(this.#o),e.uniform2f(this.#g.uViewport??null,t,n),e.uniform3f(this.#g.uView??null,this.#_.scale,this.#_.tx*this.#v+this.#T,this.#_.ty*this.#v),e.uniform1f(this.#g.uOriginX??null,a),e.uniform1f(this.#g.uDir??null,r.dir),e.uniform1f(this.#g.uLeafW??null,i),e.uniform1f(this.#g.uGloss??null,this.#C.gloss===!1?0:1),e.uniform1f(this.#g.uAlpha??null,r.fill?this.#$():1),e.uniform1f(this.#g.uCrease??null,r.fill?Math.min(1,this.#S/.2):1),e.drawElements(e.TRIANGLES,this.#l,e.UNSIGNED_SHORT,0)}#$(){let e=this.#C.flat?ze:Be,t=(this.#S-e)/(1-e);return t<=0?1:t>=1?0:(1-t)**1.5}#ee(){let e=this.#n;e.useProgram(this.#r),e.bindVertexArray(this.#a),e.activeTexture(e.TEXTURE0),e.uniform2f(this.#h.uViewport??null,this.#j,this.#M),e.uniform3f(this.#h.uView??null,this.#_.scale,this.#_.tx*this.#v+this.#T,this.#_.ty*this.#v)}#te(e,t,n=0){let r=this.#n;t!==null&&(this.#ne(r.TEXTURE0,t),r.uniform4f(this.#h.uRect??null,e.x,e.y,e.w,e.h),r.uniform1f(this.#h.uGutterSide??null,n),r.drawArrays(r.TRIANGLE_STRIP,0,4))}#ne(e,t){let n=this.#n;n.activeTexture(e),n.bindTexture(n.TEXTURE_2D,t===null?this.#p:this.#re(t))}#re(e){let t=this.#n,n=this.#d.get(e);if(n!==void 0)return this.#d.delete(e),this.#d.set(e,n),n.tex;let r=Ae(t),i=je(t,r,e),a=i.width*i.height*4;return this.#d.set(e,{tex:r,bytes:a}),this.#f+=a,this.#ie(),r}#ie(){let e=this.#n;for(let[t,n]of this.#d){if(this.#f<=He||this.#d.size<=4)break;this.#d.delete(t),this.#f-=n.bytes,e.deleteTexture(n.tex)}}#ae(e){let t=Ae(e);return e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),t}#oe(){let e=this.#n,t=this.#t,n=this.#e;if(e===null||t===null||n===null)return;this.#v=typeof devicePixelRatio==`number`?devicePixelRatio:1;let r=Math.max(1,Math.round(n.clientWidth*this.#v)),i=Math.max(1,Math.round(n.clientHeight*this.#v));(t.width!==r||t.height!==i)&&(t.width=r,t.height=i,e.viewport(0,0,r,i))}}})),Ge={css:async()=>new(await(Promise.resolve().then(()=>(ce(),re)))).CssRenderer,webgl2:async()=>new(await(Promise.resolve().then(()=>(We(),Pe)))).WebglRenderer},Ke=!0;function qe(e){return typeof e==`object`&&!!e&&!Array.isArray(e)&&typeof e.mount==`function`}function Je(e){return e.gpu&&Ke?[`webgl2`,`css`]:[`css`]}function Ye(){return{gpu:Xe()}}function Xe(){try{return!!document.createElement(`canvas`).getContext(`webgl2`)}catch{return!1}}async function M(e=`auto`,t=Ye()){if(qe(e))return e;let n=Array.isArray(e)?e:e===`auto`?Je(t):[e];for(let e of n){if(e===`webgl2`&&!t.gpu)continue;let n=Ge[e];if(n)return n()}throw n.length===1&&n[0]===`webgl2`&&!t.gpu?Error(`renderer: 'webgl2' was forced but this device has no WebGL2. Use 'css' or 'auto'.`):Error(`renderer: none of [${n.join(`, `)}] could be loaded — use 'css' or 'auto'.`)}function Ze(e,t){let n=typeof t.frontCover==`string`,r=typeof t.backCover==`string`,i=t.pages!=null&&Object.keys(t.pages).length>0;return!n&&!r&&!i?e:new $e(e,t)}function Qe(e){return fetch(e).then(t=>{if(!t.ok)throw Error(`zine: could not load image "${e}" (HTTP ${t.status}).`);return t.blob()}).then(e=>createImageBitmap(e))}var $e=class{#e;#t;#n;#r;#i=new Map;#a=new Map;open;onPageUpdate;onProgress;getText;getDownload;getOutline;constructor(e,t){this.#e=e,this.#t=typeof t.frontCover==`string`?t.frontCover:null,this.#n=typeof t.backCover==`string`?t.backCover:null,this.#r=t.pages??{},typeof e.open==`function`?this.open=async()=>{await e.open(),this.#o()}:this.#o(),typeof e.onPageUpdate==`function`&&(this.onPageUpdate=t=>{e.onPageUpdate(e=>t(e+(this.#t===null?0:1)))}),typeof e.onProgress==`function`&&(this.onProgress=t=>e.onProgress(t)),typeof e.getText==`function`&&(this.getText=async t=>{let n=this.#t===null?0:1;if(this.#t!==null&&t===0||this.#n!==null&&t===this.pageCount-1)return``;let r=t-n;return this.#i.has(r)?``:e.getText(r)}),typeof e.getDownload==`function`&&(this.getDownload=()=>e.getDownload()),typeof e.getOutline==`function`&&(this.getOutline=async()=>{let t=await e.getOutline(),n=this.#t===null?0:1;if(n===0)return t;let r=e=>e.map(e=>({...e,page:e.page===null?null:e.page+n,children:r(e.children)}));return r(t)})}get pageCount(){return this.#e.pageCount+(this.#t===null?0:1)+(this.#n===null?0:1)}get(e,t){let n=this.#t===null?0:1;if(this.#t!==null&&e===0)return this.#s(this.#t);if(this.#n!==null&&e===this.pageCount-1)return this.#s(this.#n);let r=e-n,i=this.#i.get(r);return i===void 0?this.#e.get(r,t):this.#s(i)}prefetch(e){let t=this.#t===null?0:1,n=[];for(let r of e)if(this.#t!==null&&r===0)this.#s(this.#t).catch(()=>{});else if(this.#n!==null&&r===this.pageCount-1)this.#s(this.#n).catch(()=>{});else{let e=r-t,i=this.#i.get(e);i===void 0?n.push(e):this.#s(i).catch(()=>{})}this.#e.prefetch(n)}destroy(){this.#e.destroy();for(let e of this.#a.values())e.then(e=>e.close()).catch(()=>{});this.#a.clear()}#o(){let e=this.#e.pageCount;this.#i.clear();for(let[t,n]of Object.entries(this.#r)){let r=Number(t),i=r<0?e+r:r;Number.isInteger(i)&&i>=0&&i<e&&this.#i.set(i,n)}}#s(e){let t=this.#a.get(e);return t===void 0&&(t=Qe(e).catch(t=>{throw this.#a.delete(e),t}),this.#a.set(e,t)),t}},N={prevPage:`Previous page`,nextPage:`Next page`,firstPage:`First page`,lastPage:`Last page`,zoomIn:`Zoom in`,zoomOut:`Zoom out`,fullscreen:`Fullscreen`,mute:`Mute page sound`,unmute:`Unmute page sound`,share:`Share`,downloadPdf:`Download PDF`,showOnePage:`Show one page`,showTwoPages:`Show two pages`,print:`Print`,more:`More`,controlsLabel:`Flipbook controls`,showThumbnails:`Show thumbnails`,hideThumbnails:`Hide thumbnails`,showOutline:`Show outline`,hideOutline:`Hide outline`,searchOpen:`Search`,searchClose:`Hide search`,pageWidgetLabel:`Page`,pageNumberLabel:`Page number`,roledescription:`flipbook`,thumbnailsLabel:`Pages`,outlineLabel:`Outline`,outlineLoading:`Loading…`,outlineEmpty:`This document has no outline.`,untitled:`Untitled`,searchResultsLabel:`Search results`,searchPlaceholder:`Search…`,searchInputLabel:`Search the document`,searching:`Searching…`,loadingOpening:`Opening document…`,loadingPreparing:`Preparing pages…`,shareFallbackTitle:`Flipbook`,close:`Close`,copy:`Copy`,copied:`Copied`,copyManual:`Press Ctrl+C`,qrLabel:`QR code for this page`,linkLabel:`Link to this page`,email:`Email`,panHint:`Drag to move`,pageAnnounce:(e,t)=>`Page ${e} of ${t}`,pageTotal:e=>`/ ${e}`,downloadingPercent:e=>`Downloading document… ${e}%`,downloadingSize:e=>`Downloading document… ${e.toFixed(1)} MB`,zoomHint:({doubleClick:e,wheel:t,mac:n})=>{let r=[];return e&&r.push(`Double-click`),t&&r.push(`${n?`⌘`:`Ctrl`}-scroll`),`${r.join(` or `)} to zoom`},noMatches:e=>`No matches for “${e}”`,searchHitLabel:e=>`Page ${e}`,searchHitAria:(e,t)=>`Page ${e}: ${t}`,shareOn:e=>`Share on ${e}`,thumbnailAria:e=>e.length>1?`Pages ${e[0]}–${e.at(-1)}`:`Page ${e[0]??``}`,outlineEntryAria:(e,t)=>`${e}, page ${t}`};function et(e){return e?{...N,...e}:N}var tt,nt=n((()=>{tt=`data:audio/mpeg;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAA4AQAAHgAAAHACAAA8AAAMBkak0dlxzAYGoNHlcZMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV`})),rt=r({FlipSound:()=>ct});function it(){if(typeof window>`u`)return;let e=window;return e.AudioContext??e.webkitAudioContext}function at(e){return e<0?0:e>1?1:e}function ot(e){if(typeof atob!=`function`)return;let t=e.indexOf(`,`);if(t<0)return;let n=atob(e.slice(t+1)),r=new Uint8Array(n.length);for(let e=0;e<n.length;e++)r[e]=n.charCodeAt(e);return r.buffer}var st,ct,lt=n((()=>{nt(),st=.5,ct=class{#e;#t=null;#n=null;#r=null;#i=null;#a;#o=!1;#s;constructor(e={}){this.#e=it(),this.#a=at(e.volume??st),this.#s=e.url}get available(){return this.#e!==void 0&&(!!this.#s||!0)}play(){if(this.#o||!this.available)return;let e=this.#c();e&&(e.state===`suspended`&&e.resume().catch(()=>{}),this.#l().then(()=>{if(!(!this.#t||!this.#r||!this.#n||this.#o))try{let e=this.#t.createBufferSource();e.buffer=this.#r,e.connect(this.#n),e.start()}catch{}}))}setMuted(e){this.#o=e,this.#n&&(this.#n.gain.value=e?0:this.#a)}isMuted(){return this.#o}destroy(){try{this.#t?.close()}catch{}this.#t=null,this.#n=null,this.#r=null}#c(){if(this.#t)return this.#t;if(!this.#e)return null;try{let e=new this.#e,t=e.createGain();t.gain.value=this.#o?0:this.#a,t.connect(e.destination),this.#t=e,this.#n=t}catch{this.#t=null}return this.#t}#l(){return this.#i||=this.#u().catch(()=>{}),this.#i}async#u(){let e=this.#c();if(!e)return;let t;t=this.#s?await(await fetch(this.#s)).arrayBuffer():ot(tt),t&&(this.#r=await e.decodeAudioData(t.slice(0)))}}})),ut=r({CSS:()=>mt,mountLoading:()=>ft});function dt(e){if(e.getElementById(P))return;let t=e.createElement(`style`);t.id=P,t.textContent=mt,(e.head??e.documentElement)?.appendChild(t)}function ft(e,t){let n=e.ownerDocument;dt(n);let r=n.createElement(`div`);r.className=`zine-loading`,r.setAttribute(`role`,`status`),r.setAttribute(`aria-live`,`polite`);let i=n.createElement(`div`);i.className=`zine-loading-spinner`,i.setAttribute(`aria-hidden`,`true`);let a=n.createElement(`div`);a.className=`zine-loading-text`,a.textContent=t.loadingOpening;let o=n.createElement(`div`);o.className=`zine-loading-bar`,o.style.display=`none`;let s=n.createElement(`div`);s.className=`zine-loading-fill`,o.appendChild(s),r.append(i,a,o),e.appendChild(r);let c=null,l=typeof globalThis.getComputedStyle==`function`?globalThis.getComputedStyle(e):null;(!l||l.position===`static`||l.position===``)&&(c=e.style.position,e.style.position=`relative`);let u=!1,d=setTimeout(()=>{u=!0,r.classList.add(`zine-loading-shown`)},pt);return{update(e){if(e.total>0){let n=Math.min(100,Math.round(e.loaded/e.total*100));a.textContent=t.downloadingPercent(n),o.style.display=``,s.style.width=`${n}%`}else a.textContent=t.downloadingSize(e.loaded/1024/1024),o.style.display=`none`},preparing(){a.textContent=t.loadingPreparing,o.style.display=`none`},destroy(){u||clearTimeout(d),r.remove(),c!==null&&(e.style.position=c)}}}var P,pt,mt,ht=n((()=>{P=`zine-loading-style`,pt=150,mt=`
.zine-loading {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  /* The overlay shows during download, before the book is measured and the container gets its
     aspect-ratio (and thus its height). A consumer who sizes the container by width alone leaves it
     near-zero-height meanwhile, which would crush the overlay to a strip and clip the spinner.
     A floor keeps it tall enough to lay out; the box snaps to the book's ratio once it paints. */
  min-height: 160px;
  padding: 24px;
  box-sizing: border-box;
  text-align: center;
  font: 500 14px/1.4 system-ui, sans-serif;
  color: var(--zine-loading-fg, light-dark(#3f3f46, #d4d4d8));
  background: var(--zine-loading-bg, light-dark(#fafafa, #0c0c11));
  border-radius: inherit;
  opacity: 0;
  transition: opacity 150ms ease;
}
.zine-loading-shown { opacity: 1; }
.zine-loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--zine-loading-track, light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.14)));
  border-top-color: var(--zine-loading-accent, light-dark(#0284c7, #7dd3fc));
  border-radius: 50%;
  animation: zine-loading-spin 0.8s linear infinite;
}
@keyframes zine-loading-spin { to { transform: rotate(360deg); } }
.zine-loading-text { font-variant-numeric: tabular-nums; }
.zine-loading-bar {
  width: min(240px, 70%);
  height: 6px;
  background: var(--zine-loading-track, light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.14)));
  border-radius: 3px;
  overflow: hidden;
}
.zine-loading-fill {
  width: 0;
  height: 100%;
  background: var(--zine-loading-accent, light-dark(#0284c7, #7dd3fc));
  border-radius: 3px;
  transition: width 150ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .zine-loading { transition: none; }
  .zine-loading-spinner { animation-duration: 2s; }
  .zine-loading-fill { transition: none; }
}
`}));function F(e,t){let n=e.createElementNS(`http://www.w3.org/2000/svg`,`svg`);return n.setAttribute(`viewBox`,`0 0 24 24`),n.setAttribute(`fill`,`none`),n.setAttribute(`stroke`,`currentColor`),n.setAttribute(`stroke-width`,`1.75`),n.setAttribute(`stroke-linecap`,`round`),n.setAttribute(`stroke-linejoin`,`round`),n.setAttribute(`aria-hidden`,`true`),n.setAttribute(`focusable`,`false`),n.innerHTML=t,n}var I,L=n((()=>{I={prev:`<path d="m15 18-6-6 6-6"/>`,next:`<path d="m9 18 6-6-6-6"/>`,first:`<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>`,last:`<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>`,zoomIn:`<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>`,zoomOut:`<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>`,search:`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,share:`<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>`,menu:`<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>`,fullscreen:`<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`,exitFullscreen:`<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>`,thumbnails:`<path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/>`,outline:`<path d="M21 12h-8"/><path d="M21 6h-8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>`,twoPages:`<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,onePage:`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h6"/>`,print:`<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14" rx="1"/>`,download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`,close:`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,soundOn:`<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l3.8 3.8a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 5.6a10 10 0 0 1 0 12.8"/>`,soundOff:`<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l3.8 3.8a.7.7 0 0 0 1.2-.5z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>`}}));function R(e){return z.set(e.id,e),e}function gt(e){return z.get(e)}function _t(e){if(typeof e==`string`){let t=z.get(e);if(!t)throw Error(`controls: unknown control '${e}'. Register it with defineControl() or pass a definition object.`);return t}let t=z.get(e.id);return t?{...t,...e}:e}var z,B,V=n((()=>{z=new Map,B=[`prev`,`pageInput`,`next`,`|`,`zoomOut`,`zoomIn`,`search`,`share`,`menu`,`fullscreen`]})),H,vt,yt=n((()=>{H=encodeURIComponent,vt=[{id:`facebook`,label:`Facebook`,icon:`<path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/>`,href:e=>`https://www.facebook.com/sharer/sharer.php?u=${H(e)}`},{id:`x`,label:`X (Twitter)`,icon:`<path fill="currentColor" stroke="none" d="M17.53 3h3.06l-6.69 7.64L21.75 21h-6.16l-4.82-6.3L5.24 21H2.18l7.15-8.17L2.25 3h6.32l4.36 5.77L17.53 3Zm-1.07 16.17h1.69L7.62 4.73H5.8l10.66 14.44Z"/>`,href:(e,t)=>`https://twitter.com/intent/tweet?url=${H(e)}&text=${H(t)}`},{id:`linkedin`,label:`LinkedIn`,icon:`<path fill="currentColor" stroke="none" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/>`,href:e=>`https://www.linkedin.com/sharing/share-offsite/?url=${H(e)}`},{id:`whatsapp`,label:`WhatsApp`,icon:`<path fill="currentColor" stroke="none" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-1.99 1.38-.53.05-1.02.24-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.26-.28.57-.35.76-.35h.55c.17 0 .42-.07.65.5.24.58.8 2 .87 2.14.07.14.12.31.02.5-.09.19-.14.3-.28.47l-.42.48c-.14.14-.28.29-.12.57.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.19 1.35.28.15.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.25.1 1.63.77 1.9.91.29.14.48.21.55.33.07.11.07.67-.18 1.37Z"/>`,href:(e,t)=>`https://api.whatsapp.com/send?text=${H(`${t} ${e}`)}`},{id:`pinterest`,label:`Pinterest`,icon:`<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.19-.78 1.2-4.98 1.2-4.98s-.3-.61-.3-1.52c0-1.42.82-2.48 1.85-2.48.87 0 1.3.66 1.3 1.44 0 .88-.56 2.2-.85 3.42-.24 1.02.51 1.86 1.52 1.86 1.83 0 3.23-1.93 3.23-4.7 0-2.46-1.77-4.18-4.29-4.18-2.92 0-4.64 2.19-4.64 4.46 0 .88.34 1.83.76 2.35a.3.3 0 0 1 .07.29l-.28 1.16c-.05.19-.15.23-.34.14-1.28-.6-2.08-2.47-2.08-3.98 0-3.24 2.35-6.21 6.79-6.21 3.56 0 6.33 2.54 6.33 5.93 0 3.54-2.23 6.39-5.32 6.39-1.04 0-2.02-.54-2.35-1.18l-.64 2.44c-.23.89-.86 2.01-1.28 2.69A10 10 0 1 0 12 2Z"/>`,href:(e,t)=>`https://pinterest.com/pin/create/button/?url=${H(e)}&description=${H(t)}`},{id:`email`,label:`Email`,icon:`<path fill="currentColor" stroke="none" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-7.47 4.67a1 1 0 0 1-1.06 0L4 8.24V6.4l8 5 8-5v1.84Z"/>`,href:(e,t)=>`mailto:?subject=${H(t)}&body=${H(e)}`}]}));function bt(e){let t=new Uint8Array([1]);for(let n=0;n<e;n++){let e=new Uint8Array(t.length+1);for(let r=0;r<t.length;r++)e[r]=e[r]^t[r],e[r+1]=e[r+1]^G(t[r],U[n]);t=e}return t}function xt(e,t){let n=bt(t),r=new Uint8Array(t);for(let i of e){let e=i^r[0];if(r.copyWithin(0,1),r[t-1]=0,e!==0)for(let i=0;i<t;i++)r[i]=r[i]^G(n[i+1],e)}return r}function St(e){let t=0|e,n=t;for(let e=0;e<10;e++)n=n<<1^(n>>>9)*1335;return(t<<10|n)^21522}function Ct(e,t,n){for(let r=-1;r<=7;r++)for(let i=-1;i<=7;i++){let a=t+i,o=n+r;if(a<0||o<0||a>=e.size||o>=e.size)continue;let s=Math.max(Math.abs(i-3),Math.abs(r-3));K(e,a,o,s!==2&&s<=3)}}function wt(e){let t=new TextEncoder().encode(e),n=Et.findIndex(e=>t.length+2<=e)+1;if(n===0)throw Error(`qr: ${t.length} bytes is too long for this encoder (max 214).`);let r=Et[n-1],i=[],a=(e,t)=>{for(let n=t-1;n>=0;n--)i.push(e>>>n&1)};a(4,4),a(t.length,n<10?8:16);for(let e of t)a(e,8);for(a(0,Math.min(4,r*8-i.length));i.length%8;)i.push(0);let o=new Uint8Array(r);for(let e=0;e<i.length;e+=8){let t=0;for(let n=0;n<8;n++)t=t<<1|i[e+n];o[e/8]=t}for(let e=i.length/8,t=0;e<r;e++,t++)o[e]=t%2==0?236:17;let s=Ot[n-1],c=Dt[n-1],l=Math.floor(r/s),u=r%s,d=[],f=[];for(let e=0,t=0;e<s;e++){let n=l+ +(e>=s-u),r=o.subarray(t,t+n);t+=n,d.push(r),f.push(xt(r,c))}let p=[];for(let e=0;e<l+1;e++)for(let t of d)e<t.length&&p.push(t[e]);for(let e=0;e<c;e++)for(let t of f)p.push(t[e]);let m=n*4+17,h={size:m,modules:new Uint8Array(m*m),reserved:new Uint8Array(m*m)};Ct(h,0,0),Ct(h,m-7,0),Ct(h,0,m-7);for(let e=8;e<m-8;e++){let t=e%2==0;K(h,e,6,t),K(h,6,e,t)}for(let e of kt[n-1])for(let t of kt[n-1])if(!(e<9&&t<9||e<9&&t>m-10||e>m-10&&t<9))for(let n=-2;n<=2;n++)for(let r=-2;r<=2;r++)K(h,e+r,t+n,Math.max(Math.abs(r),Math.abs(n))!==1);K(h,8,m-8,!0);for(let e=0;e<9;e++)e!==6&&(K(h,e,8,!1),K(h,8,e,!1));for(let e=0;e<8;e++)K(h,m-1-e,8,!1),K(h,8,m-1-e,!1);K(h,8,m-8,!0);let g=0,_=p.length*8;for(let e=m-1;e>=1;e-=2){e===6&&(e=5);for(let t=0;t<m;t++)for(let n=0;n<2;n++){let r=e-n,i=e+1&2?t:m-1-t;if(h.reserved[i*m+r])continue;let a=!1;g<_&&(a=(p[g>>>3]>>>7-(g&7)&1)==1,g++),(r+i)%2==0&&(a=!a),K(h,r,i,a,!1)}}let v=St(0);for(let e=0;e<15;e++){let t=(v>>>e&1)==1,n=e<6?e:e<8?e+1:8,r=e<8?8:e<9?7:14-e;K(h,n,8,t),K(h,8,r,t),e<8?K(h,m-1-e,8,t):K(h,8,m-15+e,t)}return K(h,8,m-8,!0),{size:m,modules:h.modules}}function Tt(e,t){let{size:n,modules:r}=wt(e),i=``;for(let e=0;e<n;e++)for(let t=0;t<n;t++)r[e*n+t]&&(i+=`M${t} ${e}h1v1h-1z`);let a=n+4;return`<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${a} ${a}" shape-rendering="crispEdges"><rect width="${a}" height="${a}" fill="#fff"/><g transform="translate(2 2)" fill="#000">${`<path d="${i}"/>`}</g></svg>`}var Et,Dt,Ot,kt,U,W,G,K,At=n((()=>{Et=[16,28,44,64,86,108,124,154,182,216],Dt=[10,16,26,18,24,16,18,22,22,26],Ot=[1,1,1,2,2,4,4,4,5,5],kt=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]],U=new Uint8Array(512),W=new Uint8Array(256);for(let e=0,t=1;e<255;e++)U[e]=t,W[t]=e,t<<=1,t&256&&(t^=285);for(let e=255;e<512;e++)U[e]=U[e-255];G=(e,t)=>e===0||t===0?0:U[(W[e]+W[t])%255],K=(e,t,n,r,i=!0)=>{e.modules[n*e.size+t]=+!!r,i&&(e.reserved[n*e.size+t]=1)}}));function jt(e){if(e.getElementById(Mt))return;let t=e.createElement(`style`);t.id=Mt,t.textContent=Nt,(e.head??e.documentElement)?.appendChild(t)}function q(e,t){t!==`auto`&&(e.style.colorScheme=t)}var Mt,Nt,J=n((()=>{Mt=`zine-controls-style`,Nt=`
/* Docked mode wraps the book so the bar can sit beside it without shrinking the container,
   whose measured box the renderer and hit-testing both depend on.
   The wrapper deliberately does not stretch or grow its children: the container keeps whatever
   width, aspect-ratio and auto-margins the consumer's own CSS gave it. */
.zine-controls-wrap { display: flex; }
/* Stacked: children keep their own width (so a percentage or auto-margin still resolves against
   the wrapper) and take only the height they ask for. */
.zine-controls-wrap-top,
.zine-controls-wrap-bottom { flex-direction: column; align-items: stretch; }
/* Side by side: the bar is only as wide as its buttons, and both are vertically centred. */
.zine-controls-wrap-left,
.zine-controls-wrap-right { flex-direction: row; align-items: center; }
/* min-height:0 matters as much as min-width here. A flex item's automatic minimum size floors it
   at its content, so once the canvas has grown for a taller layout the book cannot shrink back —
   its aspect-ratio is restored but ignored, leaving the extra height behind. */
.zine-controls-wrap > * { flex: 0 0 auto; min-width: 0; min-height: 0; }

.zine-controls {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 5px;
  z-index: 2;
  box-sizing: border-box;
  font: 500 12px/1.2 system-ui, sans-serif;
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  touch-action: auto;
  -webkit-user-select: none;
  user-select: none;
}
.zine-controls-docked { flex: 0 0 auto; justify-content: center; align-items: center; }
.zine-controls-floating {
  position: absolute;
  /* Transparent to the book except on the buttons themselves, so gaps stay draggable. */
  pointer-events: none;
}
.zine-controls-bar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border-radius: 8px;
  pointer-events: auto;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.82)));
  backdrop-filter: blur(8px);
}
/* Floating: lifted off the page it covers. Docked: flat, with an outline so it reads as a
   control strip rather than a shadow hanging in empty space. */
.zine-controls-floating .zine-controls-bar { box-shadow: 0 2px 12px rgba(0, 0, 0, 0.28); }
.zine-controls-docked .zine-controls-bar {
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.14)));
}
.zine-controls-floating.zine-controls-bottom { inset: auto 0 0 0; justify-content: center; }
.zine-controls-floating.zine-controls-top    { inset: 0 0 auto 0; justify-content: center; }
.zine-controls-floating.zine-controls-left   { inset: 0 auto 0 0; align-items: center; }
.zine-controls-floating.zine-controls-right  { inset: 0 0 0 auto; align-items: center; }
/* A bar on a vertical edge stacks its buttons, docked or floating. */
.zine-controls-left .zine-controls-bar,
.zine-controls-right .zine-controls-bar { flex-direction: column; }

.zine-controls-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.zine-controls-btn svg { width: 15px; height: 15px; }
.zine-controls-btn:hover:not(:disabled) { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-controls-btn:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 1px;
}
.zine-controls-btn:disabled { opacity: 0.38; cursor: default; }
/* A button mid-slow-action (fetching a file to save or print): a spinner, kept full-strength
   rather than dimmed so it reads as "working", not "disabled". */
.zine-controls-btn.zine-controls-busy { opacity: 1; cursor: default; position: relative; }
.zine-controls-btn.zine-controls-busy::after {
  content: '';
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  opacity: 0.7;
  animation: zine-controls-spin 0.7s linear infinite;
}
/* Icon-only bar button: hide the glyph and center the spinner over its place. */
.zine-controls-btn.zine-controls-busy > svg { visibility: hidden; }
.zine-controls-btn.zine-controls-busy::after {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -7px 0 0 -7px;
}
/* Menu item (glyph + label): let the glyph and label stand, and trail the spinner after them. */
.zine-controls-menu .zine-controls-btn.zine-controls-busy > svg { visibility: visible; }
.zine-controls-menu .zine-controls-btn.zine-controls-busy::after { position: static; }
@keyframes zine-controls-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .zine-controls-btn.zine-controls-busy::after { animation-duration: 1.6s; }
}
/* A custom widget cannot always be disabled itself, so it is marked instead and reads the same. */
.zine-controls-off { opacity: 0.38; }
.zine-controls-off[aria-disabled='true'] { pointer-events: none; }
.zine-controls-btn[aria-pressed="true"],
.zine-controls-btn[aria-expanded="true"] { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }

.zine-controls-sep {
  width: 1px;
  align-self: stretch;
  margin: 3px 3px;
  background: currentColor;
  opacity: 0.22;
}
.zine-controls-left .zine-controls-sep,
.zine-controls-right .zine-controls-sep { width: auto; height: 1px; margin: 3px 3px; }

.zine-controls-page {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 3px;
  pointer-events: auto;
  white-space: nowrap;
}
.zine-controls-page input {
  width: 2.2em;
  padding: 2px 3px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 4px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.25));
  color: inherit;
  font: inherit;
  text-align: center;
  -moz-appearance: textfield;
}
.zine-controls-page input::-webkit-outer-spin-button,
.zine-controls-page input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.zine-controls-page input:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 0;
}

.zine-controls-menu {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 152px;
  padding: 4px;
  border-radius: 8px;
  pointer-events: auto;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.94)));
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(8px);
}
.zine-controls-menu .zine-controls-btn {
  width: 100%;
  height: auto;
  gap: 8px;
  padding: 6px 8px;
  justify-content: flex-start;
}

/* The right-click menu opens in a fixed, viewport-spanning layer so the menu's absolute left/top
   are plain client coordinates — it lands under the cursor without the container having to be a
   positioning context. The layer itself is click-through; only the menu inside it takes events. */
.zine-context-layer {
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  font: 500 12px/1.2 system-ui, sans-serif;
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  -webkit-user-select: none;
  user-select: none;
}

/* Search shares the rail: a query field pinned at the top over a scrolling list of hits. */
.zine-search { gap: 0; overflow: hidden; }
.zine-search-input {
  flex: 0 0 auto;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 6px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.25));
  color: inherit;
  font: inherit;
  box-sizing: border-box;
}
/* Replace the browser's default (white) focus ring with the accent ring the other controls use. */
.zine-search-input:focus-visible {
  outline: none;
  border-color: var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  box-shadow: 0 0 0 1px var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
}
.zine-search-hits {
  flex: 1 1 auto;
  overflow-y: auto;
  /* Chain overscroll up to the page: once the list is at its end (or too short to scroll at all),
     a further wheel scrolls the page behind, the same as scrolling over the book itself does. */
  overscroll-behavior: auto;
  margin-top: 5px;
  scrollbar-width: thin;
}
.zine-search-hit {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.zine-search-hit:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-search-hit:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-search-page { display: block; font-size: 0.9em; opacity: 0.85; }
.zine-search-hit small {
  display: block;
  margin-top: 2px;
  opacity: 0.62;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

/* Page-turn arrows flanking the book. Like the docked toolbar and the side panels, they sit
   outside the container so they never shrink the book or intercept its gestures. */
.zine-arrows-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.zine-arrows-wrap > *:not(.zine-arrow) { flex: 1 1 auto; min-width: 0; min-height: 0; }
.zine-arrow {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;
  /* Light on a light page, dark on a dark one. The shadow below carries the contrast. */
  color: var(--zine-controls-fg, light-dark(#f4f4f5, #18181b));
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  /* No grey tap box on touch; the :active tint below is the press feedback instead. */
  -webkit-tap-highlight-color: transparent;
}
.zine-arrow svg {
  width: 36px;
  height: 36px;
  stroke-width: 2.25;
  /* No backing disc, so a subtle offset shadow keeps the chevron from disappearing into a
     matching background. It contrasts the fill: a light chevron (light mode) casts a soft dark
     shadow, a dark chevron (dark mode) a soft light one, offset rather than a glowing halo. */
  filter: drop-shadow(0 1px 2px light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.35)));
}
/* Feedback intensifies the chevron toward its extreme (white in light mode, black in dark)
   rather than tinting it, so no new colour is introduced. Not tied to --zine-controls-fg: that
   sets the resting fill, and hover has to differ from it to read as feedback. :active clears on
   release, so tap and click feel the same; :hover is behind (hover: hover) so it never sticks on
   touch. */
.zine-arrow:active:not(:disabled) { color: light-dark(#ffffff, #000000); }
@media (hover: hover) {
  .zine-arrow:hover:not(:disabled) { color: light-dark(#ffffff, #000000); }
}
.zine-arrow:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 2px;
  border-radius: 8px;
}
/* Nothing to turn to: invisible, but still occupying its slot so the book does not slide across
   as the reader reaches a cover. */
.zine-arrow-hidden { visibility: hidden; }
/* Device-scoped arrows (controls.arrows: 'desktop' | 'mobile'). The split follows the same 640px
   breakpoint as the flank/overlay layouts below, so the arrows appear and disappear live as the
   window crosses it. */
@media (max-width: 640px) {
  .zine-arrows-desktop > .zine-arrow { display: none; }
}
@media (min-width: 641px) {
  .zine-arrows-mobile > .zine-arrow { display: none; }
}
/* Too narrow to flank without squeezing the pages, so overlay the arrows on the book's edges
   instead. The wrap sits outside the container, so painting them over it leaves the container's
   measured box (which sizes the book and maps taps) untouched. */
@media (max-width: 640px) {
  .zine-arrows-wrap { position: relative; }
  .zine-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    /* Sit back over the page so the reader can look at the book. */
    opacity: 0.7;
  }
  .zine-arrow:first-child { left: -2px; }
  .zine-arrow:last-child { right: -2px; }
}
@media (prefers-reduced-motion: no-preference) {
  .zine-arrow { transition: background 120ms ease; }
}

/* Side panels (thumbnails, outline, search). The rail wraps the book and its docked toolbar so it
   sits beside them as a flex sibling. On a wide screen the book shrinks to make room (below); on a
   narrow one the rail becomes a drawer over the book.
   align-items:flex-start, not stretch: the book sizes its height from its width through its own
   aspect-ratio, and that height is 'auto' from flex's point of view, so a stretch would override it
   and blow the book (and the rail matched to it) up to the flex line's cross size. Left as auto, the
   book keeps its aspect height and the holder alone stretches down to meet it (below). */
.zine-panel-wrap { display: flex; align-items: flex-start; gap: 8px; position: relative; }

/* The book-side slot (the bare container, or the docked-toolbar wrapper around it) yields space to
   the fixed-width rail instead of overflowing: flex-shrink lets it fall below its own width, and
   min-width:0 removes the automatic content floor that would otherwise stop it. The book only
   actually shrinks if its width is elastic (a %, max-width, or the demo's min(...) with a % term);
   a hard-coded pixel width has nothing for the % to resolve smaller against. */
.zine-panel-wrap > *:not(.zine-panel-holder):not(.zine-panel-scrim) {
  flex: 0 1 auto;
  min-width: 0;
}
/* With a docked toolbar the book lives inside .zine-controls-wrap, whose children are pinned
   flex:0 0 auto (so the bar keeps its size). Inside a panel wrap the book child — everything but
   the bar itself — must instead be allowed to shrink, so left/right docking flanks like the rest.
   Top/bottom docking already shrinks through the container's own % width. */
.zine-panel-wrap .zine-controls-wrap > *:not(.zine-controls) {
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
}
@media (prefers-reduced-motion: no-preference) {
  .zine-panel-wrap > *:not(.zine-panel-holder):not(.zine-panel-scrim) {
    transition: flex-basis 160ms ease, width 160ms ease;
  }
}

/* The holder stretches to the book's height; the rail is absolutely positioned inside it so a
   long list scrolls rather than growing the row and running past the bottom of the book. */
.zine-panel-holder {
  position: relative;
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 0;
}
/* The scrim dims the book behind the narrow-screen drawer. It exists on every screen but only
   shows under the breakpoint below, so on a wide screen it takes no flex slot and never intercepts
   a click. */
.zine-panel-scrim { display: none; }
.zine-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  /* Chain overscroll up to the page: once the list is at its end (or too short to scroll at all),
     a further wheel scrolls the page behind, the same as scrolling over the book itself does. */
  overscroll-behavior: auto;
  /* Reserve the scrollbar's lane whether or not it is showing, so rows never sit under the bar
     and the close button (inset past this lane below) has a fixed edge to clear. */
  scrollbar-gutter: stable;
  padding: 6px;
  box-sizing: border-box;
  border-radius: 8px;
  background: var(--zine-controls-bg, light-dark(rgba(255, 255, 255, 0.94), rgba(24, 24, 27, 0.82)));
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
  font: 500 11px/1.2 system-ui, sans-serif;
  scrollbar-width: thin;
  touch-action: auto;
  -webkit-user-select: none;
  user-select: none;
}
/* The rail sits flush against the book's reading-start edge (left, or right in RTL), so its outer
   corners there would round away from that edge and leave a gap. Square them; keep the interior
   corners, which face the page, rounded. */
.zine-panel { border-radius: 0 8px 8px 0; }
.zine-panel-wrap-rtl .zine-panel { border-radius: 8px 0 0 8px; }
/* Overlay fallback, used when the container has no parent to wrap. */
.zine-panel-overlay { position: absolute; inset: 0 auto 0 0; z-index: 3; }
.zine-panel-active { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.18))); }
.zine-panel-note { padding: 8px; opacity: 0.66; line-height: 1.4; }
/* Discoverable dismiss, floated in the rail's trailing-top (interior) corner, away from the book.
   It sits in the holder above the scrolling list so the list scrolls under it. A translucent
   backdrop keeps the glyph legible over a thumbnail or a line of text. */
.zine-panel-close {
  position: absolute;
  top: 6px;
  /* Inset past the reserved scrollbar gutter so the button never overlaps the bar. */
  right: 12px;
  z-index: 1;
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  /* Opaque so a light thumbnail underneath never shows through and dims the glyph. */
  background: light-dark(#f4f4f5, #27272a);
  color: inherit;
  cursor: pointer;
}
.zine-panel-close svg { width: 15px; height: 15px; }
/* Opaque hover, not the translucent hover token: a see-through backdrop over a light thumbnail
   would wash the glyph out. Solid neutrals keep the X readable in both themes over anything. */
.zine-panel-close:hover { background: light-dark(#e4e4e7, #3f3f46); }
.zine-panel-close:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-panel-wrap-rtl .zine-panel-close { right: auto; left: 12px; }
/* End the search field just before the close button rather than running under it, so the two sit
   side by side and the field's border reads cleanly. The button's inner edge is ~30px from the
   panel's content edge (24px wide, its right edge 6px in once the reserved scrollbar gutter is
   accounted for), so 30px leaves them flush with a hair of breathing room. width:auto lets the
   column's stretch fill the rest, so the margin shortens the field instead of overflowing 100%. */
.zine-search .zine-search-input { width: auto; align-self: stretch; margin-right: 30px; }
.zine-panel-wrap-rtl .zine-search .zine-search-input { margin-right: 0; margin-left: 30px; }

/* Overlay panels (outline, search) on a wide screen: float over the book's start edge instead of
   flanking it, so the book never resizes. The wrap drops to a block, laying the book out exactly as
   it was before the panel opened; the holder sits absolute over it at full book height, with a
   shadow so it reads as lifted off the page. thumbnails is not overlaid — it stays a flex flank and
   shrinks the book only when the two will not otherwise both fit. */
@media (min-width: 641px) {
  .zine-panel-wrap-overlay { display: block; }
  .zine-panel-wrap-overlay .zine-panel-holder {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 4;
    box-shadow: 0 0 24px light-dark(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.55));
  }
  .zine-panel-wrap-overlay.zine-panel-wrap-rtl .zine-panel-holder { inset: 0 0 0 auto; }
  /* Opaque over the page it floats on, unlike a flanking rail that sits against empty margin. */
  .zine-panel-wrap-overlay .zine-panel {
    background: var(--zine-controls-bg, light-dark(#ffffff, #18181b));
  }
  /* A click-away layer over the book, so pressing the page behind the floating rail closes it the
     way tapping the scrim does on a narrow screen. Transparent here — the wide-screen rail only
     covers an edge, so there is no need to dim the page the reader is still looking at. It sits
     under the holder (z-index) so the rail's own rows still take their clicks. */
  .zine-panel-wrap-overlay .zine-panel-scrim {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: transparent;
  }
}
@media (min-width: 641px) and (prefers-reduced-motion: no-preference) {
  .zine-panel-wrap-overlay .zine-panel-holder { animation: zine-drawer-in 180ms ease; }
  .zine-panel-wrap-overlay.zine-panel-wrap-rtl .zine-panel-holder { animation-name: zine-drawer-in-rtl; }
}

/* Narrow screen: no room to flank, so the rail becomes a drawer over the book and the scrim dims
   the page behind it. The wrap is position:relative, so the absolute holder and scrim below are
   measured against it — i.e. against the book's own box. */
@media (max-width: 640px) {
  /* No flanking here — the rail and scrim both overlay absolutely — so drop the flex row entirely.
     As a plain block wrap the book keeps the exact box it had before a panel opened (its own width,
     margin and aspect-ratio height); a flex row would instead re-resolve the book's width and, with
     it, its aspect-derived height, enlarging the canvas and pushing the page down. */
  .zine-panel-wrap {
    display: block;
  }
  .zine-panel-holder {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 4;
    /* Cap the drawer so it never eats the whole book; its inline width still applies under this. */
    max-width: 80%;
    box-shadow: 0 0 24px light-dark(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.6));
  }
  /* RTL reads from the right, so the drawer enters from there. */
  .zine-panel-wrap-rtl .zine-panel-holder { inset: 0 0 0 auto; }
  /* Opaque over the page, unlike the wide-screen rail which can sit against empty margin. */
  .zine-panel {
    background: var(--zine-controls-bg, light-dark(#ffffff, #18181b));
  }
  .zine-panel-scrim {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 3;
    background: rgba(0, 0, 0, 0.4);
  }
}
@media (max-width: 640px) and (prefers-reduced-motion: no-preference) {
  .zine-panel-holder { animation: zine-drawer-in 180ms ease; }
  .zine-panel-wrap-rtl .zine-panel-holder { animation-name: zine-drawer-in-rtl; }
  .zine-panel-scrim { animation: zine-scrim-in 180ms ease; }
}
@keyframes zine-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes zine-drawer-in-rtl { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes zine-scrim-in { from { opacity: 0; } to { opacity: 1; } }

.zine-thumbs { align-items: center; }

.zine-thumbs-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  width: 100%;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  box-sizing: border-box;
}
.zine-thumbs-row:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }
.zine-thumbs-row:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
.zine-thumbs-row.zine-panel-active .zine-thumbs-cell {
  outline: 1px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
}

/* Outline: a single column of headings, indented by depth. */
/* No gap: a hairline between rows is the separator instead, so a title that wraps to two lines
   still reads as one entry rather than blending into its neighbours. */
.zine-outline { gap: 0; }
.zine-outline-row {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-bottom: 1px solid var(--zine-controls-divider, light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.1)));
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  line-height: 1.35;
  cursor: pointer;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}
.zine-outline-row:last-child { border-bottom: 0; }
.zine-outline-row:hover:not(:disabled) {
  background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14)));
}
.zine-outline-row:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: -2px;
}
/* A heading whose destination could not be resolved: shown, but nothing to click through to. */
.zine-outline-row:disabled { opacity: 0.5; cursor: default; }

.zine-thumbs-cell {
  flex: 1 1 0;
  min-width: 0;
  min-height: 24px;
  display: flex;
  background: light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.3));
  border-radius: 2px;
  overflow: hidden;
}
/* A lone page in a book that pairs elsewhere (a cover, a back page) keeps one page's width and
   centres, instead of stretching across both columns. */
.zine-thumbs-row-lone .zine-thumbs-cell { flex: 0 0 calc(50% - 1px); }
.zine-thumbs-img { display: block; width: 100%; height: auto; }
.zine-thumbs-caption { flex: 1 0 100%; text-align: center; opacity: 0.7; }

/* Share dialog. Centred over the page rather than in the side rail: a QR and six destinations
   need more room than the rail gives, and sharing is a brief interruption, not a browsing mode. */
.zine-share-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
  font: 500 13px/1.4 system-ui, sans-serif;
  color: var(--zine-controls-fg, light-dark(#18181b, #f4f4f5));
}
.zine-share {
  width: min(320px, 100%);
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--zine-share-bg, light-dark(#ffffff, #1c1c20));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}
.zine-share-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.zine-share-head strong { font-size: 15px; }
.zine-share-close {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.zine-share-close svg { width: 16px; height: 16px; }
.zine-share-close:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.08), rgba(255,255,255,0.14))); }

.zine-share-qr {
  align-self: center;
  line-height: 0;
  padding: 8px;
  border-radius: 8px;
  background: #fff;
}
.zine-share-qr svg { display: block; }

.zine-share-link { display: flex; gap: 6px; }
.zine-share-link input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--zine-controls-hover, light-dark(rgba(0,0,0,0.14), rgba(255,255,255,0.2)));
  border-radius: 7px;
  background: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3));
  color: inherit;
  font: inherit;
}
.zine-share-copy {
  flex: 0 0 auto;
  min-width: 74px;
  padding: 7px 12px;
  border: 0;
  border-radius: 7px;
  background: var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  color: light-dark(#ffffff, #06202c);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.zine-share-socials { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.zine-share-social {
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
  color: inherit;
  text-decoration: none;
}
.zine-share-social svg { width: 19px; height: 19px; }
.zine-share-social:hover { background: var(--zine-controls-hover, light-dark(rgba(0,0,0,0.12), rgba(255,255,255,0.18))); }
.zine-share-close:focus-visible,
.zine-share-copy:focus-visible,
.zine-share-social:focus-visible,
.zine-share-link input:focus-visible {
  outline: 2px solid var(--zine-controls-accent, light-dark(#0284c7, #7dd3fc));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .zine-controls-btn { transition: background 120ms ease; }
}
`})),Pt=r({ShareDialog:()=>Lt}),Ft,It,Lt,Rt=n((()=>{L(),yt(),At(),J(),Ft=132,It=1600,Lt=class{#e;#t;#n;#r;#i=null;#a;#o;constructor(e,t,n=`auto`){let r=t.ownerDocument;this.#e=r,this.#r=r.activeElement,this.#o=e.strings;let i=e.pageLink(),a=r.title||this.#o.shareFallbackTitle;this.#t=r.createElement(`div`),this.#t.className=`zine-share-backdrop`,q(this.#t,n),this.#t.addEventListener(`pointerdown`,e=>{e.target===this.#t&&this.close()}),this.#n=r.createElement(`div`),this.#n.className=`zine-share`,this.#n.setAttribute(`role`,`dialog`),this.#n.setAttribute(`aria-modal`,`true`),this.#n.setAttribute(`aria-label`,this.#o.share),this.#t.appendChild(this.#n);let o=r.createElement(`div`);o.className=`zine-share-head`;let s=r.createElement(`strong`);s.textContent=this.#o.share;let c=r.createElement(`button`);c.type=`button`,c.className=`zine-share-close`,c.setAttribute(`aria-label`,this.#o.close),c.appendChild(F(r,I.close)),c.addEventListener(`click`,()=>this.close()),o.append(s,c),this.#n.append(o,this.#c(r,i),this.#u(r,i,a));let l=this.#s(r,i);l&&this.#n.insertBefore(l,this.#n.children[1]),t.ownerDocument.body.appendChild(this.#t),this.#a=e=>{e.key===`Escape`&&this.close(),e.key===`Tab`&&this.#d(e)},this.#t.addEventListener(`keydown`,this.#a),c.focus()}#s(e,t){if(!t)return null;try{let n=e.createElement(`div`);return n.className=`zine-share-qr`,n.innerHTML=Tt(t,Ft),n.setAttribute(`aria-label`,this.#o.qrLabel),n.setAttribute(`role`,`img`),n}catch{return null}}#c(e,t){let n=e.createElement(`div`);n.className=`zine-share-link`;let r=e.createElement(`input`);r.type=`text`,r.readOnly=!0,r.value=t,r.setAttribute(`aria-label`,this.#o.linkLabel),r.addEventListener(`focus`,()=>r.select());let i=e.createElement(`button`);return i.type=`button`,i.className=`zine-share-copy`,i.textContent=this.#o.copy,i.addEventListener(`click`,()=>{this.#l(t,i)}),n.append(r,i),n}async#l(e,t){try{await navigator.clipboard?.writeText(e),t.textContent=this.#o.copied}catch{t.textContent=this.#o.copyManual}this.#i&&clearTimeout(this.#i),this.#i=setTimeout(()=>{t.textContent=this.#o.copy},It)}#u(e,t,n){let r=e.createElement(`div`);r.className=`zine-share-socials`;for(let i of vt){let a=e.createElement(`a`);a.className=`zine-share-social`,a.href=i.href(t,n);let o=i.id===`email`?this.#o.email:i.label;a.title=o,a.setAttribute(`aria-label`,this.#o.shareOn(o)),i.id!==`email`&&(a.target=`_blank`,a.rel=`noopener noreferrer`),a.appendChild(F(e,i.icon)),r.appendChild(a)}return r}#d(e){let t=[...this.#n.querySelectorAll(`button, a[href], input`)].filter(e=>!e.hasAttribute(`disabled`));if(t.length===0)return;let n=t[0],r=t.at(-1),i=this.#e.activeElement;e.shiftKey&&i===n?(r.focus(),e.preventDefault()):!e.shiftKey&&i===r&&(n.focus(),e.preventDefault())}close(){this.destroy()}destroy(){this.#i&&clearTimeout(this.#i),this.#i=null,this.#t.removeEventListener(`keydown`,this.#a),this.#t.remove(),this.#r?.focus?.()}}}));function zt(){R({id:`prev`,title:e=>e.strings.prevPage,icon:I.prev,isDisabled:e=>!e.zine.canFlipPrev(),action:e=>e.zine.flipPrev()}),R({id:`next`,title:e=>e.strings.nextPage,icon:I.next,isDisabled:e=>!e.zine.canFlipNext(),action:e=>e.zine.flipNext()});let e=e=>e.zine.getDirection()===`rtl`;R({id:`first`,title:e=>e.strings.firstPage,icon:t=>e(t)?I.last:I.first,isDisabled:e=>!e.zine.canFlipPrev(),action:e=>{e.zine.flipTo(0),e.close()}}),R({id:`last`,title:e=>e.strings.lastPage,icon:t=>e(t)?I.first:I.last,isDisabled:e=>!e.zine.canFlipNext(),action:e=>{e.zine.flipTo(e.zine.getPageCount()-1),e.close()}}),R({id:`zoomIn`,title:e=>e.strings.zoomIn,icon:I.zoomIn,isDisabled:e=>e.zine.getZoom()>=e.zine.getMaxZoom()-1e-6,action:e=>e.zine.setZoom(e.zine.getZoom()*Bt)}),R({id:`zoomOut`,title:e=>e.strings.zoomOut,icon:I.zoomOut,isDisabled:e=>e.zine.getZoom()<=1.000001,action:e=>e.zine.setZoom(e.zine.getZoom()/Bt)}),R({id:`fullscreen`,title:e=>e.strings.fullscreen,icon:I.fullscreen,isVisible:e=>typeof e.zine.container.requestFullscreen==`function`,isActive:Vt,action:e=>{let t=e.zine.container.ownerDocument;Vt(e)?t?.exitFullscreen?.():e.zine.container.requestFullscreen?.(),e.close()}}),R({id:`mute`,title:e=>e.zine.isSoundMuted()?e.strings.unmute:e.strings.mute,icon:e=>e.zine.isSoundMuted()?I.soundOff:I.soundOn,isVisible:e=>e.zine.isSoundEnabled(),isActive:e=>e.zine.isSoundMuted(),action:e=>e.zine.setSoundMuted(!e.zine.isSoundMuted())}),R({id:`share`,title:e=>e.strings.share,icon:I.share,action:e=>{e.close(),Promise.resolve().then(()=>(Rt(),Pt)).then(({ShareDialog:t})=>new t(e.zine,e.zine.container,e.colorScheme)).catch(()=>{navigator.clipboard?.writeText(e.zine.pageLink()).catch(()=>{})})}}),R({id:`download`,title:e=>e.strings.downloadPdf,icon:I.download,isVisible:e=>e.zine.canDownload(),action:async e=>{await e.zine.download(),e.close()}}),R({id:`spread`,title:e=>e.zine.isSinglePage()?e.strings.showTwoPages:e.strings.showOnePage,icon:e=>e.zine.isSinglePage()?I.twoPages:I.onePage,isVisible:e=>!e.zine.isResponsiveSingle(),action:e=>{e.zine.toggleSpreadMode(),e.close()}}),R({id:`print`,title:e=>e.strings.print,icon:I.print,isVisible:e=>e.zine.canPrint(),action:async e=>{await e.zine.print(),e.close()}}),R({id:`menu`,title:e=>e.strings.more,icon:I.menu,children:[`first`,`last`,`spread`,`thumbnails`,`outline`,`mute`,`print`,`download`]})}var Bt,Vt,Ht=n((()=>{L(),V(),Bt=Math.SQRT2,Vt=e=>e.zine.container.ownerDocument?.fullscreenElement===e.zine.container}));function Ut(e){return e===`|`?null:typeof e==`string`?e:e.id}function Wt(e,t){return t.size?e.filter(e=>{let n=Ut(e);return n===null||!t.has(n)}):e}function Gt(e,t){return typeof e.title==`function`?e.title(t):e.title}function Kt(e,t){return typeof e.icon==`function`?e.icon(t):e.icon}function qt(e){return e instanceof HTMLButtonElement||e instanceof HTMLInputElement?[e]:[...e.querySelectorAll(`button, input`)]}function Jt(e,t){e.classList.toggle(`zine-controls-busy`,t),e.setAttribute(`aria-busy`,String(t)),e.disabled=t}function Yt(e,t,n,r){if(e.isDisabled?.(n)||t.classList.contains(`zine-controls-busy`))return;let i=e.action?.(n);i&&typeof i.then==`function`&&(Jt(t,!0),i.finally(()=>{Jt(t,!1),r()})),r()}function Xt(e,t,n,r,i,a=!1){let o=e.createElement(`button`),s=Gt(t,r),c=Kt(t,r);if(o.type=`button`,o.className=n,o.title=s,o.setAttribute(`aria-label`,s),c&&o.appendChild(F(e,c)),a||!c){let t=e.createElement(`span`);t.className=`zine-controls-label`,t.textContent=s,o.appendChild(t)}return o.addEventListener(`click`,()=>i(t,o)),o}function Zt(e,t,n,r,i){let a=i??t.isVisible?.(n);a!==void 0&&(e.style.display=a?``:`none`);let o=e.classList.contains(`zine-controls-busy`),s=(t.isDisabled?.(n)??!1)||o,c=qt(e);for(let e of c)e.disabled=s;if(c.length||e.setAttribute(`aria-disabled`,String(s)),e.classList.toggle(`zine-controls-off`,s),t.isActive&&e.setAttribute(`aria-pressed`,String(t.isActive(n))),typeof t.title==`function`){let r=t.title(n);e.title=r,e.setAttribute(`aria-label`,r);let i=e.querySelector(`.zine-controls-label`);i&&(i.textContent=r)}typeof t.icon==`function`&&e.querySelector(`svg`)?.replaceWith(F(r,t.icon(n)))}function Qt(e,t,n=$t){return e.isVisible&&!e.isVisible(t)?!1:Wt(e.children??[],n).some(e=>{if(e===`|`)return!1;let n=_t(e);return!n.isVisible||n.isVisible(t)})}var $t,en,tn=n((()=>{L(),V(),$t=new Set,en=class{el;#e;#t;#n;#r;#i=[];constructor(e,t,n,r=$t){this.#e=e,this.#t=t,this.#n=n,this.#r=r,this.el=e.createElement(`div`),this.el.className=`zine-controls-menu`,this.el.setAttribute(`role`,`menu`)}build(e){this.el.replaceChildren(),this.#i=[];let t=this.#t();for(let n of Wt(e,this.#r)){if(n===`|`)continue;let e=_t(n);if(e.isVisible&&!e.isVisible(t))continue;let r;r=e.render?e.render(this.#t()):Xt(this.#e,e,`zine-controls-btn`,t,(e,t)=>Yt(e,t,this.#t(),this.#n),!0),r.setAttribute(`role`,`menuitem`),this.el.appendChild(r),this.#i.push({el:r,def:e})}}refresh(){let e=this.#t();for(let{el:t,def:n}of this.#i)Zt(t,n,e,this.#e)}contains(e){return e!==null&&this.el.contains(e)}focusFirst(){this.el.querySelector(`button`)?.focus()}destroy(){this.el.remove(),this.#i=[]}}})),Y,nn=n((()=>{L(),Y=class{root;#e;#t=null;#n=null;#r=null;#i=null;#a;#o=null;#s=null;constructor(e,t,n){this.#a=e,this.#e=e.createElement(`div`),this.#e.className=`zine-panel-holder`,this.#e.style.width=`${n.width}px`,this.#o=n.pageBox??null,this.root=e.createElement(`div`),this.root.className=`zine-panel ${n.className}`,this.root.setAttribute(`role`,`listbox`),this.root.setAttribute(`aria-label`,n.label),this.#e.appendChild(this.root);for(let e of[`pointerdown`,`pointerup`,`pointermove`,`click`,`dblclick`,`wheel`])this.root.addEventListener(e,e=>e.stopPropagation());this.#u(e,t,n.rtl??!1,n.overlay??!1),n.onDismiss&&this.#d(e,n.onDismiss,n.closeLabel??`Close`),this.#c(t)}#c(e){this.#o&&(this.#l(),!(typeof ResizeObserver>`u`)&&(this.#s=new ResizeObserver(()=>this.#l()),this.#s.observe(e)))}#l(){let e=this.#o?.();e&&(this.#e.style.top=`${e.y}px`,this.#e.style.bottom=`auto`,this.#e.style.height=`${e.height}px`)}setWidth(e){this.#e.style.width=`${e}px`}#u(e,t,n,r){if(!t.parentNode){this.#e.classList.add(`zine-panel-overlay`),t.appendChild(this.#e);return}let i=t.closest(`.zine-controls-wrap`)??t,a=e.createElement(`div`);a.className=`zine-panel-wrap`,n&&a.classList.add(`zine-panel-wrap-rtl`),r&&a.classList.add(`zine-panel-wrap-overlay`),i.parentNode.insertBefore(a,i),a.append(this.#e,i),this.#t=a}#d(e,t,n){let r=e.createElement(`button`);if(r.type=`button`,r.className=`zine-panel-close`,r.setAttribute(`aria-label`,n),r.appendChild(F(e,I.close)),r.addEventListener(`click`,e=>{e.stopPropagation(),t()}),this.#e.appendChild(r),this.#r=r,this.#t){let n=e.createElement(`div`);n.className=`zine-panel-scrim`,this.#t.insertBefore(n,this.#e);for(let e of[`pointerdown`,`click`])n.addEventListener(e,e=>{e.stopPropagation(),t()});this.#n=n}this.#i=e=>{e.key===`Escape`&&t()},e.addEventListener(`keydown`,this.#i)}destroy(){this.#s?.disconnect(),this.#s=null,this.#i&&=(this.#a.removeEventListener(`keydown`,this.#i),null),this.#n?.remove(),this.#n=null,this.#r=null,this.#e.remove();let e=this.#t;if(e?.parentNode){for(;e.firstChild;)e.parentNode.insertBefore(e.firstChild,e);e.remove()}this.#t=null}}})),rn,an,on=n((()=>{nn(),rn=78,an=class{root;#e;#t;#n;#r=[];#i=null;#a=[];constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#n=new Y(r,t,{className:`zine-thumbs`,label:e.strings.thumbnailsLabel,closeLabel:e.strings.close,width:90,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#o(),this.#a.push(e.on(`pageChanged`,()=>this.#l())),this.#l()}#o(){let e=this.#e.getSpreads(),t=this.#e.getDirection()===`rtl`,n=e.some(e=>e.left!==null&&e.right!==null);this.#n.root.classList.toggle(`zine-thumbs-solo`,!n),n&&this.#n.setWidth(170);for(let[r,i]of e.entries()){let e=this.#t.createElement(`button`);e.type=`button`,e.className=`zine-thumbs-row`,e.setAttribute(`role`,`option`),t&&(e.style.flexDirection=`row-reverse`);let a=[i.left,i.right].filter(e=>e!==null);n&&a.length===1&&e.classList.add(`zine-thumbs-row-lone`);for(let t of a){let n=this.#t.createElement(`span`);n.className=`zine-thumbs-cell`,n.dataset.page=String(t),e.appendChild(n)}let o=[...a].sort((e,t)=>e-t).map(e=>e+1);e.setAttribute(`aria-label`,this.#e.strings.thumbnailAria(o.map(String)));let s=this.#t.createElement(`span`);s.className=`zine-thumbs-caption`,s.textContent=o.join(`–`),e.appendChild(s),e.addEventListener(`click`,()=>{a.length>0&&this.#e.flipTo(Math.min(...a))}),this.#n.root.appendChild(e),this.#r.push({el:e,spread:r,pages:a})}this.#s()}#s(){let e=[...this.#n.root.querySelectorAll(`.zine-thumbs-cell[data-page]`)];if(typeof IntersectionObserver>`u`){for(let t of e)this.#c(t);return}this.#i=new IntersectionObserver((e,t)=>{for(let n of e)n.isIntersecting&&(t.unobserve(n.target),this.#c(n.target))},{root:this.#n.root,rootMargin:`200px`});for(let t of e)this.#i.observe(t)}async#c(e){let t=Number(e.dataset.page),n=await this.#e.getPageImage(t);if(!n||!e.isConnected)return;let r=n.width,i=n.height;if(!r||!i)return;let a=Math.min(2,globalThis.devicePixelRatio||1),o=this.#t.createElement(`canvas`);o.width=Math.max(1,Math.round(rn*a)),o.height=Math.max(1,Math.round(rn*i/r*a)),o.className=`zine-thumbs-img`;let s=o.getContext(`2d`);if(s){try{s.drawImage(n,0,0,o.width,o.height)}catch{return}e.replaceChildren(o)}}#l(){let e=this.#e.getPage();for(let{el:t,pages:n}of this.#r){let r=n.includes(e);t.classList.toggle(`zine-panel-active`,r),t.setAttribute(`aria-selected`,String(r)),r&&t.scrollIntoView?.({block:`nearest`})}}destroy(){for(let e of this.#a)e();this.#a=[],this.#i?.disconnect(),this.#i=null,this.#n.destroy()}}})),sn,cn,ln,un=n((()=>{nn(),sn=208,cn=12,ln=class{root;#e;#t;#n;#r=[];#i=[];#a;constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#a=n.onDismiss,this.#n=new Y(r,t,{className:`zine-outline`,label:e.strings.outlineLabel,closeLabel:e.strings.close,width:sn,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,overlay:!0,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#o(e.strings.outlineLoading),this.#s(),this.#i.push(e.on(`pageChanged`,()=>this.#l()))}#o(e){let t=this.#t.createElement(`div`);t.className=`zine-panel-note`,t.textContent=e,this.#n.root.replaceChildren(t)}async#s(){let e=await this.#e.getOutline();if(this.#n.root.isConnected){if(e.length===0){this.#o(this.#e.strings.outlineEmpty);return}this.#n.root.replaceChildren(),this.#c(e,0),this.#l()}}#c(e,t){for(let n of e){let e=this.#t.createElement(`button`);e.type=`button`,e.className=`zine-outline-row`,e.setAttribute(`role`,`option`),e.style.paddingLeft=`${8+t*cn}px`;let r=n.title.trim()||this.#e.strings.untitled;if(e.textContent=r,e.title=r,n.page===null)e.disabled=!0;else{let t=n.page;e.setAttribute(`aria-label`,this.#e.strings.outlineEntryAria(r,t+1)),e.addEventListener(`click`,()=>{this.#e.flipTo(t),this.#a?.()}),this.#r.push({el:e,page:t})}this.#n.root.appendChild(e),n.children.length>0&&this.#c(n.children,t+1)}}#l(){let e=this.#e.getPage(),t=null,n=-1;for(let{el:r,page:i}of this.#r)r.classList.remove(`zine-panel-active`),r.removeAttribute(`aria-selected`),i<=e&&i>=n&&(t=r,n=i);t&&(t.classList.add(`zine-panel-active`),t.setAttribute(`aria-selected`,`true`),t.scrollIntoView?.({block:`nearest`}))}destroy(){for(let e of this.#i)e();this.#i=[],this.#n.destroy()}}})),dn,fn,pn,mn,hn=n((()=>{nn(),dn=208,fn=180,pn=2,mn=class{root;#e;#t;#n;#r;#i;#a=0;#o=null;#s;#c=[];constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#s=n.onDismiss,this.#n=new Y(r,t,{className:`zine-search`,label:e.strings.searchResultsLabel,closeLabel:e.strings.close,width:dn,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,overlay:!0,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#r=r.createElement(`input`),this.#r.type=`search`,this.#r.className=`zine-search-input`,this.#r.placeholder=e.strings.searchPlaceholder,this.#r.setAttribute(`aria-label`,e.strings.searchInputLabel),this.#r.addEventListener(`input`,()=>{this.#o&&clearTimeout(this.#o),this.#o=setTimeout(()=>void this.#u(),fn)}),this.#r.addEventListener(`keydown`,e=>{e.key===`Enter`&&(this.#o&&clearTimeout(this.#o),this.#u())}),this.#i=r.createElement(`div`),this.#i.className=`zine-search-hits`,this.#n.root.append(this.#r,this.#i);let i=n.state;i&&i.query&&(this.#r.value=i.query,this.#a++,this.#d(i.query,i.results)),this.#r.focus()}getState(){return{query:this.#r.value,results:this.#c}}#l(e){let t=this.#t.createElement(`div`);t.className=`zine-panel-note`,t.textContent=e,this.#i.replaceChildren(t)}async#u(){let e=this.#r.value.trim(),t=++this.#a;if(e.length<pn){this.#c=[],this.#i.replaceChildren();return}this.#l(this.#e.strings.searching);let n=await this.#e.search(e);t!==this.#a||!this.#n.root.isConnected||this.#d(e,n)}#d(e,t){if(this.#c=t,t.length===0){this.#l(this.#e.strings.noMatches(e));return}this.#i.replaceChildren(...t.map(e=>{let t=this.#t.createElement(`button`);t.type=`button`,t.className=`zine-search-hit`,t.setAttribute(`role`,`option`),t.setAttribute(`aria-label`,this.#e.strings.searchHitAria(e.page+1,e.excerpt));let n=this.#t.createElement(`span`);n.className=`zine-search-page`,n.textContent=this.#e.strings.searchHitLabel(e.page+1);let r=this.#t.createElement(`small`);return r.textContent=e.excerpt,t.append(n,r),t.addEventListener(`click`,()=>{this.#e.flipTo(e.page),this.#s?.()}),t}))}destroy(){this.#o&&clearTimeout(this.#o),this.#o=null,this.#a++,this.#n.destroy()}}})),gn,_n=n((()=>{L(),J(),gn=class{#e;#t;#n;#r=null;#i;#a=[];constructor(e,t,n=`auto`,r=null){this.#e=e,this.#i=r;let i=t.ownerDocument,a=e.getDirection()===`rtl`;if(this.#t=this.#o(i,a?I.next:I.prev,e.strings.prevPage,()=>e.flipPrev()),this.#n=this.#o(i,a?I.prev:I.next,e.strings.nextPage,()=>e.flipNext()),this.#s(i,t),this.#r)q(this.#r,n);else for(let e of[this.#t,this.#n])q(e,n);this.#a.push(e.on(`pageChanged`,({page:e})=>this.#c(e))),this.#a.push(e.on(`flipEnd`,()=>this.#c())),this.#c()}#o(e,t,n,r){let i=e.createElement(`button`);i.type=`button`,i.className=`zine-arrow`,i.title=n,i.setAttribute(`aria-label`,n),i.appendChild(F(e,t)),i.addEventListener(`click`,r);for(let e of[`pointerdown`,`pointerup`,`click`])i.addEventListener(e,e=>e.stopPropagation());return i}#s(e,t){let n=t.closest(`.zine-panel-wrap`)??t.closest(`.zine-controls-wrap`)??t,r=n.parentNode;if(!r)return;let i=e.createElement(`div`);i.className=`zine-arrows-wrap`,this.#i&&i.classList.add(`zine-arrows-${this.#i}`),r.insertBefore(i,n),i.append(this.#t,n,this.#n),this.#r=i}#c(e){let{prev:t,next:n}=this.#l(e);for(let[e,r]of[[this.#t,t],[this.#n,n]])e.disabled=!r,e.classList.toggle(`zine-arrow-hidden`,!r)}#l(e){if(e!==void 0){let t=this.#e.getSpreads(),n=t.findIndex(t=>t.left===e||t.right===e);if(n>=0)return{prev:n>0,next:n+1<t.length}}return{prev:this.#e.canFlipPrev(),next:this.#e.canFlipNext()}}destroy(){for(let e of this.#a)e();this.#a=[],this.#t.remove(),this.#n.remove();let e=this.#r;if(e?.parentNode){for(;e.firstChild;)e.parentNode.insertBefore(e.firstChild,e);e.remove()}this.#r=null}}}));function vn(e){let t=[];for(let n of e)n===`|`&&(t.length===0||t[t.length-1]===`|`)||t.push(n);return t[t.length-1]===`|`&&t.pop(),t}function yn(e){zt(),R({id:`thumbnails`,title:t=>e.openPanel()===`thumbnails`?t.strings.hideThumbnails:t.strings.showThumbnails,icon:I.thumbnails,isVisible:e=>e.zine.isDocument(),isActive:()=>e.openPanel()===`thumbnails`,action:t=>{e.togglePanel(`thumbnails`),t.close()}}),R({id:`outline`,title:t=>e.openPanel()===`outline`?t.strings.hideOutline:t.strings.showOutline,icon:I.outline,isVisible:()=>e.hasOutline(),isActive:()=>e.openPanel()===`outline`,action:t=>{e.togglePanel(`outline`),t.close()}}),R({id:`pageInput`,title:e=>e.strings.pageWidgetLabel,render:()=>e.makePageInput()}),R({id:`search`,title:t=>e.openPanel()===`search`?t.strings.searchClose:t.strings.searchOpen,icon:I.search,isVisible:e=>e.zine.canSearch(),isActive:()=>e.openPanel()===`search`,action:()=>e.togglePanel(`search`)})}var bn,xn,Sn,Cn=n((()=>{L(),V(),Ht(),tn(),J(),on(),un(),hn(),_n(),bn={thumbnails:an,outline:ln,search:mn},xn=[`pointerdown`,`pointerup`,`pointermove`,`click`,`dblclick`,`wheel`,`keydown`],Sn=class{#e;#t;#n;#r;#i=[];#a=null;#o=[];#s=null;#c=null;#l;#u=null;#d=null;#f=null;#p=null;#m=null;#h;#g;#_;constructor(e,t,n,r=new Set){this.#e=e,this.#l=t,this.#_=r;let i=t.ownerDocument;this.#t=i,jt(i),this.#h=n.colorScheme??`auto`;let a=n.position??`bottom`;this.#g=a;let o=n.docked??!0;this.#n=i.createElement(`div`),this.#n.className=[`zine-controls`,`zine-controls-${a}`,o?`zine-controls-docked`:`zine-controls-floating`,n.className].filter(Boolean).join(` `),this.#n.setAttribute(`role`,`toolbar`),this.#n.setAttribute(`aria-label`,this.#e.strings.controlsLabel),q(this.#n,this.#h),this.#r=i.createElement(`div`),this.#r.className=`zine-controls-bar`,this.#n.appendChild(this.#r),this.#n.addEventListener(`keydown`,e=>this.#E(e));for(let e of xn)this.#n.addEventListener(e,e=>this.#y(e));this.#v(t,a,o);let s=()=>this.#D();this.#o.push(e.on(`pageChanged`,s)),this.#o.push(e.on(`zoomChanged`,s)),this.#o.push(e.on(`flipEnd`,s));let c=e=>{if(!this.#a)return;let t=e.target;this.#a.menu.contains(t)||this.#a.trigger.contains(t)||this.#T()};i.addEventListener(`pointerdown`,c,!0),this.#o.push(()=>i.removeEventListener(`pointerdown`,c,!0))}#v(e,t,n){if(!n){e.appendChild(this.#n);return}let r=e.parentNode;if(!r){this.#n.classList.replace(`zine-controls-docked`,`zine-controls-floating`),e.appendChild(this.#n);return}let i=this.#t.createElement(`div`);i.className=`zine-controls-wrap zine-controls-wrap-${t}`,r.insertBefore(i,e),i.appendChild(e),t===`top`||t===`left`?i.insertBefore(this.#n,e):i.appendChild(this.#n),this.#c=i}mount(e){this.#x(e.items??B);let t=e.arrows??!0;t!==!1&&(this.#m=new gn(this.#e,this.#l,this.#h,t===!0?null:t)),this.#D(),this.#O()}destroy(){for(let e of this.#o)e();this.#o=[],this.#T(),this.#u?.destroy(),this.#u=null,this.#d=null,this.#n.remove();let e=this.#c;e?.parentNode&&(e.parentNode.insertBefore(e.firstChild,e),e.remove()),this.#c=null,this.#m?.destroy(),this.#m=null}#y(e){e.stopPropagation()}#b(e=()=>this.#T()){return{zine:this.#e,close:e,colorScheme:this.#h,strings:this.#e.strings}}#x(e){for(let t of vn(Wt(e,this.#_))){if(t===`|`){let e=this.#t.createElement(`div`);e.className=`zine-controls-sep`,this.#r.appendChild(e);continue}let e=_t(t),n;n=e.render?e.render(this.#b()):Xt(this.#t,e,`zine-controls-btn`,this.#b(),(e,t)=>this.#S(e,t)),this.#i.push({el:n,def:e}),this.#r.appendChild(n)}}#S(e,t){if(!e.isDisabled?.(this.#b())){if(e.children){this.#a?.trigger===t?this.#T():this.#C(e,t);return}Yt(e,t,this.#b(),()=>this.#D())}}#C(e,t){this.#T();let n=new en(this.#t,()=>this.#b(),()=>this.#D(),this.#_);n.build(e.children??[]),this.#n.appendChild(n.el),this.#a={menu:n,trigger:t},t.setAttribute(`aria-expanded`,`true`),this.#w(n.el,t),n.refresh(),n.focusFirst()}#w(e,t){let n=this.#n.getBoundingClientRect(),r=t.getBoundingClientRect(),i=e.getBoundingClientRect();if(!n.width||!i.width)return;let a=r.left-n.left+r.width/2-i.width/2;a=Math.max(4,Math.min(a,n.width-i.width-4)),e.style.left=`${a}px`;let o=r.bottom-n.top+6,s=r.top-n.top-i.height-6;e.style.top=`${this.#g===`bottom`||s>=0?s:o}px`}#T(){if(!this.#a)return;let{menu:e,trigger:t}=this.#a;this.#a=null,t.removeAttribute(`aria-expanded`);let n=this.#t.activeElement!==null&&e.contains(this.#t.activeElement);e.destroy(),n&&t.focus()}#E(e){if(e.key===`Escape`&&this.#a){let{trigger:t}=this.#a;this.#T(),t.focus(),e.preventDefault();return}let t=[...this.#n.querySelectorAll(`button, input`)],n=t.indexOf(this.#t.activeElement);if(n<0||this.#t.activeElement instanceof HTMLInputElement)return;let r=e.key===`ArrowRight`||e.key===`ArrowDown`?1:e.key===`ArrowLeft`||e.key===`ArrowUp`?-1:0;r!==0&&(t[(n+r+t.length)%t.length]?.focus(),e.preventDefault())}#D(){let e=this.#b();for(let{el:t,def:n}of this.#i){let r=n.children?Qt(n,e,this.#_):n.isVisible?.(e);Zt(t,n,e,this.#t,r)}this.#a?.menu.refresh(),this.#s&&this.#t.activeElement!==this.#s&&(this.#s.value=String(this.#e.getPage()+1))}makePageInput(){let e=this.#t.createElement(`div`);e.className=`zine-controls-page`;let t=this.#t.createElement(`input`);t.type=`number`,t.min=`1`,t.max=String(this.#e.getPageCount()),t.value=String(this.#e.getPage()+1),t.setAttribute(`aria-label`,this.#e.strings.pageNumberLabel);let n=this.#t.createElement(`span`);n.textContent=this.#e.strings.pageTotal(this.#e.getPageCount());let r=!1,i=()=>{if(r)return;r=!0;let e=Number(t.value),n=Math.max(0,this.#e.getPageCount()-1),i=Number.isFinite(e)?Math.min(Math.max(Math.round(e)-1,0),n):this.#e.getPage();i===this.#e.getPage()?t.value=String(this.#e.getPage()+1):this.#e.flipTo(i)};return t.addEventListener(`focus`,()=>{r=!1}),t.addEventListener(`keydown`,e=>{e.key===`Enter`&&(i(),t.blur())}),t.addEventListener(`blur`,i),e.append(t,n),this.#s=t,e}openPanel(){return this.#d}hasOutline(){return this.#p===!0}#O(){this.#p!==null||!this.#e.canOutline()||(this.#p=!1,this.#e.getOutline().then(e=>{if(e.length===0)return;this.#p=!0,this.#D();let t=this.#a;if(t){let e=this.#i.find(e=>e.el===t.trigger)?.def;this.#T(),e&&this.#C(e,t.trigger)}}))}togglePanel(e){let t=this.#d;this.#u instanceof mn&&(this.#f=this.#u.getState()),this.#u?.destroy(),this.#u=null,this.#d=null,t!==e&&(this.#u=new bn[e](this.#e,this.#l,{onDismiss:()=>this.togglePanel(e),...e===`search`&&this.#f?{state:this.#f}:{}}),q(this.#u.root,this.#h),this.#d=e),this.#D()}}})),wn,Tn,En,Dn=n((()=>{V(),Ht(),tn(),J(),wn=[`zoomIn`,`zoomOut`,`|`,`prev`,`next`,`|`,`fullscreen`,`mute`,`|`,`print`,`download`,`share`],Tn=new Set([`pageInput`,`thumbnails`,`outline`,`search`]),En=class{#e;#t;#n;#r;#i;#a;#o=null;#s=[];constructor(e,t,n={},r=new Set){this.#e=e,this.#t=t,this.#a=r,this.#n=t.ownerDocument,zt(),jt(this.#n),this.#i=n.colorScheme??`auto`,this.#r=(n.items??wn).filter(e=>typeof e!=`string`||!Tn.has(e)||gt(e)!==void 0);let i=e=>{e.preventDefault(),this.#l(e.clientX,e.clientY)};this.#t.addEventListener(`contextmenu`,i),this.#s.push(()=>this.#t.removeEventListener(`contextmenu`,i));let a=e=>{this.#o&&!this.#o.contains(e.target)&&this.#d()},o=e=>{e.key===`Escape`&&this.#o&&(this.#d(),e.preventDefault())};this.#n.addEventListener(`pointerdown`,a,!0),this.#n.addEventListener(`keydown`,o,!0),this.#s.push(()=>this.#n.removeEventListener(`pointerdown`,a,!0)),this.#s.push(()=>this.#n.removeEventListener(`keydown`,o,!0));let s=()=>this.#o?.refresh();this.#s.push(e.on(`pageChanged`,s)),this.#s.push(e.on(`zoomChanged`,s)),this.#s.push(e.on(`flipEnd`,s))}#c(){return{zine:this.#e,close:()=>this.#d(),colorScheme:this.#i,strings:this.#e.strings}}#l(e,t){this.#d();let n=new en(this.#n,()=>this.#c(),()=>this.#d(),this.#a);if(n.build(this.#r),!n.el.querySelector(`button`))return;let r=this.#n.createElement(`div`);r.className=`zine-context-layer`,q(r,this.#i),r.appendChild(n.el),this.#t.appendChild(r),this.#o=n,n.refresh(),this.#u(n.el,e,t),n.focusFirst()}#u(e,t,n){let r=this.#t.getBoundingClientRect(),i=e.getBoundingClientRect();if(!i.width){e.style.left=`${t}px`,e.style.top=`${n}px`;return}let a=Math.min(t,r.right-i.width-4),o=Math.min(n,r.bottom-i.height-4);e.style.left=`${Math.max(r.left+4,a)}px`,e.style.top=`${Math.max(r.top+4,o)}px`}#d(){if(!this.#o)return;let e=this.#o.el.parentElement,t=this.#n.activeElement!==null&&this.#o.contains(this.#n.activeElement);this.#o.destroy(),e?.remove(),this.#o=null,t&&typeof this.#t.focus==`function`&&this.#t.focus()}destroy(){this.#d();for(let e of this.#s)e();this.#s=[]}}})),On=r({DEFAULT_ITEMS:()=>B,ICONS:()=>I,createIcon:()=>F,defineControl:()=>R,getControl:()=>gt,mountContextMenu:()=>An,mountControls:()=>kn});function kn(e,t,n={},r=new Set){let i=new Sn(e,t,n,r);return yn(i),i.mount(n),()=>i.destroy()}function An(e,t,n={},r=new Set){let i=new En(e,t,n,r);return()=>i.destroy()}var jn=n((()=>{Cn(),Dn(),V(),L()}));E();var Mn=.25,Nn=.0015,Pn=6,X=250,Fn=24,In=2*X,Ln=1.2,Rn=32,zn=60,Bn=2.5,Vn=1.5,Hn=120,Un=.85,Wn=.82,Gn=.12,Kn=360,qn=28,Jn=260,Yn=7e3,Xn=2200,Zn=`zine:hints-learned`,Qn=`zine:sound-muted`;function $n(e,t,n){let r=Math.max(0,t-Rn),i=Math.min(e.length,t+n+Rn),a=e.slice(r,i).replace(/\s+/g,` `).trim();return`${r>0?`…`:``}${a}${i<e.length?`…`:``}`}var er=class{#e;#t;#n=new c;#r=new s(2);#i=new d;#a;#o;#s;#c;#l=1;#u;#d;#f;#p;#m;#h=null;#g=null;#_;#v;#y;#b;#x=null;#S=!1;#C=!1;#w=!1;#T={turn:!1,zoom:!1,pan:!1};#E=null;#D=null;#O=null;#k=null;#A=null;#j=null;#M=!1;#N=``;#P;#F;#I;#L=!1;#R=null;#z=!1;#B;#V=null;#H;#U;#W;#G=null;#K=null;#q=[];#J=0;#Y=0;#X={left:null,right:null};#Z;#Q;#$;#ee;#te;#ne=null;#re=!1;#ie=1;#ae=0;#oe=0;#se=null;#ce=!1;#le=!1;#ue=null;#de=null;#fe=null;#pe=null;#me=null;#he=null;#ge=null;#_e=0;#ve=null;#ye=!1;#be=1;#xe=!1;#Se=null;#Ce=null;#we=null;#Te=null;#Ee=null;#De=null;#Oe=-1/0;#ke=null;#Ae=null;#je=new Set;#Me;#Ne=null;#Pe;#Fe=null;#Ie;#Le;#Re=null;#ze=null;#Be=`download`;#Ve=1;#He=0;#Ue=null;#We;debug={setFlipProgress:(e,t)=>{this.#se?.setFlipProgress(e,t)}};constructor(e,t){rr(e,t),this.#e=e,t.width!==void 0&&(e.style.width=`${t.width}px`),t.height!==void 0&&(e.style.height=`${t.height}px`),this.#t=Ze(t.source,{frontCover:t.frontCover,backCover:t.backCover,pages:t.pages});let n=t.direction??`ltr`;this.#a=n,this.#U=(t.deepLink??!0)&&y(),this.#W=t.disableContextMenu??!1,this.#o=t.spreadMode??`cover`,this.#s=this.#o,this.#c=t.curl??`cone`,this.#u=t.clickToFlip??`edge`,this.#d=t.fit??`contain`,this.#f=et(t.strings),this.#p=t.clickZoneSize??64,this.#m=t.cursorHints??!0;let r=t.hints??!0;this.#_=r===!0||r!==!1&&(r.enabled??!0),this.#v=r!==!0&&r!==!1&&(r.persist??!1),this.#v&&this.#xt();let i=t.sound??!1;this.#y=i!==!1,this.#b=i===!0||i===!1?{}:i,this.#S=typeof i==`object`&&i?i.muted??!1:!1,this.#C=typeof i==`object`&&i?i.persist??!1:!1,this.#y&&this.#C&&this.#Ze(),this.#I=t.singlePageThreshold??640,this.#B=t.responsiveSpread??!0,this.#Me=t.controls??!0,this.#Pe=t.contextMenu??!t.disableContextMenu,this.#Ie=new Set(t.hideControls??[]),this.#Le=t.loading??!0,this.#H=t.startPage,typeof this.#t.open!=`function`&&this.#En(),this.#Z=t.flipDuration??800,this.#Q=t.zoom?.enabled??!0,this.#$=t.zoom?.wheel??!0;let a=t.zoom?.doubleClick,o=a===!1?[]:[...a??[1,2,4]].sort((e,t)=>e-t);this.#ee=o.length>0?o:null,this.#te=t.zoom?.max??4;let s=this.#Q&&this.#ee!==null,c=t.zoom?.doubleClickInFlipZone??this.#u===`half`;this.#P=this.#u!==`off`&&s&&c&&t.clickFlipDelay!==0,this.#F=this.#P?t.clickFlipDelay??X:0,this.#We=this.#Gt(t.renderer??`auto`)}get ready(){return this.#We}getPageCount(){return this.#t.pageCount}getPage(){return this.#Y}get container(){return this.#e}getPageBox(){return this.#se?.measure().book??null}getSpreads(){return this.#q}getSpreadIndex(){return this.#J}getDirection(){return this.#a}getSpreadMode(){return this.#o}isSinglePage(){return this.#L}setSpreadMode(e){e!==this.#o&&(this.#o=e,this.#z=!1,this.#un(),this.#dn())}toggleSpreadMode(){this.setSpreadMode(this.#o===`single`?this.#s===`single`?`double`:this.#s:`single`)}getResponsiveSpread(){return this.#B}isResponsiveSingle(){return this.#z&&this.#o!==`single`}setResponsiveSpread(e){if(e!==this.#B){if(this.#B=e,e){let e=this.#se?.measure().containerWidth;if(e===void 0)return;this.#z=!1,this.#ln(e)}else{if(!this.#z)return;this.#z=!1,this.#un()}this.#dn()}}getPageImage(e){return this.#Cn(e)}canFlipNext(){return this.#J+1<this.#q.length}canFlipPrev(){return this.#J>0}getMaxZoom(){return this.#te}canSearch(){return typeof this.#t.getText==`function`}canDownload(){return typeof this.#t.getDownload==`function`}isDocument(){return typeof this.#t.getOutline==`function`||typeof this.#t.getText==`function`}canPrint(){return typeof this.#t.getDownload==`function`&&this.#e.ownerDocument?.defaultView?.navigator?.pdfViewerEnabled!==!1}async print(){let e=await this.getSourceFile(),t=this.#e.ownerDocument;if(!e||!t)return!1;let{url:n,revoke:r}=await this.#Ge(e,t),i=t.createElement(`iframe`);return i.style.cssText=`position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;`,i.setAttribute(`aria-hidden`,`true`),i.src=n,new Promise(e=>{let a=!1,o=t=>{a||(a=!0,setTimeout(()=>{i.remove(),r&&URL.revokeObjectURL(n)},6e4),e(t))};i.addEventListener(`load`,()=>{try{let e=i.contentWindow;if(!e)return o(!1);e.focus(),e.print(),o(!0)}catch{o(!1)}}),i.addEventListener(`error`,()=>o(!1)),t.body.appendChild(i)})}canOutline(){return typeof this.#t.getOutline==`function`}getOutline(){if(!this.#Ae){let e=this.#t.getOutline;this.#Ae=typeof e==`function`?Promise.resolve(e.call(this.#t)).catch(()=>[]):Promise.resolve([])}return this.#Ae}async getSourceFile(){let e=this.#t.getDownload;return typeof e==`function`?await e.call(this.#t)??null:null}async download(){let e=await this.getSourceFile();if(!e)return!1;let t=this.#e.ownerDocument;if(!t)return!1;let{url:n,revoke:r}=await this.#Ge(e,t),i=t.createElement(`a`);return i.href=n,i.download=e.filename,i.rel=`noopener`,t.body.appendChild(i),i.click(),i.remove(),r&&setTimeout(()=>URL.revokeObjectURL(n),1e4),!0}async#Ge(e,t){if(e.revoke||!this.#Ke(e.url,t))return{url:e.url,revoke:e.revoke??!1};try{let t=await(await fetch(e.url)).blob();return{url:URL.createObjectURL(t),revoke:!0}}catch{return{url:e.url,revoke:!1}}}#Ke(e,t){let n=t.defaultView?.location?.href;if(!n)return!1;try{return new URL(e,n).origin!==new URL(n).origin}catch{return!1}}async search(e,t={}){let n=this.#t.getText,r=e.trim().toLowerCase();if(typeof n!=`function`||r===``)return[];let i=t.limit??50,a=[];for(let e=0;e<this.#t.pageCount&&a.length<i;e++){let t;try{t=await n.call(this.#t,e)}catch(t){this.#n.emit(`sourceError`,{index:e,error:t});continue}let i=t.toLowerCase().indexOf(r);i<0||a.push({page:e,excerpt:$n(t,i,r.length)})}return a}flipNext(){this.#qe(1)}flipPrev(){this.#qe(-1)}#qe(e){this.#Je(()=>this.#tt(this.#J+e))}flipTo(e){let t=Z(e,0,Math.max(0,this.#t.pageCount-1));this.#Je(()=>this.#tt(this.#Tn(t)))}#Je(e){this.#i.state===`idle`?e():this.#ge?(this.#he=null,this.#Ye(),e()):this.#he=e}#Ye(){let e=this.#ge;e&&(this.#ge=null,this.#ue!==null&&(cancelAnimationFrame(this.#ue),this.#ue=null),this.#se?.setFlipProgress(e.toT,e.direction),e.onDone())}#Xe(){let e=this.#he;if(!e){this.#yn();return}this.#he=null,e()}getZoom(){return this.#ie}setZoom(e,t){if(!this.#se||!this.#Q)return;this.#Et(),this.#kt();let n=Z(e,1,this.#te),r=this.#se.measure(),i=r.screenAt?.(this.#ie),a=t??(i?{x:i.x+this.#ae+i.width/2,y:i.y+this.#oe+i.height/2}:null)??{x:r.containerWidth/2,y:r.containerHeight/2},o=this.#ie,s=n===1?0:a.x-n/o*(a.x-this.#ae),c=n===1?0:a.y-n/o*(a.y-this.#oe);[s,c]=this.#et(s,c,n,r.containerWidth,r.containerHeight),this.#ie=n,this.#ae=s,this.#oe=c,this.#se.setViewTransform(n,s,c),o>1!=n>1&&this.#$e(),this.#hn(),this.#yt(),o<=1&&n>1&&(this.#St(`zoom`),this.#At()),this.#n.emit(`zoomChanged`,{scale:n})}resetZoom(){this.setZoom(1)}get strings(){return this.#f}isSoundEnabled(){return this.#y}isSoundMuted(){return this.#y&&this.#S}setSoundMuted(e){this.#y&&(this.#S=e,this.#x?.setMuted(e),this.#C&&this.#Qe(e),e||this.#Kt())}#Ze(){try{let e=localStorage.getItem(Qn);(e===`true`||e===`false`)&&(this.#S=e===`true`)}catch{}}#Qe(e){try{localStorage.setItem(Qn,String(e))}catch{}}#$e(){this.#e.style.touchAction=this.#ie>1?`none`:`pan-y`}#et(e,t,n,r,i){let a=typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1,o=e=>Math.round(e*a)/a||0,s=this.#se?.measure().screenAt?.(n)??{x:0,y:0,width:r*n,height:i*n},[c,l]=tr(s.x,s.width,r),[u,d]=tr(s.y,s.height,i);return[o(Z(e,c,l)),o(Z(t,u,d))]}on(e,t){return this.#n.on(e,t)}destroy(){this.#le=!0,this.#ue!==null&&cancelAnimationFrame(this.#ue),this.#ge=null,this.#he=null,this.#It(),this.#wt(),this.#Et(),this.#kt(),this.#Ft(),this.#Mt(),this.#x?.destroy(),this.#x=null,this.#ne?.disconnect(),this.#G?.stop(),this.#G=null,this.#K?.(),this.#U&&b(),this.#Ne?.(),this.#Fe?.(),this.#Zt(),this.#ke?.(),this.#we?.(),this.#Ee?.(),this.#Te?.(),this.#g?.(),this.#Ce?.(),this.#Ue!==null&&clearTimeout(this.#Ue),this.#He++,this.#se?.destroy(),this.#se=null,this.#t.destroy(),this.#n.clear()}#tt(e){if(e<0||e>=this.#q.length||e===this.#J||(this.#Et(),this.#kt(),this.#i.send(`flip`)===null))return;let t=e>this.#J?`forward`:`backward`,n=this.#ot(e);this.#n.emit(`flipStart`,{from:this.#Y,to:n}),this.#qt(),this.#nt(e,t,n,++this.#_e)}async#nt(e,t,n,r){let i=this.#q[e],a=i?await this.#Sn(i):{left:null,right:null};r===this.#_e&&(this.#se?.beginFlip(this.#X,a,t,{fill:this.#L,fit:this.#d,curl:this.#sn(),anchor:{y:this.#l}}),this.#rt(0,1,t,()=>this.#at(e,n,a),()=>this.#it(n)))}#rt(e,t,n,r,i){let a=this.#on()*Math.abs(t-e);if(a<=0){this.#se?.setFlipProgress(t,n),r();return}let o={toT:t,direction:n,onDone:r};this.#ge=o;let s=performance.now(),c=!1,l=u=>{if(this.#ge!==o)return;let d=Math.min(1,(u-s)/a),f=nr(d);i&&!c&&f>=(this.#L?Wn:Un)&&(c=!0,i()),d<1?(this.#se?.setFlipProgress(e+(t-e)*f,n),this.#ue=requestAnimationFrame(l)):(this.#se?.setFlipProgress(t,n),this.#ue=null,this.#ge=null,r())};this.#ue=requestAnimationFrame(l)}#it(e){this.#Y!==e&&(this.#Y=e,this.#an(),this.#n.emit(`pageChanged`,{page:e}))}#at(e,t,n){let r=this.#q[e];this.#J=e,this.#X=n,r&&this.#fn(r,n),this.#wn(),this.#i.send(`settle`),this.#Oe=performance.now(),this.#it(t),this.#St(`turn`),this.#yt(),this.#n.emit(`flipEnd`,{page:t}),this.#Xe()}#ot(e){let t=this.#q[e];if(!t)return this.#Y;let n=[t.left,t.right].filter(e=>e!==null);return n.length>0?Math.min(...n):this.#Y}#st(e,t){if(this.#ye||!this.#se)return;if(this.#kt(),this.#It(),this.#ie>1){if(this.#i.send(`panStart`)===null)return;this.#ve={baseTx:this.#ae,baseTy:this.#oe};return}let n=this.#mt(),r=this.#ht(e,t);this.#pe=r;let i=Math.min(n.width,n.height)*Mn,a=r.x>=0&&r.x<=n.width&&r.y>=0&&r.y<=n.height,o=r.x<=i||r.x>=n.width-i,s=a&&o;if(this.#i.state!==`idle`){if(!this.#ge||!s){this.#fe=null;return}this.#Ye()}if(!s)return;this.#l=Z(r.y/n.height,0,1);let c=r.x>n.width/2,l=this.#a===`rtl`?!c:c,u=this.#J+(l?1:-1);u<0||u>=this.#q.length||(this.#fe={direction:l?`forward`:`backward`,targetIndex:u,toPage:this.#ot(u),width:n.width})}#ct(){let e=this.#fe;e&&(this.#fe=null,this.#i.send(`grab`)!==null&&(this.#de={direction:e.direction,targetIndex:e.targetIndex,toPage:e.toPage,toContent:{left:null,right:null},width:e.width,t:0},this.#n.emit(`flipStart`,{from:this.#Y,to:e.toPage}),this.#lt(e.targetIndex,e.direction)))}async#lt(e,t){let n=this.#q[e],r=n?await this.#Sn(n):{left:null,right:null};this.#de?.targetIndex===e&&(this.#de.toContent=r,this.#se?.beginFlip(this.#X,r,t,{fill:this.#L,fit:this.#d,curl:this.#sn(),anchor:{y:this.#l}}),this.#se?.setFlipProgress(this.#de.t,t))}#ut(e,t){if(this.#ye)return;if(this.#ve){if(!this.#se)return;let n=this.#se.measure(),[r,i]=this.#et(this.#ve.baseTx+e,this.#ve.baseTy+t,this.#ie,n.containerWidth,n.containerHeight);this.#ae=r,this.#oe=i,this.#se.setViewTransform(this.#ie,r,i),this.#hn(),this.#St(`pan`),this.#Mt();return}this.#fe&&Math.hypot(e,t)>Pn&&this.#ct();let n=this.#de;n&&(n.t=Z((n.direction===`forward`?-e:e)/n.width,0,1),this.#se?.setFlipProgress(n.t,n.direction))}#dt(e){if(this.#ye)return;if(this.#ve){this.#ve=null,this.#i.send(`panEnd`),this.#yt();return}let t=this.#de;if(!t){this.#fe=null,this.#ft(e)||this.#pt(e);return}this.#de=null,this.#i.send(`release`);let n=e.swipe&&Math.abs(e.vx)>Math.abs(e.vy),r=t.direction===`forward`?e.vx<0:e.vx>0,i=n&&r,a=n&&!r;i||t.t>=.5&&!a?(this.#qt(),this.#rt(t.t,1,t.direction,()=>this.#at(t.targetIndex,t.toPage,t.toContent),()=>this.#it(t.toPage))):this.#rt(t.t,0,t.direction,()=>this.#Lt())}#ft(e){if(this.#ie>1||!e.swipe||Math.abs(e.dx)<=Math.abs(e.dy))return!1;let t=this.#a===`rtl`?e.dx>0:e.dx<0,n=t?`forward`:`backward`;if(!this.#_t(n))return this.#Ot(n),!1;let r=t?1:-1;return this.#Je(()=>this.#tt(this.#J+r)),!0}#pt(e){if(this.#u===`off`||this.#ie>1||!this.#pe||Math.abs(e.dx)>Pn||Math.abs(e.dy)>Pn)return;let t=this.#gt(this.#pe);if(!t)return;if(!this.#_t(t)){this.#Ot(t);return}this.#l=Z(this.#pe.y/this.#mt().height,0,1);let n=t===`forward`?1:-1,r=()=>this.#tt(this.#J+n);if(this.#It(),this.#F<=0){this.#Je(r);return}this.#me=setTimeout(()=>{this.#me=null,this.#Je(r)},this.#F)}#mt(){let e=this.#se.measure();return e.content??e.book??{x:0,y:0,width:e.containerWidth,height:e.containerHeight}}#ht(e,t){let n=this.#e.getBoundingClientRect(),r=this.#mt();return{x:e-n.left-r.x,y:t-n.top-r.y}}#gt(e){if(!this.#se)return null;let t=this.#mt().width,n;if(n=this.#u===`half`?e.x>t/2?`right`:`left`:e.x<=this.#p?`left`:e.x>=t-this.#p?`right`:null,!n)return null;let r=this.#a===`rtl`?`left`:`right`;return n===r?`forward`:`backward`}#_t(e){let t=this.#J+(e===`forward`?1:-1);return t>=0&&t<this.#q.length}#vt(){let e=e=>{let t=e;this.#h={x:t.clientX,y:t.clientY},this.#yt()},t=()=>{this.#h=null,this.#yt()};this.#e.addEventListener(`pointermove`,e),this.#e.addEventListener(`pointerleave`,t),this.#g=()=>{this.#e.removeEventListener(`pointermove`,e),this.#e.removeEventListener(`pointerleave`,t)}}#yt(){if(!this.#m||!this.#se)return;let e=``;this.#de||this.#ve?e=`grabbing`:this.#h&&(e=this.#bt(this.#h.x,this.#h.y)),this.#e.style.cursor=e}#bt(e,t){if(!this.#se)return``;let n=this.#mt(),r=this.#ht(e,t);if(r.x<0||r.y<0||r.x>n.width||r.y>n.height)return``;if(this.#ie>1)return`grab`;let i=this.#gt(r);return i&&this.#_t(i)?`pointer`:this.#Q&&this.#ee!==null?`zoom-in`:``}#xt(){try{let e=localStorage.getItem(Zn);if(!e)return;let t=JSON.parse(e);this.#T={turn:t.turn===!0,zoom:t.zoom===!0,pan:t.pan===!0}}catch{}}#St(e){if(!this.#T[e]&&(this.#T[e]=!0,e===`turn`&&this.#wt(),e===`zoom`&&this.#Ft(),this.#v))try{localStorage.setItem(Zn,JSON.stringify(this.#T))}catch{}}#Ct(){!this.#_||this.#xe||this.#T.turn||(this.#wt(),this.#E=setTimeout(()=>{this.#E=null,this.#Tt()},Yn))}#wt(){this.#E!==null&&(clearTimeout(this.#E),this.#E=null)}async#Tt(){if(!this.#_||this.#xe||this.#T.turn||!this.#se||typeof requestAnimationFrame!=`function`||this.#i.state!==`idle`)return;let e=this.#J+1,t=this.#q[e];if(!t)return;let n=await this.#Sn(t);if(this.#le||this.#T.turn||this.#i.state!==`idle`||this.#D)return;this.#l=1,this.#se.beginFlip(this.#X,n,`forward`,{fill:this.#L,fit:this.#d,curl:this.#sn(),anchor:{y:this.#l}});let r={};this.#D=r;let i=performance.now(),a=Kn*2,o=()=>{if(this.#D!==r)return;let e=Math.min(1,(performance.now()-i)/a),t=Gn*Math.sin(e*Math.PI);this.#se?.setFlipProgress(Math.max(0,t),`forward`),e<1?this.#ue=requestAnimationFrame(o):(this.#ue=null,this.#D=null,this.#Dt())};this.#ue=requestAnimationFrame(o)}#Et(){this.#D&&(this.#D=null,this.#ue!==null&&(cancelAnimationFrame(this.#ue),this.#ue=null),this.#Dt())}#Dt(){let e=this.#q[this.#J];e&&this.#i.state===`idle`&&this.#fn(e,this.#X)}#Ot(e){if(!this.#se||typeof requestAnimationFrame!=`function`||this.#xe||this.#i.state!==`idle`||this.#ie>1||this.#O)return;let t=e===`forward`,n=(this.#a===`rtl`?!t:t)?-1:1,r={};this.#O=r;let i=performance.now(),a=()=>{if(this.#O!==r)return;let e=Math.min(1,(performance.now()-i)/Jn),t=qn*Math.sin(e*Math.PI);this.#se?.setViewTransform(1,n*t,0),e<1?this.#ue=requestAnimationFrame(a):(this.#ue=null,this.#O=null,this.#se?.setViewTransform(1,0,0))};this.#ue=requestAnimationFrame(a)}#kt(){this.#O&&(this.#O=null,this.#ue!==null&&(cancelAnimationFrame(this.#ue),this.#ue=null),this.#se?.setViewTransform(1,0,0))}#At(){this.#T.pan||this.#jt(this.#f.panHint)}#jt(e){if(!this.#_)return;let t=this.#e.ownerDocument;if(!t||typeof this.#e.appendChild!=`function`)return;this.#Mt();let n=t.createElement(`div`);n.className=`zine-hint-caption`,n.setAttribute(`aria-hidden`,`true`),n.textContent=e,n.style.cssText=`position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:3;pointer-events:none;padding:6px 12px;border-radius:999px;font:500 13px/1.2 system-ui,sans-serif;color:#fff;background:rgba(24,24,27,0.82);box-shadow:0 1px 4px rgba(0,0,0,0.35);white-space:nowrap;opacity:0;`;let r=!this.#xe&&typeof requestAnimationFrame==`function`;r&&(n.style.transition=`opacity 200ms ease`),this.#e.appendChild(n),this.#k=n,r?requestAnimationFrame(()=>{this.#k===n&&(n.style.opacity=`1`)}):n.style.opacity=`1`,this.#A=setTimeout(()=>this.#Mt(),Xn)}#Mt(){this.#A!==null&&(clearTimeout(this.#A),this.#A=null),this.#k?.remove(),this.#k=null}#Nt(e,t){!this.#_||this.#T.zoom||this.#M||this.#N===`mouse`&&this.#bt(e,t)===`zoom-in`&&(this.#i.state===`animating`||performance.now()-this.#Oe<=In||(this.#Ft(),this.#j=setTimeout(()=>{this.#j=null,!(this.#T.zoom||this.#M)&&(this.#M=!0,this.#jt(this.#Pt()))},X)))}#Pt(){let e=this.#e.ownerDocument?.defaultView?.navigator,t=/Mac|iPhone|iPad/.test(e?.platform??``);return this.#f.zoomHint({doubleClick:this.#ee!==null,wheel:this.#$,mac:t})}#Ft(){this.#j!==null&&(clearTimeout(this.#j),this.#j=null)}#It(){this.#me!==null&&(clearTimeout(this.#me),this.#me=null)}#Lt(){let e=this.#q[this.#J];e&&this.#fn(e,this.#X),this.#i.send(`settle`),this.#yt(),this.#n.emit(`flipEnd`,{page:this.#Y}),this.#Xe()}#Rt(){if(this.#fe=null,this.#It(),this.#de){this.#de=null,this.#i.send(`release`),this.#i.send(`settle`);let e=this.#q[this.#J];e&&this.#fn(e,this.#X)}else this.#ve&&(this.#ve=null,this.#i.send(`panEnd`));this.#ye=!0,this.#be=this.#ie}#zt(e,t,n){if(!this.#ye)return;let r=this.#e.getBoundingClientRect();this.setZoom(this.#be*n,{x:e-r.left,y:t-r.top})}#Bt(){this.#ye=!1}#Vt(){if(!this.#W)return;let e=e=>e.preventDefault();this.#e.addEventListener(`contextmenu`,e),this.#Te=()=>this.#e.removeEventListener(`contextmenu`,e)}#Ht(){let e=e=>{if(!this.#$||!this.#Q||!(e.ctrlKey||e.metaKey))return;e.preventDefault();let t=this.#e.getBoundingClientRect(),n=Math.exp(-e.deltaY*Nn);this.setZoom(this.#ie*n,{x:e.clientX-t.left,y:e.clientY-t.top})};this.#e.addEventListener(`wheel`,e,{passive:!1}),this.#we=()=>this.#e.removeEventListener(`wheel`,e)}#Ut(){let e=e=>{this.#N=e.pointerType},t=e=>{let t=this.#ee;if(!this.#Q||t===null||!this.#se)return;let n=performance.now(),r=this.#De;if(!(r!==null&&n-r.t<=X&&Math.hypot(e.clientX-r.x,e.clientY-r.y)<=Fn)){this.#De={t:n,x:e.clientX,y:e.clientY},this.#Nt(e.clientX,e.clientY);return}this.#De=null,this.#Ft(),this.#Wt(e.clientX,e.clientY,t)};this.#e.addEventListener(`pointerdown`,e),this.#e.addEventListener(`click`,t),this.#Ee=()=>{this.#e.removeEventListener(`pointerdown`,e),this.#e.removeEventListener(`click`,t)}}#Wt(e,t,n){if(this.#ie<=1&&this.#u!==`off`&&!this.#P){let n=this.#ht(e,t),r=this.#gt(n);if(r!==null&&this.#_t(r)||this.#i.state===`animating`||performance.now()-this.#Oe<=In)return}this.#It();let r=n.find(e=>e>this.#ie+1e-6)??n[0]??this.#ie,i=this.#e.getBoundingClientRect();this.setZoom(r,{x:e-i.left,y:t-i.top})}async#Gt(e){let t=M(e);if(this.#t.onProgress?.(e=>this.#Jt(e)),typeof this.#t.open==`function`){this.#Yt();try{await this.#t.open(),this.#En()}catch(e){throw this.#Zt(),e}this.#Xt(`preparing`)}this.#t.prefetch([this.#Y]);let n=await t,r=await this.#Qt(n);this.#se=r,this.#t.onPageUpdate?.(e=>this.#mn(e)),this.#ln(r.measure().containerWidth);let i=new p({onStart:e=>this.#st(e.x,e.y),onMove:e=>this.#ut(e.dx,e.dy),onEnd:e=>this.#dt(e)}),a=new g({onPinchStart:()=>this.#Rt(),onPinchMove:e=>this.#zt(e.centerX,e.centerY,e.scale),onPinchEnd:()=>this.#Bt()});this.#Ce=m(this.#e,{pointer:i,pinch:a}),this.#$e(),this.#Ht(),this.#Ut(),this.#Vt(),this.#vt(),this.#en(),this.#ke=this.#rn(),await this.#dn(),this.#Zt(),this.#bn(),this.#wn(),this.#an(),this.#nn(),await this.#tn(),this.#Kt(),this.#n.emit(`ready`),this.#Tt(),this.#Ct()}async#Kt(){if(!(!this.#y||this.#S||this.#w||this.#le)){this.#w=!0;try{let{FlipSound:e}=await Promise.resolve().then(()=>(lt(),rt));if(this.#le)return;this.#x=new e(this.#b),this.#x.setMuted(this.#S)}catch{}}}#qt(){this.#x?.play()}#Jt(e){this.#ze=e,this.#n.emit(`progress`,e),this.#Re?.update(e)}async#Yt(){if(this.#Le===!1||this.#le)return;let e=this.#e;if(!(!e.ownerDocument||typeof e.appendChild!=`function`))try{let{mountLoading:t}=await Promise.resolve().then(()=>(ht(),ut));if(this.#Be===`done`||this.#le)return;this.#Re=t(e,this.#f),this.#ze&&this.#Re.update(this.#ze),this.#Be===`preparing`&&this.#Re.preparing()}catch{}}#Xt(e){this.#Be!==`done`&&(this.#Be=e,this.#Re?.preparing())}#Zt(){this.#Be=`done`,this.#Re?.destroy(),this.#Re=null}async#Qt(e){try{return await e.mount(this.#e),e.onFatal?.(()=>{this.#$t()}),e}catch{e.destroy();let t=await M(`css`);return await t.mount(this.#e),this.#ce=!0,this.#n.emit(`rendererFallback`,{from:`webgl2`,to:`css`}),t}}async#$t(){if(this.#ce||this.#le)return;this.#ce=!0,this.#se?.destroy(),this.#se=null;let e=await M(`css`);if(this.#le){e.destroy();return}await e.mount(this.#e),this.#se=e,this.#ln(e.measure().containerWidth),await this.#dn(),this.#n.emit(`rendererFallback`,{from:`webgl2`,to:`css`})}#en(){if(typeof matchMedia!=`function`)return;let e=matchMedia(`(prefers-reduced-motion: reduce)`);this.#xe=e.matches,e.addEventListener?.(`change`,e=>{this.#xe=e.matches})}async#tn(){let e=this.#Me!==!1,t=this.#Pe!==!1;if(!e&&!t||this.#le)return;let n=this.#e;if(!(!n.ownerDocument||typeof n.appendChild!=`function`))try{let{mountControls:e,mountContextMenu:t}=await Promise.resolve().then(()=>(jn(),On));if(this.#le)return;if(this.#Me!==!1){let t=this.#Me===!0?{}:this.#Me;this.#Ne=e(this,n,t,this.#Ie)}if(this.#Pe!==!1){let e=this.#Pe===!0?{}:this.#Pe;this.#Fe=t(this,n,e,this.#Ie)}}catch{}}#nn(){if(!this.#U||globalThis.location===void 0)return;let e=globalThis;this.#G=C(e,e=>{e!==this.#Y&&this.flipTo(e)}),this.#G.push(this.#Y),this.#K=this.#n.on(`pageChanged`,({page:e})=>{this.#G?.push(e)})}pageLink(e=this.#Y){let t=globalThis.location?.href??``;if(!t)return``;let n=new URL(t);return n.hash=S(n.hash,Z(e,0,Math.max(0,this.#t.pageCount-1))),n.toString()}#rn(){let e=this.#e,t=e.ownerDocument;if(!t||typeof e.setAttribute!=`function`)return null;e.hasAttribute(`tabindex`)||(e.tabIndex=0),e.setAttribute(`aria-roledescription`,this.#f.roledescription);let n=e=>this.#in(e);e.addEventListener(`keydown`,n);let r=t.createElement(`div`);return r.setAttribute(`aria-live`,`polite`),r.setAttribute(`aria-atomic`,`true`),r.style.cssText=`position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;`,e.appendChild(r),this.#Se=r,()=>{e.removeEventListener(`keydown`,n),r.remove(),this.#Se=null}}#in(e){let t=this.#a===`rtl`?`ArrowLeft`:`ArrowRight`;switch(e.key){case`ArrowRight`:case`ArrowLeft`:e.key===t?this.flipNext():this.flipPrev(),e.preventDefault();break;case`Home`:this.flipTo(0),e.preventDefault();break;case`End`:this.flipTo(this.#t.pageCount-1),e.preventDefault();break;default:break}}#an(){this.#Se&&(this.#Se.textContent=this.#f.pageAnnounce(this.#Y+1,this.#t.pageCount))}#on(){return this.#xe?Hn:this.#Z*(this.#L?Ln:1)}#sn(){return this.#xe?`simple`:this.#c}update(){!this.#se||this.#i.state!==`idle`||(this.#ln(this.#se.measure().containerWidth),this.#dn(),this.#yt())}#cn(){return this.#z||this.#o===`single`?`single`:this.#o}#ln(e){let t=this.#B&&a(e,this.#I);t!==this.#z&&(this.#z=t,this.#un())}#un(){let e=this.#cn(),t=e!==this.#R;this.#R=e,this.#L=e===`single`,this.#q=i(this.#t.pageCount,{direction:this.#a,mode:e}),this.#J=this.#Tn(this.#Y),t&&this.#n.emit(`spreadChanged`,{mode:e,singlePage:this.#L})}async#dn(){let e=this.#q[this.#J];!e||!this.#se||(this.#X=await this.#Sn(e),this.#fn(e,this.#X))}#fn(e,t){this.#se?.renderSpread(e,t,{fill:this.#L,fit:this.#d}),this.#pn(),this.#Ve=1,this.#hn()}#pn(){let e=this.#se?.measure(),t=e?.containerAspect;if(t===void 0){let n=e?.book;if(!n||n.width<=0||n.height<=0)return;t=n.width/n.height}t<=0||this.#V!==null&&Math.abs(t-this.#V)<.005||(this.#V=t,this.#e.style.aspectRatio=t.toFixed(4))}#mn(e){if(this.#i.state!==`idle`){this.#je.add(e);return}let t=this.#q[this.#J];if(!(!t||!(t.left===e||t.right===e))){if(this.#ie>1){this.#hn();return}this.#dn()}}#hn(){this.#Ue!==null&&clearTimeout(this.#Ue);let e=this.#_n();if(e!==this.#Ve){if(e===1){this.#He++,this.#Ve=1,this.#dn();return}this.#Ue=setTimeout(()=>{this.#Ue=null,this.#vn()},zn)}}#gn(){let e=this.#se?.measure(),t=e?.content??e?.book;if(!t||t.width<=0)return 1;let n=this.#X,r=+!!n.left+ +!!n.right;if(r===0)return 1;let i=t.width/r,a=typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1,o=0;for(let e of[n.left,n.right]){if(!e||e.width<=0)continue;let t=e.width/this.#Ve;o=Math.max(o,i*a/t)}return o===0?1:o}#_n(){let e=Math.max(1,Vn/(typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1)),t=this.#ie<=1?1:this.#ie,n=this.#gn()*Math.max(t,e);return n<=1.001?1:Math.min(Math.ceil(n*2)/2,Bn)}async#vn(){let e=this.#q[this.#J];if(!this.#se||!e)return;let t=this.#_n();if(t===1||t===this.#Ve||this.#i.state!==`idle`)return;let n=++this.#He,r={x:0,y:0,width:1,height:1},i=await Promise.all([e.left,e.right].map(async e=>{if(e===null)return null;try{return await this.#t.get(e,{scale:t,region:r,maxSize:this.#se?.maxTextureSize})}catch(t){return this.#n.emit(`sourceError`,{index:e,error:t}),null}}));if(n!==this.#He||this.#_n()!==t||this.#i.state!==`idle`)return;let a=i[0]??this.#X.left,o=i[1]??this.#X.right;a===this.#X.left&&o===this.#X.right||(this.#Ve=t,this.#X={left:a,right:o},this.#se.renderSpread(e,this.#X,{fill:this.#L,fit:this.#d}))}#yn(){if(this.#je.size===0)return;let e=this.#q[this.#J],t=e!==void 0&&[e.left,e.right].some(e=>e!==null&&this.#je.has(e));this.#je.clear(),t&&(this.#ie>1?this.#hn():this.#dn())}#bn(){typeof ResizeObserver>`u`||(this.#ne=new ResizeObserver(()=>this.#xn()),this.#ne.observe(this.#e))}#xn(){this.#re||(this.#re=!0,requestAnimationFrame(()=>{this.#re=!1,this.update()}))}async#Sn(e){let[t,n]=await Promise.all([this.#Cn(e.left),this.#Cn(e.right)]);return{left:t,right:n}}async#Cn(e){if(e===null)return null;try{return await this.#t.get(e)}catch(t){return this.#n.emit(`sourceError`,{index:e,error:t}),null}}#wn(){let{toMount:e}=this.#r.update(this.#J,this.#q.length),t=[];for(let n of e){let e=this.#q[n];e?.left!=null&&t.push(e.left),e?.right!=null&&t.push(e.right)}this.#t.prefetch(t)}#Tn(e){let t=this.#q.findIndex(t=>t.left===e||t.right===e);return t===-1?0:t}#En(){let e=this.#t.pageCount;if(!Number.isInteger(e)||e<1)throw Error(`Zine: source has ${e} pages; a Source must have at least 1 page.`);let t=this.#H;if(t!==void 0&&(!Number.isInteger(t)||t<0||t>=e))throw Error(`Zine: startPage ${JSON.stringify(t)} is out of range for a ${e}-page book (valid 0..${e-1}).`);let n=this.#cn();this.#L=n===`single`,this.#q=i(e,{direction:this.#a,mode:n});let r=this.#U?x(globalThis.location?.hash??``):null;this.#Y=Z(r??t??0,0,e-1),this.#J=this.#Tn(this.#Y)}};function Z(e,t,n){return e<t?t:e>n?n:e}function tr(e,t,n){if(t<=n){let r=(n-t)/2-e;return[r,r]}return[n-(e+t),-e]}function nr(e){return e<.5?2*e*e:1-(-2*e+2)**2/2}function Q(e){return e===null?`null`:Array.isArray(e)?`array`:typeof e}function rr(e,t){if(typeof e!=`object`||!e||typeof e.appendChild!=`function`||typeof e.addEventListener!=`function`)throw Error(`Zine: container must be a DOM element; received ${Q(e)}.`);if(typeof t!=`object`||!t)throw Error("Zine: an options object with a `source` is required.");let n=t,r=n.source;if(typeof r!=`object`||!r||typeof r.get!=`function`||typeof r.pageCount!=`number`)throw Error("Zine: `source` is required and must be a Source, e.g. new ImageSource(urls).");let i=n.startPage;if(i!==void 0&&(typeof i!=`number`||!Number.isInteger(i)||i<0))throw Error(`Zine: startPage must be a non-negative integer; got ${JSON.stringify(i)}.`);let a=n.direction;if(a!==void 0&&a!==`ltr`&&a!==`rtl`)throw Error(`Zine: direction must be 'ltr' or 'rtl'; got ${JSON.stringify(a)}.`);let o=n.clickToFlip;if(o!==void 0&&![`edge`,`half`,`off`].includes(o))throw Error(`Zine: clickToFlip must be 'edge', 'half', or 'off'; got ${JSON.stringify(o)}.`);let s=n.fit;if(s!==void 0&&s!==`contain`&&s!==`fill`)throw Error(`Zine: fit must be 'contain' or 'fill'; got ${JSON.stringify(s)}.`);let c=n.strings;if(c!==void 0&&(typeof c!=`object`||!c))throw Error(`Zine: strings must be an object of text overrides; got ${Q(c)}.`);let l=n.curl;if(l!==void 0){if(typeof l==`object`&&l){if(typeof l.deform!=`function`)throw Error(`Zine: a curl model must have a deform() function.`)}else if(T.includes(l))throw Error(`Zine: the '${String(l)}' curl is not bundled. Import it and pass the model: import { ${String(l)} } from '@zinejs/core/curls'  →  curl: ${String(l)}`);else if(!w.includes(l))throw Error(`Zine: curl must be ${w.join(` or `)}, or a model imported from '@zinejs/core/curls' (${T.join(`, `)}); got ${JSON.stringify(l)}.`)}for(let e of[`deepLink`,`disableContextMenu`,`responsiveSpread`,`loading`])if(n[e]!==void 0&&typeof n[e]!=`boolean`)throw Error(`Zine: ${e} must be a boolean; got ${Q(n[e])}.`);let u=n.controls;if(u!==void 0&&typeof u!=`boolean`&&(typeof u!=`object`||!u))throw Error(`Zine: controls must be a boolean or an options object; got ${Q(u)}.`);let d=u?.position;if(d!==void 0&&![`top`,`bottom`,`left`,`right`].includes(d))throw Error(`Zine: controls.position must be 'top', 'bottom', 'left', or 'right'; got ${JSON.stringify(d)}.`);let f=u?.colorScheme;if(f!==void 0&&![`light`,`dark`,`auto`].includes(f))throw Error(`Zine: controls.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(f)}.`);let p=u?.arrows;if(p!==void 0&&typeof p!=`boolean`&&![`desktop`,`mobile`].includes(p))throw Error(`Zine: controls.arrows must be a boolean, 'desktop', or 'mobile'; got ${JSON.stringify(p)}.`);let m=n.contextMenu;if(m!==void 0&&typeof m!=`boolean`&&(typeof m!=`object`||!m))throw Error(`Zine: contextMenu must be a boolean or an options object; got ${Q(m)}.`);let h=m?.colorScheme;if(h!==void 0&&![`light`,`dark`,`auto`].includes(h))throw Error(`Zine: contextMenu.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(h)}.`);if(n.disableContextMenu===!0&&m!==void 0&&m!==!1)throw Error(`Zine: disableContextMenu and contextMenu are mutually exclusive — one removes the browser's right-click menu, the other replaces it. Enable only one.`);let g=n.hideControls;if(g!==void 0&&(!Array.isArray(g)||g.some(e=>typeof e!=`string`)))throw Error(`Zine: hideControls must be an array of control-id strings; got ${Q(g)}.`);let _=n.sound;if(_!==void 0&&typeof _!=`boolean`&&(typeof _!=`object`||!_))throw Error(`Zine: sound must be a boolean or an options object; got ${Q(_)}.`);if(typeof _==`object`&&_){let e=_;if(e.url!==void 0&&typeof e.url!=`string`)throw Error(`Zine: sound.url must be a string URL; got ${Q(e.url)}.`);if(e.volume!==void 0&&(typeof e.volume!=`number`||e.volume<0||e.volume>1))throw Error(`Zine: sound.volume must be a number between 0 and 1; got ${JSON.stringify(e.volume)}.`);if(e.muted!==void 0&&typeof e.muted!=`boolean`)throw Error(`Zine: sound.muted must be a boolean; got ${Q(e.muted)}.`);if(e.persist!==void 0&&typeof e.persist!=`boolean`)throw Error(`Zine: sound.persist must be a boolean; got ${Q(e.persist)}.`)}let v=n.spreadMode;if(v!==void 0&&![`double`,`single`,`cover`,`book`].includes(v))throw Error(`Zine: spreadMode must be 'double', 'single', 'cover', or 'book'; got ${JSON.stringify(v)}.`);for(let e of[`frontCover`,`backCover`]){let t=n[e];if(t!==void 0&&typeof t!=`string`)throw Error(`Zine: ${e} must be an image URL string; got ${JSON.stringify(t)}.`)}let y=n.pages;if(y!==void 0&&(typeof y!=`object`||!y||Array.isArray(y)))throw Error(`Zine: pages must be an object mapping page indices to image URLs.`);$(n.width,`width`,1),$(n.height,`height`,1),$(n.flipDuration,`flipDuration`,0),$(n.clickZoneSize,`clickZoneSize`,0),$(n.clickFlipDelay,`clickFlipDelay`,0),$(n.singlePageThreshold,`singlePageThreshold`,0),ir(n.zoom),ar(n.renderer)}function $(e,t,n){if(e!==void 0&&(typeof e!=`number`||!Number.isFinite(e)||e<n))throw Error(`Zine: ${t} must be a number >= ${n}; got ${JSON.stringify(e)}.`)}function ir(e){if(e===void 0)return;if(typeof e!=`object`||!e||Array.isArray(e))throw Error(`Zine: zoom must be an object, e.g. { max: 4 }.`);let t=e;if(t.enabled!==void 0&&typeof t.enabled!=`boolean`)throw Error(`Zine: zoom.enabled must be a boolean; got ${JSON.stringify(t.enabled)}.`);if(t.wheel!==void 0&&typeof t.wheel!=`boolean`)throw Error(`Zine: zoom.wheel must be a boolean; got ${JSON.stringify(t.wheel)}.`);if(t.doubleClickInFlipZone!==void 0&&typeof t.doubleClickInFlipZone!=`boolean`)throw Error(`Zine: zoom.doubleClickInFlipZone must be a boolean; got ${JSON.stringify(t.doubleClickInFlipZone)}.`);if(t.doubleClick!==void 0&&t.doubleClick!==!1){let e=t.doubleClick;if(!Array.isArray(e)||e.some(e=>typeof e!=`number`||!Number.isFinite(e)||e<1))throw Error(`Zine: zoom.doubleClick must be false or an array of zoom levels >= 1, e.g. [1, 2, 4].`)}$(t.max,`zoom.max`,1)}function ar(e){if(e!==void 0){if(typeof e==`string`){if(e!==`auto`&&e!==`css`&&e!==`webgl2`)throw Error(`Zine: renderer '${e}' is not recognized; use 'auto', 'css', 'webgl2', an array of those, or a custom Renderer.`);return}if(Array.isArray(e)){for(let t of e)if(t!==`css`&&t!==`webgl2`)throw Error(`Zine: renderer order array may only contain 'css' or 'webgl2'; got ${JSON.stringify(t)}.`);return}if(!(typeof e==`object`&&e&&typeof e.mount==`function`))throw Error(`Zine: renderer must be 'auto', 'css', 'webgl2', an array of those, or a custom Renderer instance.`)}}var or=class{pageCount;fit;#e;#t;#n=new Map;constructor(e,t={}){this.#e=e,this.pageCount=e.length,this.#t=t.preload??1,this.fit=t.fit??`contain`}get(e){let t=this.#r(e);for(let t=1;t<=this.#t;t++)this.prefetch([e-t,e+t]);return t}prefetch(e){for(let t of e)t>=0&&t<this.pageCount&&this.#r(t).catch(()=>{})}destroy(){for(let e of this.#n.values())e.then(e=>e.close()).catch(()=>{});this.#n.clear()}#r(e){let t=this.#n.get(e);if(t)return t;let n=this.#e[e];if(n===void 0)return Promise.reject(RangeError(`ImageSource: page ${e} is out of range (0..${this.pageCount-1}).`));let r=(async()=>{let t=await fetch(n);if(!t.ok)throw Error(`ImageSource: failed to fetch page ${e} (${n}) — HTTP ${t.status}.`);return createImageBitmap(await t.blob())})().catch(t=>{throw this.#n.delete(e),t});return this.#n.set(e,r),r}};V(),E(),e.CURL_TYPES=w,e.DEFAULT_ITEMS=B,e.IMPORTABLE_CURLS=T,e.ImageSource=or,e.Zine=er,e.defaultStrings=N,e.defineControl=R,e.getControl=gt});
//# sourceMappingURL=index.umd.js.map