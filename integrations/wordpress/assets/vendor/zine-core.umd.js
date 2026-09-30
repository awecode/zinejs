(function(e,t){typeof exports==`object`&&typeof module<`u`?t(exports):typeof define==`function`&&define.amd?define([`exports`],t):(e=typeof globalThis<`u`?globalThis:e||self,t(e.ZineJS={}))})(this,function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t=Object.defineProperty,n=(e,t,n)=>()=>{if(n)throw n[0];try{return e&&(t=e(e=0)),t}catch(e){throw n=[e],e}},r=(e,n)=>{let r={};for(var i in e)t(r,i,{get:e[i],enumerable:!0});return n||t(r,Symbol.toStringTag,{value:`Module`}),r};function i(e,t={}){let{direction:n=`ltr`,mode:r=`cover`}=t;if(e<=0)return[];let i=t=>t>=0&&t<e?t:null,a=[];if(r===`single`)for(let t=0;t<e;t++)a.push({left:null,right:t});else if(r===`double`)for(let t=0;t<e;t+=2)a.push({left:i(t),right:i(t+1)});else if(r===`cover`){a.push({left:null,right:0});for(let t=1;t<e;t+=2)a.push({left:i(t),right:i(t+1)})}else if(a.push({left:null,right:0}),e>1){for(let t=1;t<=e-2;t+=2)a.push({left:i(t),right:t+1<=e-2?i(t+1):null});a.push({left:e-1,right:null})}return n===`rtl`?a.map(e=>({left:e.right,right:e.left})):a}function a(e,t){return e<t}function o(e,t,n){let r=[],i=Math.max(0,e-n),a=Math.min(t-1,e+n);for(let e=i;e<=a;e++)r.push(e);return r}var s=class{#e;#t=new Set;constructor(e=2){this.#e=e}get mounted(){return[...this.#t].sort((e,t)=>e-t)}update(e,t){let n=new Set(o(e,t,this.#e)),r=[...n].filter(e=>!this.#t.has(e)).sort((e,t)=>e-t),i=[...this.#t].filter(e=>!n.has(e)).sort((e,t)=>e-t);for(let e of i)this.#t.delete(e);for(let e of r)this.#t.add(e);return{toMount:r,toEvict:i}}},c=class{#e=new Map;on(e,t){let n=this.#e.get(e);return n||(n=new Set,this.#e.set(e,n)),n.add(t),()=>this.off(e,t)}off(e,t){this.#e.get(e)?.delete(t)}emit(e,...t){let n=t[0],r=this.#e.get(e);if(r)for(let e of[...r])e(n)}clear(){this.#e.clear()}},l={idle:{grab:`dragging`,panStart:`zoomed-panning`,flip:`animating`},dragging:{release:`animating`},animating:{settle:`idle`},"zoomed-panning":{panEnd:`idle`}};function u(e,t){return l[e][t]??null}var d=class{#e;constructor(e=`idle`){this.#e=e}get state(){return this.#e}send(e){let t=u(this.#e,e);return t!==null&&(this.#e=t),t}},f=.3,p=class{#e;#t=null;#n=null;#r=null;#i=null;constructor(e={}){this.#e=e}get active(){return this.#t!==null}down(e,t,n,r){if(this.#t!==null)return;this.#t=e;let i={x:t,y:n,t:r};this.#n=i,this.#r=i,this.#i=i,this.#e.onStart?.({x:t,y:n,t:r})}move(e,t,n,r){e!==this.#t||this.#n===null||(this.#r=this.#i,this.#i={x:t,y:n,t:r},this.#e.onMove?.({x:t,y:n,dx:t-this.#n.x,dy:n-this.#n.y}))}up(e,t,n,r){this.#a(e,t,n,r,!1)}cancel(e,t,n,r){this.#a(e,t,n,r,!0)}#a(e,t,n,r,i){if(e!==this.#t||this.#n===null)return;let a=this.#n,o=this.#i??a,s=this.#r??a,c=o.t-s.t,l=c>0?(o.x-s.x)/c:0,u=c>0?(o.y-s.y)/c:0,d=Math.hypot(l,u);this.#o(),this.#e.onEnd?.({x:t,y:n,dx:t-a.x,dy:n-a.y,dt:r-a.t,vx:l,vy:u,swipe:!i&&d>f,canceled:i})}#o(){this.#t=null,this.#n=null,this.#r=null,this.#i=null}};function m(e,t){let{pointer:n,pinch:r}=t,i=e=>{let t=e;n?.down(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.down(t.pointerId,t.clientX,t.clientY)},a=e=>{let t=e;n?.move(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.move(t.pointerId,t.clientX,t.clientY)},o=e=>{let t=e;n?.up(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.up(t.pointerId)},s=e=>{let t=e;n?.cancel(t.pointerId,t.clientX,t.clientY,t.timeStamp),r?.cancel(t.pointerId)};return e.addEventListener(`pointerdown`,i),e.addEventListener(`pointermove`,a),e.addEventListener(`pointerup`,o),e.addEventListener(`pointercancel`,s),()=>{e.removeEventListener(`pointerdown`,i),e.removeEventListener(`pointermove`,a),e.removeEventListener(`pointerup`,o),e.removeEventListener(`pointercancel`,s)}}function h(e,t){return Math.hypot(e.x-t.x,e.y-t.y)}var g=class{#e;#t=new Map;#n=0;#r=!1;constructor(e={}){this.#e=e}get pinching(){return this.#r}down(e,t,n){if(!(this.#t.has(e)||this.#t.size>=2)&&(this.#t.set(e,{x:t,y:n}),this.#t.size===2)){let{a:e,b:t}=this.#a();this.#n=h(e,t),this.#r=!0,this.#e.onPinchStart?.({centerX:(e.x+t.x)/2,centerY:(e.y+t.y)/2,distance:this.#n})}}move(e,t,n){let r=this.#t.get(e);if(!r||(r.x=t,r.y=n,!this.#r))return;let{a:i,b:a}=this.#a();this.#e.onPinchMove?.({centerX:(i.x+a.x)/2,centerY:(i.y+a.y)/2,scale:this.#n>0?h(i,a)/this.#n:1})}up(e){this.#i(e)}cancel(e){this.#i(e)}#i(e){this.#t.delete(e)&&this.#r&&this.#t.size<2&&(this.#r=!1,this.#n=0,this.#e.onPinchEnd?.())}#a(){let e=[...this.#t.values()],t=e[0],n=e[1];if(!t||!n)throw Error(`Zine: pinch requires two active pointers.`);return{a:t,b:n}}},_=`page`,v=!1;function y(){return v?!1:(v=!0,!0)}function b(){v=!1}function x(e){let t=new URLSearchParams(e.replace(/^#/,``)).get(_);if(t===null)return null;let n=Number(t);return Number.isInteger(n)&&n>=1?n-1:null}function S(e,t){let n=new URLSearchParams(e.replace(/^#/,``));return n.set(_,String(t+1)),`#${n.toString()}`}function C(e,t){let n=null,r=()=>{let r=x(e.location.hash);r===null||r===n||(n=r,t(r))};return e.addEventListener(`hashchange`,r),{push(t){if(t===n)return;n=t;let r=S(e.location.hash,t);r!==e.location.hash&&e.history?.replaceState?.(e.history.state,``,r)},stop(){e.removeEventListener(`hashchange`,r)}}}var w,T,ee,E=n((()=>{w=[`cone`,`simple`],T=[`roll`,`leaf`,`flick`,`silk`],ee=`cone`}));function te(e){let t=e<0?0:e>1?1:e,n=Math.sin(t*Math.PI);return{angle:t*Math.PI,curl:n,shadowAlpha:n}}var ne=n((()=>{}));function D(e,t){return!t&&e.left!==null&&e.right!==null?e.spineTrim??0:0}var O,k,A,re=n((()=>{O=[0,1],k=e=>[0,1-e],A=e=>[e,1]})),ie=r({CssRenderer:()=>se});function j(e){return e.left===null==(e.right===null)?0:e.right===null?1:-1}function ae(e){let t=e===`forward`?`to right`:`to left`;return[`linear-gradient(${t}, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0) 60%)`,`linear-gradient(${t}, transparent 40%, rgba(255,255,255,0.32) 66%, transparent 90%)`,`linear-gradient(${t}, transparent 66%, rgba(0,0,0,0.35))`].join(`,`)}var oe,se,ce=n((()=>{ne(),re(),oe=180/Math.PI,se=class{#e=null;#t;#n;#r;#i;#a;#o;#s;#c;#l;#u=0;#d=0;#f=0;#p=0;#m=`contain`;#h=0;#g=!1;#_=0;mount(e){let t=e.ownerDocument;return this.#e=e,this.#t=t.createElement(`div`),this.#t.className=`zine-clip`,this.#t.style.cssText=`position:relative;width:100%;height:100%;overflow:hidden;`,this.#n=t.createElement(`div`),this.#n.className=`zine-viewport`,this.#n.style.cssText=`position:absolute;inset:0;transform-origin:0 0;`,this.#r=t.createElement(`div`),this.#r.className=`zine-book`,this.#r.style.cssText=`position:absolute;inset:0;perspective:2000px;transform-style:preserve-3d;`,this.#i=this.#w(t,`zine-page-left`,`left:0;`),this.#a=this.#w(t,`zine-page-right`,`right:0;`),this.#o=t.createElement(`div`),this.#o.className=`zine-leaf`,this.#o.style.cssText=`position:absolute;top:0;width:50%;height:100%;transform-style:preserve-3d;display:none;`,this.#s=t.createElement(`canvas`),this.#s.className=`zine-leaf-front`,this.#s.style.cssText=`position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;`,this.#c=t.createElement(`canvas`),this.#c.className=`zine-leaf-back`,this.#c.style.cssText=`position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;transform:rotateY(180deg);`,this.#l=t.createElement(`div`),this.#l.className=`zine-leaf-shadow`,this.#l.style.cssText=`position:absolute;inset:0;opacity:0;pointer-events:none;`,this.#l.style.background=ae(`forward`),this.#o.append(this.#s,this.#c,this.#l),this.#r.append(this.#i,this.#a,this.#o),this.#n.append(this.#r),this.#t.append(this.#n),e.append(this.#t),Promise.resolve()}destroy(){this.#t?.remove(),this.#e=null}renderSpread(e,t,n){if(n?.fill)this.#i.style.width=`100%`,this.#a.style.display=`none`,this.#T(this.#i,t.right??t.left);else{this.#i.style.width=`50%`,this.#a.style.display=``;let e=D(t,!1);this.#T(this.#i,t.left,k(e)),this.#T(this.#a,t.right,A(e))}this.#g=n?.fill??!1,n?.fit&&(this.#m=n.fit),this.#_=this.#g?0:j(t),this.#y(t,this.#g),this.#x(),this.#v(this.#_),this.#o.style.display=`none`,this.#o.style.transform=``,this.#l.style.opacity=`0`}beginFlip(e,t,n,r){if(r?.fill)this.#i.style.width=`100%`,this.#a.style.display=`none`,this.#o.style.width=`100%`,this.#o.style.left=`0`,this.#o.style.transformOrigin=n===`forward`?`left center`:`right center`,this.#T(this.#i,t.right??t.left),this.#T(this.#s,e.right??e.left),this.#T(this.#c,t.right??t.left);else{this.#i.style.width=`50%`,this.#a.style.display=``,this.#o.style.width=`50%`;let r=D(e,!1),i=D(t,!1);n===`forward`?(this.#T(this.#i,e.left,k(r)),this.#T(this.#a,t.right,A(i)),this.#T(this.#s,e.right,A(r)),this.#T(this.#c,t.left,k(i)),this.#o.style.left=`50%`,this.#o.style.transformOrigin=`left center`):(this.#T(this.#a,e.right,A(r)),this.#T(this.#i,t.left,k(i)),this.#T(this.#s,e.left,k(r)),this.#T(this.#c,t.right,A(i)),this.#o.style.left=`0`,this.#o.style.transformOrigin=`right center`)}this.#u=r?.fill?0:j(e),this.#d=r?.fill?0:j(t),this.#g=r?.fill??!1,r?.fit&&(this.#m=r.fit),this.#y(t,this.#g),this.#x(),this.#v(this.#u),this.#o.style.display=`block`,this.#o.style.transform=`rotateY(0deg)`,this.#l.style.background=ae(n),this.#l.style.opacity=`0`}setFlipProgress(e,t){let n=te(e),r=n.angle*oe;this.#v(this.#u+(this.#d-this.#u)*e),this.#o.style.display=`block`,this.#o.style.transform=`rotateY(${t===`forward`?-r:r}deg)`,this.#l.style.opacity=String(n.shadowAlpha)}#v(e){let t=e*(this.#h/4);this.#r.style.transform=t?`translateX(${t}px)`:``}#y(e,t){let n=e.left??e.right;if(n&&n.height){let r=n.width/n.height;this.#f=r*(1-D(e,t)),this.#p===0&&(this.#p=r)}}#b(){return this.#m===`fill`&&this.#p>0?this.#p:this.#f}#x(){let e=this.#S();this.#h=e.width;let t=this.#r.style;t.inset=`auto`,t.left=`${e.x}px`,t.top=`${e.y}px`,t.width=`${e.width}px`,t.height=`${e.height}px`}#S(){let e=this.#e?.clientWidth??0,t=this.#e?.clientHeight??0,n=this.#b();if(n<=0||e<=0||t<=0)return{x:0,y:0,width:e,height:t};let r=(this.#g?1:2)*n,i=e,a=t;return r>e/t?a=e/r:i=t*r,{x:(e-i)/2,y:(t-a)/2,width:i,height:a}}#C(){let e=this.#S();return this.#_===0?e:{x:e.x+e.width/4,y:e.y,width:e.width/2,height:e.height}}setViewTransform(e,t,n){this.#n.style.transform=`translate(${t}px, ${n}px) scale(${e})`}measure(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#f>0,i=r?this.#S():void 0,a=r?this.#C():void 0,o=a?e=>({x:a.x*e,y:a.y*e,width:a.width*e,height:a.height*e}):void 0;return{containerWidth:t,containerHeight:n,pageWidth:t/2,pageHeight:n,book:i,content:a,screenAt:o,containerAspect:this.#p>0?(this.#g?1:2)*this.#p:void 0}}#w(e,t,n){let r=e.createElement(`canvas`);return r.className=t,r.style.cssText=`position:absolute;top:0;width:50%;height:100%;${n}`,r}#T(e,t,n=O){let r=e.getContext(`2d`);if(t===null){r?.clearRect(0,0,e.width,e.height);return}let i=n[0]*t.width,a=(n[1]-n[0])*t.width;e.width=Math.round(a),e.height=t.height,r?.drawImage(t,i,0,a,t.height,0,0,e.width,t.height)}}}));function le(e,t){let n=e+1,r=t+1,i=n*r,a=new Float32Array(i*2);for(let i=0;i<r;i++)for(let r=0;r<n;r++){let o=i*n+r;a[o*2]=r/e,a[o*2+1]=i/t}return{cols:e,rows:t,uvs:a,positions:new Float32Array(i*3),normals:new Float32Array(i*3)}}function ue(e){let t=e.cols+1,n=e.rows+1,r=e.positions,i=e.normals;for(let e=0;e<n;e++)for(let a=0;a<t;a++){let o=a>0?a-1:a,s=a<t-1?a+1:a,c=e>0?e-1:e,l=e<n-1?e+1:e,u=(e*t+s)*3,d=(e*t+o)*3,f=(l*t+a)*3,p=(c*t+a)*3,m=r[u]-r[d],h=r[u+1]-r[d+1],g=r[u+2]-r[d+2],_=r[f]-r[p],v=r[f+1]-r[p+1],y=r[f+2]-r[p+2],b=h*y-g*v,x=g*_-m*y,S=m*v-h*_,C=Math.hypot(b,x,S)||1;b/=C,x/=C,S/=C;let w=(e*t+a)*3;i[w]=b,i[w+1]=x,i[w+2]=S}}var de=n((()=>{}));function fe(e,t,n,r,i){let a=e.cols+1,o=e.rows+1,s=e.positions,c=r>=M?1:r/M,l=Math.sin(Math.PI*c),u=Math.PI/2-l*(Math.PI/2-pe),d=Math.sin(u),f=Math.cos(u),p=1/Math.max(d,1e-6),m=n*(me+(he-me)*l),h=(i.y-.5)*2,g=h>=0,_=Math.min(1,Math.abs(h)/ge),v=1-_,y=g?n+m:-m,b=Math.hypot(t,.5*n-y),x=Math.max(b*d,t/Math.PI),S=Math.min(1,r/_e),C=-Math.PI*S,w=Math.cos(C),T=Math.sin(C);if(l<1e-4){for(let r=0;r<o;r++){let i=r/e.rows*n;for(let n=0;n<a;n++){let o=n/e.cols*t,c=(r*a+n)*3;s[c]=o*w,s[c+1]=i,s[c+2]=-o*T}}ue(e);return}for(let r=0;r<o;r++){let i=r/e.rows*n;for(let o=0;o<a;o++){let c=o/e.cols*t,l=c,u=i,h=0;if(_>1e-5){let e=g?n-i:i,t=-m,r=Math.hypot(c,e-t);if(r>1e-8){let e=r*d,i=Math.asin(Math.min(1,Math.max(0,c/r)))*p,a=1-Math.cos(i),o=r+t-e*a*d;l=e*Math.sin(i),u=g?n-o:o,h=e*a*f}}let y=l,b=u,S=h;if(v>1e-5){let e=c/x,t=x*Math.sin(e),n=x*(1-Math.cos(e));y=_*l+v*t,b=_*u+v*i,S=_*h+v*n}let C=(r*a+o)*3;s[C]=y*w+S*T,s[C+1]=b,s[C+2]=-y*T+S*w}}ue(e)}var pe,me,he,ge,M,_e,ve=n((()=>{de(),pe=30*Math.PI/180,me=1.35,he=.7,ge=.42,M=.84,_e=.88}));function ye(e,t,n,r){let i=e.cols+1,a=e.rows+1,o=e.positions,s=r*Math.PI,c=Math.cos(s),l=Math.sin(s);for(let r=0;r<i;r++){let s=r/e.cols*t,u=s*c,d=s*l;for(let t=0;t<a;t++){let a=(t*i+r)*3;o[a]=u,o[a+1]=t/e.rows*n,o[a+2]=d}}ue(e)}var be=n((()=>{de()}));function xe(e){if(typeof e!=`string`)return e;let t=we[e];if(t)return t;throw T.includes(e)?Error(`Zine: the '${e}' curl is not bundled. Import it and pass the model: import { ${e} } from '@zinejs/core/curls'  →  curl: ${e}`):Error(`Zine: unknown curl ${JSON.stringify(e)}.`)}var Se,Ce,we,Te=n((()=>{ve(),be(),E(),Se={deform:fe,anchored:!0},Ce={deform:ye,anchored:!1,flat:!0,gloss:!1},we={cone:Se,simple:Ce}}));function Ee(e){let t=e.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!0,depth:!1,stencil:!1,preserveDrawingBuffer:!0});if(t===null)throw Error(`WebglRenderer: could not create a WebGL2 context.`);return t}var De=n((()=>{}));function Oe(e,t,n){let r=e.createProgram();if(r===null)throw Error(`WebglRenderer: could not create a program.`);let i=ke(e,e.VERTEX_SHADER,t),a=ke(e,e.FRAGMENT_SHADER,n);if(e.attachShader(r,i),e.attachShader(r,a),e.linkProgram(r),e.deleteShader(i),e.deleteShader(a),!e.getProgramParameter(r,e.LINK_STATUS)){let t=e.getProgramInfoLog(r);throw e.deleteProgram(r),Error(`WebglRenderer: program link failed: ${t??`unknown error`}`)}return r}function ke(e,t,n){let r=e.createShader(t);if(r===null)throw Error(`WebglRenderer: could not create a shader.`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`WebglRenderer: shader compile failed: ${t??`unknown error`}`)}return r}var Ae=n((()=>{}));function je(e){let t=e.createTexture();if(t===null)throw Error(`WebglRenderer: could not create a texture.`);return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),t}function Me(e,t,n){let r=Ne(n,e.getParameter(e.MAX_TEXTURE_SIZE));return e.bindTexture(e.TEXTURE_2D,t),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,r),{width:r.width,height:r.height}}function Ne(e,t){let n=e,r=Math.max(n.width,n.height);if(!Number.isFinite(t)||t<=0||r<=t)return n;let i=t/r,a=document.createElement(`canvas`);return a.width=Math.max(1,Math.floor(n.width*i)),a.height=Math.max(1,Math.floor(n.height*i)),a.getContext(`2d`)?.drawImage(e,0,0,a.width,a.height),a}var Pe=n((()=>{})),Fe=r({WebglRenderer:()=>Ke});function N(e){return e.left===null==(e.right===null)?0:e.right===null?1:-1}var Ie,Le,Re,ze,Be,Ve,He,Ue,We,Ge,Ke,qe=n((()=>{de(),Te(),E(),re(),De(),Ae(),Pe(),Ie=`#version 300 es
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
}`,Le=`#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uGutterSide; // +1 = spine at right edge, -1 = at left edge, 0 = none
uniform vec2 uSpan; // visible u-range of the page texture (a spine trim narrows it)
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vec2(mix(uSpan.x, uSpan.y, vUv.x), vUv.y));
  if (uGutterSide != 0.0) {
    float d = uGutterSide > 0.0 ? (1.0 - vUv.x) : vUv.x;
    c.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.10, d));
  }
  outColor = c;
}`,Re=`#version 300 es
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
}`,ze=`#version 300 es
precision mediump float;
in vec2 vUv;
in float vFacing;
in float vU;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform vec2 uFrontSpan; // visible u-ranges of the two faces (a spine trim narrows them)
uniform vec2 uBackSpan;
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
  vec4 c = showFront
    ? texture(uFront, vec2(mix(uFrontSpan.x, uFrontSpan.y, fx), vUv.y))
    : texture(uBack, vec2(mix(uBackSpan.x, uBackSpan.y, 1.0 - fx), vUv.y));

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
}`,Be=28,Ve=36,He=.7,Ue=.78,We=4e3,Ge=256*1024*1024,Ke=class{#e=null;#t=null;#n=null;#r=null;#i=null;#a=null;#o=null;#s=null;#c=null;#l=0;#u=le(Be,Ve);#d=new Map;#f=0;#p=null;#m=0;#h={};#g={};#_={scale:1,tx:0,ty:0};#v=1;#y=null;#b=!1;#x=null;#S=0;#C=we[ee];#w={y:.5};#T=0;#E=0;#D=0;#O=0;#k=0;#A=`contain`;#j=0;#M=0;#N=!1;#P=!1;#F=null;#I=null;mount(e){this.#e=e;let t=e.ownerDocument,n=t.createElement(`canvas`);return n.style.cssText=`display:block;width:100%;height:100%;`,e.append(n),this.#t=n,n.addEventListener(`webglcontextlost`,this.#V),n.addEventListener(`webglcontextrestored`,this.#H),t.addEventListener(`visibilitychange`,this.#U),this.#n=Ee(n),this.#m=this.#n.getParameter(this.#n.MAX_TEXTURE_SIZE),this.#K(),Promise.resolve()}destroy(){this.#G();let e=this.#t;e!==null&&(e.removeEventListener(`webglcontextlost`,this.#V),e.removeEventListener(`webglcontextrestored`,this.#H),e.ownerDocument.removeEventListener(`visibilitychange`,this.#U));let t=this.#n;if(t!==null){for(let e of this.#d.values())t.deleteTexture(e.tex);this.#p!==null&&t.deleteTexture(this.#p),this.#a!==null&&t.deleteVertexArray(this.#a),this.#o!==null&&t.deleteVertexArray(this.#o),this.#r!==null&&t.deleteProgram(this.#r),this.#i!==null&&t.deleteProgram(this.#i),t.getExtension(`WEBGL_lose_context`)?.loseContext()}e?.remove(),this.#d.clear(),this.#f=0,this.#p=null,this.#e=null,this.#t=null,this.#n=null,this.#y=null,this.#x=null}onFatal(e){this.#I=e}get maxTextureSize(){return this.#m||void 0}renderSpread(e,t,n){this.#y=t,this.#b=n?.fill??!1,n?.fit&&(this.#A=n.fit),this.#x=null,this.#L(t,this.#b),this.#Y()}#L(e,t){let n=e.left??e.right;if(n&&n.height){let r=n.width/n.height;this.#O=r*(1-D(e,t)),this.#k===0&&(this.#k=r)}}#R(){return this.#A===`fill`&&this.#k>0?this.#k:this.#O}beginFlip(e,t,n,r){let i=r?.fill??!1;r?.fit&&(this.#A=r.fit),this.#S=0,r?.curl&&(this.#C=xe(r.curl)),r?.anchor&&(this.#w=r.anchor),this.#E=i?0:N(e),this.#D=i?0:N(t),this.#L(t,i);let a=D(e,i),o=D(t,i);i?this.#x={underLeft:null,underRight:null,underFull:t.right??t.left,front:e.right??e.left,back:e.right??e.left,underLeftSpan:O,underRightSpan:O,frontSpan:O,backSpan:O,dir:n===`forward`?1:-1,fill:!0}:n===`forward`?this.#x={underLeft:e.left,underRight:t.right,underFull:null,front:e.right,back:t.left,underLeftSpan:k(a),underRightSpan:A(o),frontSpan:A(a),backSpan:k(o),dir:1,fill:!1}:this.#x={underLeft:t.left,underRight:e.right,underFull:null,front:e.left,back:t.right,underLeftSpan:k(o),underRightSpan:A(a),frontSpan:k(a),backSpan:A(o),dir:-1,fill:!1},this.#Y()}setFlipProgress(e,t){this.#S=e,this.#Y()}setViewTransform(e,t,n){this.#_={scale:e,tx:t,ty:n},this.#Y()}measure(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#O>0,i=r?this.#z():void 0,a=r?this.#B():void 0,o=a?e=>{let t=this.#T/this.#v;return{x:(a.x-t)*e+t,y:a.y*e,width:a.width*e,height:a.height*e}}:void 0;return{containerWidth:t,containerHeight:n,pageWidth:t/2,pageHeight:n,book:i,content:a,screenAt:o,containerAspect:this.#k>0?(this.#b?1:2)*this.#k:void 0}}#z(){let e=this.#e,t=e?.clientWidth??0,n=e?.clientHeight??0,r=this.#R();if(r<=0||t<=0||n<=0)return{x:0,y:0,width:t,height:n};let i=(this.#b?1:2)*r,a=t,o=n;return i>t/n?o=t/i:a=n*i,{x:(t-a)/2,y:(n-o)/2,width:a,height:o}}#B(){let e=this.#z();return!this.#b&&this.#y!==null&&N(this.#y)!==0?{x:e.x+e.width/4,y:e.y,width:e.width/2,height:e.height}:e}#V=e=>{e.preventDefault(),this.#N=!0,this.#F===null&&(this.#F=setTimeout(()=>this.#W(),We))};#H=()=>{this.#G(),this.#N=!1,this.#K(),this.#Y()};#U=()=>{this.#t?.ownerDocument.visibilityState===`visible`&&this.#Y()};#W(){this.#P||(this.#P=!0,this.#I?.())}#G(){this.#F!==null&&(clearTimeout(this.#F),this.#F=null)}#K(){let e=this.#n;if(e!==null){this.#r=Oe(e,Ie,Le),this.#i=Oe(e,Re,ze);for(let t of[`uViewport`,`uRect`,`uView`,`uTex`,`uGutterSide`,`uSpan`])this.#h[t]=e.getUniformLocation(this.#r,t);for(let t of[`uViewport`,`uView`,`uOriginX`,`uDir`,`uLeafW`,`uFront`,`uBack`,`uFrontSpan`,`uBackSpan`,`uGloss`,`uAlpha`,`uCrease`])this.#g[t]=e.getUniformLocation(this.#i,t);this.#a=this.#q(e,this.#r),this.#J(e,this.#i),this.#d.clear(),this.#f=0,this.#p=this.#ae(e),e.useProgram(this.#r),e.uniform1i(this.#h.uTex??null,0),e.useProgram(this.#i),e.uniform1i(this.#g.uFront??null,0),e.uniform1i(this.#g.uBack??null,1),e.clearColor(0,0,0,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)}}#q(e,t){let n=e.createVertexArray(),r=e.createBuffer();if(n===null||r===null)throw Error(`WebglRenderer: could not create buffers.`);e.bindVertexArray(n),e.bindBuffer(e.ARRAY_BUFFER,r),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),e.STATIC_DRAW);let i=e.getAttribLocation(t,`aUnit`);return e.enableVertexAttribArray(i),e.vertexAttribPointer(i,2,e.FLOAT,!1,0,0),e.bindVertexArray(null),n}#J(e,t){let n=[];for(let e=0;e<Ve;e++)for(let t=0;t<Be;t++){let r=e*29+t,i=r+1,a=r+29,o=a+1;n.push(r,a,i,i,a,o)}this.#l=n.length;let r=e.createVertexArray();this.#s=e.createBuffer(),this.#c=e.createBuffer();let i=e.createBuffer(),a=e.createBuffer();if(r===null||this.#s===null||this.#c===null||i===null||a===null)throw Error(`WebglRenderer: could not create mesh buffers.`);e.bindVertexArray(r),e.bindBuffer(e.ARRAY_BUFFER,this.#s),e.bufferData(e.ARRAY_BUFFER,this.#u.positions,e.DYNAMIC_DRAW);let o=e.getAttribLocation(t,`aPos`);e.enableVertexAttribArray(o),e.vertexAttribPointer(o,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,this.#c),e.bufferData(e.ARRAY_BUFFER,this.#u.normals,e.DYNAMIC_DRAW);let s=e.getAttribLocation(t,`aNormal`);e.enableVertexAttribArray(s),e.vertexAttribPointer(s,3,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,this.#u.uvs,e.STATIC_DRAW);let c=e.getAttribLocation(t,`aUv`);e.enableVertexAttribArray(c),e.vertexAttribPointer(c,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,a),e.bufferData(e.ELEMENT_ARRAY_BUFFER,new Uint16Array(n),e.STATIC_DRAW),e.bindVertexArray(null),this.#o=r}#Y(){let e=this.#n,t=this.#t;e===null||t===null||this.#N||e.isContextLost()||(this.#oe(),e.clear(e.COLOR_BUFFER_BIT),this.#X(),this.#x===null?this.#y!==null&&this.#Z():this.#Q())}#X(){let e=this.#n,t=this.#t,n=t.width,r=t.height,i=this.#R();if(i>0){let e=(this.#b?1:2)*i;e>n/r?(this.#j=n,this.#M=Math.round(n/e)):(this.#M=r,this.#j=Math.round(r*e))}else this.#j=n,this.#M=r;let a=Math.round((n-this.#j)/2),o=Math.round((r-this.#M)/2);e.viewport(a,o,this.#j,this.#M)}#Z(){let e=this.#j,t=this.#M,n=this.#y;if(this.#T=this.#b?0:N(n)*(e/4),this.#ee(),this.#b)this.#te({x:0,y:0,w:e,h:t},n.right??n.left);else{let r=D(n,!1);this.#te({x:0,y:0,w:e/2,h:t},n.left,+!!n.right,k(r)),this.#te({x:e/2,y:0,w:e/2,h:t},n.right,n.left?-1:0,A(r))}}#Q(){let e=this.#n,t=this.#j,n=this.#M,r=this.#x;if(this.#T=r.fill?0:(this.#E+(this.#D-this.#E)*this.#S)*(t/4),this.#ee(),r.fill?this.#te({x:0,y:0,w:t,h:n},r.underFull):(this.#te({x:0,y:0,w:t/2,h:n},r.underLeft,1,r.underLeftSpan),this.#te({x:t/2,y:0,w:t/2,h:n},r.underRight,-1,r.underRightSpan)),r.front===null&&r.back===null)return;let i=r.fill?t:t/2,a=r.fill?r.dir>0?0:t:t/2;this.#C.deform(this.#u,i,n,this.#S,{y:this.#w.y,fill:r.fill}),e.bindBuffer(e.ARRAY_BUFFER,this.#s),e.bufferSubData(e.ARRAY_BUFFER,0,this.#u.positions),e.bindBuffer(e.ARRAY_BUFFER,this.#c),e.bufferSubData(e.ARRAY_BUFFER,0,this.#u.normals),this.#ne(e.TEXTURE0,r.front),this.#ne(e.TEXTURE1,r.back),e.activeTexture(e.TEXTURE0),e.useProgram(this.#i),e.bindVertexArray(this.#o),e.uniform2f(this.#g.uViewport??null,t,n),e.uniform3f(this.#g.uView??null,this.#_.scale,this.#_.tx*this.#v+this.#T,this.#_.ty*this.#v),e.uniform1f(this.#g.uOriginX??null,a),e.uniform1f(this.#g.uDir??null,r.dir),e.uniform1f(this.#g.uLeafW??null,i),e.uniform2f(this.#g.uFrontSpan??null,r.frontSpan[0],r.frontSpan[1]),e.uniform2f(this.#g.uBackSpan??null,r.backSpan[0],r.backSpan[1]),e.uniform1f(this.#g.uGloss??null,this.#C.gloss===!1?0:1),e.uniform1f(this.#g.uAlpha??null,r.fill?this.#$():1),e.uniform1f(this.#g.uCrease??null,r.fill?Math.min(1,this.#S/.2):1),e.drawElements(e.TRIANGLES,this.#l,e.UNSIGNED_SHORT,0)}#$(){let e=this.#C.flat?He:Ue,t=(this.#S-e)/(1-e);return t<=0?1:t>=1?0:(1-t)**1.5}#ee(){let e=this.#n;e.useProgram(this.#r),e.bindVertexArray(this.#a),e.activeTexture(e.TEXTURE0),e.uniform2f(this.#h.uViewport??null,this.#j,this.#M),e.uniform3f(this.#h.uView??null,this.#_.scale,this.#_.tx*this.#v+this.#T,this.#_.ty*this.#v)}#te(e,t,n=0,r=O){let i=this.#n;t!==null&&(this.#ne(i.TEXTURE0,t),i.uniform4f(this.#h.uRect??null,e.x,e.y,e.w,e.h),i.uniform1f(this.#h.uGutterSide??null,n),i.uniform2f(this.#h.uSpan??null,r[0],r[1]),i.drawArrays(i.TRIANGLE_STRIP,0,4))}#ne(e,t){let n=this.#n;n.activeTexture(e),n.bindTexture(n.TEXTURE_2D,t===null?this.#p:this.#re(t))}#re(e){let t=this.#n,n=this.#d.get(e);if(n!==void 0)return this.#d.delete(e),this.#d.set(e,n),n.tex;let r=je(t),i=Me(t,r,e),a=i.width*i.height*4;return this.#d.set(e,{tex:r,bytes:a}),this.#f+=a,this.#ie(),r}#ie(){let e=this.#n;for(let[t,n]of this.#d){if(this.#f<=Ge||this.#d.size<=4)break;this.#d.delete(t),this.#f-=n.bytes,e.deleteTexture(n.tex)}}#ae(e){let t=je(e);return e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),t}#oe(){let e=this.#n,t=this.#t,n=this.#e;if(e===null||t===null||n===null)return;this.#v=typeof devicePixelRatio==`number`?devicePixelRatio:1;let r=Math.max(1,Math.round(n.clientWidth*this.#v)),i=Math.max(1,Math.round(n.clientHeight*this.#v));(t.width!==r||t.height!==i)&&(t.width=r,t.height=i,e.viewport(0,0,r,i))}}})),Je={css:async()=>new(await(Promise.resolve().then(()=>(ce(),ie)))).CssRenderer,webgl2:async()=>new(await(Promise.resolve().then(()=>(qe(),Fe)))).WebglRenderer},Ye=!0;function Xe(e){return typeof e==`object`&&!!e&&!Array.isArray(e)&&typeof e.mount==`function`}function Ze(e){return e.gpu&&Ye?[`webgl2`,`css`]:[`css`]}function Qe(){return{gpu:$e()}}function $e(){try{return!!document.createElement(`canvas`).getContext(`webgl2`)}catch{return!1}}async function et(e=`auto`,t=Qe()){if(Xe(e))return e;let n=Array.isArray(e)?e:e===`auto`?Ze(t):[e];for(let e of n){if(e===`webgl2`&&!t.gpu)continue;let n=Je[e];if(n)return n()}throw n.length===1&&n[0]===`webgl2`&&!t.gpu?Error(`renderer: 'webgl2' was forced but this device has no WebGL2. Use 'css' or 'auto'.`):Error(`renderer: none of [${n.join(`, `)}] could be loaded — use 'css' or 'auto'.`)}function tt(e,t){let n=typeof t.frontCover==`string`,r=typeof t.backCover==`string`,i=t.pages!=null&&Object.keys(t.pages).length>0;return!n&&!r&&!i?e:new rt(e,t)}function nt(e){return fetch(e).then(t=>{if(!t.ok)throw Error(`zine: could not load image "${e}" (HTTP ${t.status}).`);return t.blob()}).then(e=>createImageBitmap(e))}var rt=class{#e;#t;#n;#r;#i=new Map;#a=new Map;open;onPageUpdate;onProgress;getText;getDownload;getOutline;constructor(e,t){this.#e=e,this.#t=typeof t.frontCover==`string`?t.frontCover:null,this.#n=typeof t.backCover==`string`?t.backCover:null,this.#r=t.pages??{},typeof e.open==`function`?this.open=async()=>{await e.open(),this.#o()}:this.#o(),typeof e.onPageUpdate==`function`&&(this.onPageUpdate=t=>{e.onPageUpdate(e=>t(e+(this.#t===null?0:1)))}),typeof e.onProgress==`function`&&(this.onProgress=t=>e.onProgress(t)),typeof e.getText==`function`&&(this.getText=async t=>{let n=this.#t===null?0:1;if(this.#t!==null&&t===0||this.#n!==null&&t===this.pageCount-1)return``;let r=t-n;return this.#i.has(r)?``:e.getText(r)}),typeof e.getDownload==`function`&&(this.getDownload=()=>e.getDownload()),typeof e.getOutline==`function`&&(this.getOutline=async()=>{let t=await e.getOutline(),n=this.#t===null?0:1;if(n===0)return t;let r=e=>e.map(e=>({...e,page:e.page===null?null:e.page+n,children:r(e.children)}));return r(t)})}get pageCount(){return this.#e.pageCount+(this.#t===null?0:1)+(this.#n===null?0:1)}get(e,t){let n=this.#t===null?0:1;if(this.#t!==null&&e===0)return this.#s(this.#t);if(this.#n!==null&&e===this.pageCount-1)return this.#s(this.#n);let r=e-n,i=this.#i.get(r);return i===void 0?this.#e.get(r,t):this.#s(i)}prefetch(e){let t=this.#t===null?0:1,n=[];for(let r of e)if(this.#t!==null&&r===0)this.#s(this.#t).catch(()=>{});else if(this.#n!==null&&r===this.pageCount-1)this.#s(this.#n).catch(()=>{});else{let e=r-t,i=this.#i.get(e);i===void 0?n.push(e):this.#s(i).catch(()=>{})}this.#e.prefetch(n)}destroy(){this.#e.destroy();for(let e of this.#a.values())e.then(e=>e.close()).catch(()=>{});this.#a.clear()}#o(){let e=this.#e.pageCount;this.#i.clear();for(let[t,n]of Object.entries(this.#r)){let r=Number(t),i=r<0?e+r:r;Number.isInteger(i)&&i>=0&&i<e&&this.#i.set(i,n)}}#s(e){let t=this.#a.get(e);return t===void 0&&(t=nt(e).catch(t=>{throw this.#a.delete(e),t}),this.#a.set(e,t)),t}},it={prevPage:`Previous page`,nextPage:`Next page`,firstPage:`First page`,lastPage:`Last page`,zoomIn:`Zoom in`,zoomOut:`Zoom out`,fullscreen:`Fullscreen`,mute:`Mute page sound`,unmute:`Unmute page sound`,share:`Share`,downloadPdf:`Download PDF`,showOnePage:`Show one page`,showTwoPages:`Show two pages`,print:`Print`,more:`More`,controlsLabel:`Flipbook controls`,showThumbnails:`Show thumbnails`,hideThumbnails:`Hide thumbnails`,showOutline:`Show outline`,hideOutline:`Hide outline`,searchOpen:`Search`,searchClose:`Hide search`,pageWidgetLabel:`Page`,pageNumberLabel:`Page number`,roledescription:`flipbook`,thumbnailsLabel:`Pages`,outlineLabel:`Outline`,outlineLoading:`Loading…`,outlineEmpty:`This document has no outline.`,untitled:`Untitled`,searchResultsLabel:`Search results`,searchPlaceholder:`Search…`,searchInputLabel:`Search the document`,searching:`Searching…`,loadingOpening:`Opening document…`,loadingPreparing:`Preparing pages…`,shareFallbackTitle:`Flipbook`,close:`Close`,copy:`Copy`,copied:`Copied`,copyManual:`Press Ctrl+C`,qrLabel:`QR code for this page`,linkLabel:`Link to this page`,email:`Email`,panHint:`Drag to move`,pageAnnounce:(e,t)=>`Page ${e} of ${t}`,pageTotal:e=>`/ ${e}`,downloadingPercent:e=>`Downloading document… ${e}%`,downloadingSize:e=>`Downloading document… ${e.toFixed(1)} MB`,zoomHint:({doubleClick:e,wheel:t,mac:n})=>{let r=[];return e&&r.push(`Double-click`),t&&r.push(`${n?`⌘`:`Ctrl`}-scroll`),`${r.join(` or `)} to zoom`},noMatches:e=>`No matches for “${e}”`,searchHitLabel:e=>`Page ${e}`,searchHitAria:(e,t)=>`Page ${e}: ${t}`,shareOn:e=>`Share on ${e}`,thumbnailAria:e=>e.length>1?`Pages ${e[0]}–${e.at(-1)}`:`Page ${e[0]??``}`,outlineEntryAria:(e,t)=>`${e}, page ${t}`};function at(e){return e?{...it,...e}:it}var ot=r({detectOverlap:()=>ut,matchOverlap:()=>ct});function st(e){let t=new Float32Array(e.length/4);for(let n=0;n<t.length;n++)t[n]=(e[n*4]+e[n*4+1]+e[n*4+2])/3;return t}function ct(e,t,n,r){let i=st(e),a=st(t),o=new Float64Array(n+1).fill(1/0),s=0;for(let e=F;e<=n;e++){let t=0,c=0;for(let o=0;o<r;o++){let r=o*n;for(let o=0;o<e;o++){let s=i[r+n-e+o],l=a[r+o];(s<ft||l<ft)&&(t+=Math.abs(s-l),c++)}}c<Math.max(64,.02*e*r)||(o[e]=t/c,(s===0||o[e]<o[s])&&(s=e))}if(s===0||o[s]>pt)return 0;let c=Math.max(o[s]*mt,o[s]+ht),l=Math.max(2,Math.round(s/4)),u=[s-l,s+l].filter(e=>e>=F&&e<=n);return u.length===0||u.some(e=>o[e]<c)?0:s}function lt(e,t,n){let r=(typeof OffscreenCanvas<`u`?new OffscreenCanvas(n,P):Object.assign(document.createElement(`canvas`),{width:n,height:P})).getContext(`2d`,{willReadFrequently:!0});return r===null?null:(r.drawImage(e,t,0,n,e.height,0,0,n,P),r.getImageData(0,0,n,P).data)}function ut(e,t){if(e.width!==t.width||e.height!==t.height||e.width===0)return 0;let n=Math.max(F,Math.ceil(e.width*dt));try{let r=lt(e,e.width-n,n),i=lt(t,0,n);return r===null||i===null?0:ct(r,i,n,P)/e.width}catch{return 0}}var dt,P,F,ft,pt,mt,ht,gt=n((()=>{dt=.06,P=400,F=3,ft=235,pt=16,mt=2.5,ht=6})),_t,vt=n((()=>{_t=`data:audio/mpeg;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAA4AQAAHgAAAHACAAA8AAAMBkak0dlxzAYGoNHlcZMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//PkZAAAAAGkAAAAAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV`})),yt=r({FlipSound:()=>wt});function bt(){if(typeof window>`u`)return;let e=window;return e.AudioContext??e.webkitAudioContext}function xt(e){return e<0?0:e>1?1:e}function St(e){if(typeof atob!=`function`)return;let t=e.indexOf(`,`);if(t<0)return;let n=atob(e.slice(t+1)),r=new Uint8Array(n.length);for(let e=0;e<n.length;e++)r[e]=n.charCodeAt(e);return r.buffer}var Ct,wt,Tt=n((()=>{vt(),Ct=.5,wt=class{#e;#t=null;#n=null;#r=null;#i=null;#a;#o=!1;#s;constructor(e={}){this.#e=bt(),this.#a=xt(e.volume??Ct),this.#s=e.url}get available(){return this.#e!==void 0&&(!!this.#s||!0)}play(){if(this.#o||!this.available)return;let e=this.#c();e&&(e.state===`suspended`&&e.resume().catch(()=>{}),this.#l().then(()=>{if(!(!this.#t||!this.#r||!this.#n||this.#o))try{let e=this.#t.createBufferSource();e.buffer=this.#r,e.connect(this.#n),e.start()}catch{}}))}setMuted(e){this.#o=e,this.#n&&(this.#n.gain.value=e?0:this.#a)}isMuted(){return this.#o}destroy(){try{this.#t?.close()}catch{}this.#t=null,this.#n=null,this.#r=null}#c(){if(this.#t)return this.#t;if(!this.#e)return null;try{let e=new this.#e,t=e.createGain();t.gain.value=this.#o?0:this.#a,t.connect(e.destination),this.#t=e,this.#n=t}catch{this.#t=null}return this.#t}#l(){return this.#i||=this.#u().catch(()=>{}),this.#i}async#u(){let e=this.#c();if(!e)return;let t;t=this.#s?await(await fetch(this.#s)).arrayBuffer():St(_t),t&&(this.#r=await e.decodeAudioData(t.slice(0)))}}})),Et=r({CSS:()=>jt,mountLoading:()=>Ot});function Dt(e){if(e.getElementById(kt))return;let t=e.createElement(`style`);t.id=kt,t.textContent=jt,(e.head??e.documentElement)?.appendChild(t)}function Ot(e,t){let n=e.ownerDocument;Dt(n);let r=n.createElement(`div`);r.className=`zine-loading`,r.setAttribute(`role`,`status`),r.setAttribute(`aria-live`,`polite`);let i=n.createElement(`div`);i.className=`zine-loading-spinner`,i.setAttribute(`aria-hidden`,`true`);let a=n.createElement(`div`);a.className=`zine-loading-text`,a.textContent=t.loadingOpening;let o=n.createElement(`div`);o.className=`zine-loading-bar`,o.style.display=`none`;let s=n.createElement(`div`);s.className=`zine-loading-fill`,o.appendChild(s),r.append(i,a,o),e.appendChild(r);let c=null,l=typeof globalThis.getComputedStyle==`function`?globalThis.getComputedStyle(e):null;(!l||l.position===`static`||l.position===``)&&(c=e.style.position,e.style.position=`relative`);let u=!1,d=setTimeout(()=>{u=!0,r.classList.add(`zine-loading-shown`)},At);return{update(e){if(e.total>0){let n=Math.min(100,Math.round(e.loaded/e.total*100));a.textContent=t.downloadingPercent(n),o.style.display=``,s.style.width=`${n}%`}else a.textContent=t.downloadingSize(e.loaded/1024/1024),o.style.display=`none`},preparing(){a.textContent=t.loadingPreparing,o.style.display=`none`},destroy(){u||clearTimeout(d),r.remove(),c!==null&&(e.style.position=c)}}}var kt,At,jt,Mt=n((()=>{kt=`zine-loading-style`,At=150,jt=`
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
`}));function I(e,t){let n=e.createElementNS(`http://www.w3.org/2000/svg`,`svg`);return n.setAttribute(`viewBox`,`0 0 24 24`),n.setAttribute(`fill`,`none`),n.setAttribute(`stroke`,`currentColor`),n.setAttribute(`stroke-width`,`1.75`),n.setAttribute(`stroke-linecap`,`round`),n.setAttribute(`stroke-linejoin`,`round`),n.setAttribute(`aria-hidden`,`true`),n.setAttribute(`focusable`,`false`),n.innerHTML=t,n}var L,R=n((()=>{L={prev:`<path d="m15 18-6-6 6-6"/>`,next:`<path d="m9 18 6-6-6-6"/>`,first:`<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>`,last:`<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>`,zoomIn:`<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>`,zoomOut:`<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>`,search:`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,share:`<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>`,menu:`<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>`,fullscreen:`<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`,exitFullscreen:`<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>`,thumbnails:`<path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/>`,outline:`<path d="M21 12h-8"/><path d="M21 6h-8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>`,twoPages:`<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,onePage:`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h6"/>`,print:`<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14" rx="1"/>`,download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`,close:`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,soundOn:`<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l3.8 3.8a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 5.6a10 10 0 0 1 0 12.8"/>`,soundOff:`<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3l3.8 3.8a.7.7 0 0 0 1.2-.5z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>`}}));function z(e){return B.set(e.id,e),e}function Nt(e){return B.get(e)}function Pt(e){if(typeof e==`string`){let t=B.get(e);if(!t)throw Error(`controls: unknown control '${e}'. Register it with defineControl() or pass a definition object.`);return t}let t=B.get(e.id);return t?{...t,...e}:e}var B,V,H=n((()=>{B=new Map,V=[`prev`,`pageInput`,`next`,`|`,`zoomOut`,`zoomIn`,`search`,`share`,`menu`,`fullscreen`]})),U,Ft,It=n((()=>{U=encodeURIComponent,Ft=[{id:`facebook`,label:`Facebook`,icon:`<path fill="currentColor" stroke="none" d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/>`,href:e=>`https://www.facebook.com/sharer/sharer.php?u=${U(e)}`},{id:`x`,label:`X (Twitter)`,icon:`<path fill="currentColor" stroke="none" d="M17.53 3h3.06l-6.69 7.64L21.75 21h-6.16l-4.82-6.3L5.24 21H2.18l7.15-8.17L2.25 3h6.32l4.36 5.77L17.53 3Zm-1.07 16.17h1.69L7.62 4.73H5.8l10.66 14.44Z"/>`,href:(e,t)=>`https://twitter.com/intent/tweet?url=${U(e)}&text=${U(t)}`},{id:`linkedin`,label:`LinkedIn`,icon:`<path fill="currentColor" stroke="none" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/>`,href:e=>`https://www.linkedin.com/sharing/share-offsite/?url=${U(e)}`},{id:`whatsapp`,label:`WhatsApp`,icon:`<path fill="currentColor" stroke="none" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm5.8 14.06c-.25.7-1.44 1.33-1.99 1.38-.53.05-1.02.24-3.44-.72-2.9-1.14-4.73-4.1-4.87-4.29-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.26-.28.57-.35.76-.35h.55c.17 0 .42-.07.65.5.24.58.8 2 .87 2.14.07.14.12.31.02.5-.09.19-.14.3-.28.47l-.42.48c-.14.14-.28.29-.12.57.16.28.7 1.16 1.51 1.88 1.04.93 1.91 1.21 2.19 1.35.28.15.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.25.1 1.63.77 1.9.91.29.14.48.21.55.33.07.11.07.67-.18 1.37Z"/>`,href:(e,t)=>`https://api.whatsapp.com/send?text=${U(`${t} ${e}`)}`},{id:`pinterest`,label:`Pinterest`,icon:`<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.19-.78 1.2-4.98 1.2-4.98s-.3-.61-.3-1.52c0-1.42.82-2.48 1.85-2.48.87 0 1.3.66 1.3 1.44 0 .88-.56 2.2-.85 3.42-.24 1.02.51 1.86 1.52 1.86 1.83 0 3.23-1.93 3.23-4.7 0-2.46-1.77-4.18-4.29-4.18-2.92 0-4.64 2.19-4.64 4.46 0 .88.34 1.83.76 2.35a.3.3 0 0 1 .07.29l-.28 1.16c-.05.19-.15.23-.34.14-1.28-.6-2.08-2.47-2.08-3.98 0-3.24 2.35-6.21 6.79-6.21 3.56 0 6.33 2.54 6.33 5.93 0 3.54-2.23 6.39-5.32 6.39-1.04 0-2.02-.54-2.35-1.18l-.64 2.44c-.23.89-.86 2.01-1.28 2.69A10 10 0 1 0 12 2Z"/>`,href:(e,t)=>`https://pinterest.com/pin/create/button/?url=${U(e)}&description=${U(t)}`},{id:`email`,label:`Email`,icon:`<path fill="currentColor" stroke="none" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-7.47 4.67a1 1 0 0 1-1.06 0L4 8.24V6.4l8 5 8-5v1.84Z"/>`,href:(e,t)=>`mailto:?subject=${U(t)}&body=${U(e)}`}]}));function Lt(e){let t=new Uint8Array([1]);for(let n=0;n<e;n++){let e=new Uint8Array(t.length+1);for(let r=0;r<t.length;r++)e[r]=e[r]^t[r],e[r+1]=e[r+1]^qt(t[r],W[n]);t=e}return t}function Rt(e,t){let n=Lt(t),r=new Uint8Array(t);for(let i of e){let e=i^r[0];if(r.copyWithin(0,1),r[t-1]=0,e!==0)for(let i=0;i<t;i++)r[i]=r[i]^qt(n[i+1],e)}return r}function zt(e){let t=0|e,n=t;for(let e=0;e<10;e++)n=n<<1^(n>>>9)*1335;return(t<<10|n)^21522}function Bt(e,t,n){for(let r=-1;r<=7;r++)for(let i=-1;i<=7;i++){let a=t+i,o=n+r;if(a<0||o<0||a>=e.size||o>=e.size)continue;let s=Math.max(Math.abs(i-3),Math.abs(r-3));K(e,a,o,s!==2&&s<=3)}}function Vt(e){let t=new TextEncoder().encode(e),n=Ut.findIndex(e=>t.length+2<=e)+1;if(n===0)throw Error(`qr: ${t.length} bytes is too long for this encoder (max 214).`);let r=Ut[n-1],i=[],a=(e,t)=>{for(let n=t-1;n>=0;n--)i.push(e>>>n&1)};a(4,4),a(t.length,n<10?8:16);for(let e of t)a(e,8);for(a(0,Math.min(4,r*8-i.length));i.length%8;)i.push(0);let o=new Uint8Array(r);for(let e=0;e<i.length;e+=8){let t=0;for(let n=0;n<8;n++)t=t<<1|i[e+n];o[e/8]=t}for(let e=i.length/8,t=0;e<r;e++,t++)o[e]=t%2==0?236:17;let s=Gt[n-1],c=Wt[n-1],l=Math.floor(r/s),u=r%s,d=[],f=[];for(let e=0,t=0;e<s;e++){let n=l+ +(e>=s-u),r=o.subarray(t,t+n);t+=n,d.push(r),f.push(Rt(r,c))}let p=[];for(let e=0;e<l+1;e++)for(let t of d)e<t.length&&p.push(t[e]);for(let e=0;e<c;e++)for(let t of f)p.push(t[e]);let m=n*4+17,h={size:m,modules:new Uint8Array(m*m),reserved:new Uint8Array(m*m)};Bt(h,0,0),Bt(h,m-7,0),Bt(h,0,m-7);for(let e=8;e<m-8;e++){let t=e%2==0;K(h,e,6,t),K(h,6,e,t)}for(let e of Kt[n-1])for(let t of Kt[n-1])if(!(e<9&&t<9||e<9&&t>m-10||e>m-10&&t<9))for(let n=-2;n<=2;n++)for(let r=-2;r<=2;r++)K(h,e+r,t+n,Math.max(Math.abs(r),Math.abs(n))!==1);K(h,8,m-8,!0);for(let e=0;e<9;e++)e!==6&&(K(h,e,8,!1),K(h,8,e,!1));for(let e=0;e<8;e++)K(h,m-1-e,8,!1),K(h,8,m-1-e,!1);K(h,8,m-8,!0);let g=0,_=p.length*8;for(let e=m-1;e>=1;e-=2){e===6&&(e=5);for(let t=0;t<m;t++)for(let n=0;n<2;n++){let r=e-n,i=e+1&2?t:m-1-t;if(h.reserved[i*m+r])continue;let a=!1;g<_&&(a=(p[g>>>3]>>>7-(g&7)&1)==1,g++),(r+i)%2==0&&(a=!a),K(h,r,i,a,!1)}}let v=zt(0);for(let e=0;e<15;e++){let t=(v>>>e&1)==1,n=e<6?e:e<8?e+1:8,r=e<8?8:e<9?7:14-e;K(h,n,8,t),K(h,8,r,t),e<8?K(h,m-1-e,8,t):K(h,8,m-15+e,t)}return K(h,8,m-8,!0),{size:m,modules:h.modules}}function Ht(e,t){let{size:n,modules:r}=Vt(e),i=``;for(let e=0;e<n;e++)for(let t=0;t<n;t++)r[e*n+t]&&(i+=`M${t} ${e}h1v1h-1z`);let a=n+4;return`<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${a} ${a}" shape-rendering="crispEdges"><rect width="${a}" height="${a}" fill="#fff"/><g transform="translate(2 2)" fill="#000">${`<path d="${i}"/>`}</g></svg>`}var Ut,Wt,Gt,Kt,W,G,qt,K,Jt=n((()=>{Ut=[16,28,44,64,86,108,124,154,182,216],Wt=[10,16,26,18,24,16,18,22,22,26],Gt=[1,1,1,2,2,4,4,4,5,5],Kt=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]],W=new Uint8Array(512),G=new Uint8Array(256);for(let e=0,t=1;e<255;e++)W[e]=t,G[t]=e,t<<=1,t&256&&(t^=285);for(let e=255;e<512;e++)W[e]=W[e-255];qt=(e,t)=>e===0||t===0?0:W[(G[e]+G[t])%255],K=(e,t,n,r,i=!0)=>{e.modules[n*e.size+t]=+!!r,i&&(e.reserved[n*e.size+t]=1)}}));function Yt(e){if(e.getElementById(Xt))return;let t=e.createElement(`style`);t.id=Xt,t.textContent=Zt,(e.head??e.documentElement)?.appendChild(t)}function q(e,t){t!==`auto`&&(e.style.colorScheme=t)}var Xt,Zt,J=n((()=>{Xt=`zine-controls-style`,Zt=`
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
`})),Qt=r({ShareDialog:()=>tn}),$t,en,tn,nn=n((()=>{R(),It(),Jt(),J(),$t=132,en=1600,tn=class{#e;#t;#n;#r;#i=null;#a;#o;constructor(e,t,n=`auto`){let r=t.ownerDocument;this.#e=r,this.#r=r.activeElement,this.#o=e.strings;let i=e.pageLink(),a=r.title||this.#o.shareFallbackTitle;this.#t=r.createElement(`div`),this.#t.className=`zine-share-backdrop`,q(this.#t,n),this.#t.addEventListener(`pointerdown`,e=>{e.target===this.#t&&this.close()}),this.#n=r.createElement(`div`),this.#n.className=`zine-share`,this.#n.setAttribute(`role`,`dialog`),this.#n.setAttribute(`aria-modal`,`true`),this.#n.setAttribute(`aria-label`,this.#o.share),this.#t.appendChild(this.#n);let o=r.createElement(`div`);o.className=`zine-share-head`;let s=r.createElement(`strong`);s.textContent=this.#o.share;let c=r.createElement(`button`);c.type=`button`,c.className=`zine-share-close`,c.setAttribute(`aria-label`,this.#o.close),c.appendChild(I(r,L.close)),c.addEventListener(`click`,()=>this.close()),o.append(s,c),this.#n.append(o,this.#c(r,i),this.#u(r,i,a));let l=this.#s(r,i);l&&this.#n.insertBefore(l,this.#n.children[1]),t.ownerDocument.body.appendChild(this.#t),this.#a=e=>{e.key===`Escape`&&this.close(),e.key===`Tab`&&this.#d(e)},this.#t.addEventListener(`keydown`,this.#a),c.focus()}#s(e,t){if(!t)return null;try{let n=e.createElement(`div`);return n.className=`zine-share-qr`,n.innerHTML=Ht(t,$t),n.setAttribute(`aria-label`,this.#o.qrLabel),n.setAttribute(`role`,`img`),n}catch{return null}}#c(e,t){let n=e.createElement(`div`);n.className=`zine-share-link`;let r=e.createElement(`input`);r.type=`text`,r.readOnly=!0,r.value=t,r.setAttribute(`aria-label`,this.#o.linkLabel),r.addEventListener(`focus`,()=>r.select());let i=e.createElement(`button`);return i.type=`button`,i.className=`zine-share-copy`,i.textContent=this.#o.copy,i.addEventListener(`click`,()=>{this.#l(t,i)}),n.append(r,i),n}async#l(e,t){try{await navigator.clipboard?.writeText(e),t.textContent=this.#o.copied}catch{t.textContent=this.#o.copyManual}this.#i&&clearTimeout(this.#i),this.#i=setTimeout(()=>{t.textContent=this.#o.copy},en)}#u(e,t,n){let r=e.createElement(`div`);r.className=`zine-share-socials`;for(let i of Ft){let a=e.createElement(`a`);a.className=`zine-share-social`,a.href=i.href(t,n);let o=i.id===`email`?this.#o.email:i.label;a.title=o,a.setAttribute(`aria-label`,this.#o.shareOn(o)),i.id!==`email`&&(a.target=`_blank`,a.rel=`noopener noreferrer`),a.appendChild(I(e,i.icon)),r.appendChild(a)}return r}#d(e){let t=[...this.#n.querySelectorAll(`button, a[href], input`)].filter(e=>!e.hasAttribute(`disabled`));if(t.length===0)return;let n=t[0],r=t.at(-1),i=this.#e.activeElement;e.shiftKey&&i===n?(r.focus(),e.preventDefault()):!e.shiftKey&&i===r&&(n.focus(),e.preventDefault())}close(){this.destroy()}destroy(){this.#i&&clearTimeout(this.#i),this.#i=null,this.#t.removeEventListener(`keydown`,this.#a),this.#t.remove(),this.#r?.focus?.()}}}));function rn(){z({id:`prev`,title:e=>e.strings.prevPage,icon:L.prev,isDisabled:e=>!e.zine.canFlipPrev(),action:e=>e.zine.flipPrev()}),z({id:`next`,title:e=>e.strings.nextPage,icon:L.next,isDisabled:e=>!e.zine.canFlipNext(),action:e=>e.zine.flipNext()});let e=e=>e.zine.getDirection()===`rtl`;z({id:`first`,title:e=>e.strings.firstPage,icon:t=>e(t)?L.last:L.first,isDisabled:e=>!e.zine.canFlipPrev(),action:e=>{e.zine.flipTo(0),e.close()}}),z({id:`last`,title:e=>e.strings.lastPage,icon:t=>e(t)?L.first:L.last,isDisabled:e=>!e.zine.canFlipNext(),action:e=>{e.zine.flipTo(e.zine.getPageCount()-1),e.close()}}),z({id:`zoomIn`,title:e=>e.strings.zoomIn,icon:L.zoomIn,isDisabled:e=>e.zine.getZoom()>=e.zine.getMaxZoom()-1e-6,action:e=>e.zine.setZoom(e.zine.getZoom()*an)}),z({id:`zoomOut`,title:e=>e.strings.zoomOut,icon:L.zoomOut,isDisabled:e=>e.zine.getZoom()<=1.000001,action:e=>e.zine.setZoom(e.zine.getZoom()/an)}),z({id:`fullscreen`,title:e=>e.strings.fullscreen,icon:L.fullscreen,isVisible:e=>typeof e.zine.container.requestFullscreen==`function`,isActive:on,action:e=>{let t=e.zine.container.ownerDocument;on(e)?t?.exitFullscreen?.():e.zine.container.requestFullscreen?.(),e.close()}}),z({id:`mute`,title:e=>e.zine.isSoundMuted()?e.strings.unmute:e.strings.mute,icon:e=>e.zine.isSoundMuted()?L.soundOff:L.soundOn,isVisible:e=>e.zine.isSoundEnabled(),isActive:e=>e.zine.isSoundMuted(),action:e=>e.zine.setSoundMuted(!e.zine.isSoundMuted())}),z({id:`share`,title:e=>e.strings.share,icon:L.share,action:e=>{e.close(),Promise.resolve().then(()=>(nn(),Qt)).then(({ShareDialog:t})=>new t(e.zine,e.zine.container,e.colorScheme)).catch(()=>{navigator.clipboard?.writeText(e.zine.pageLink()).catch(()=>{})})}}),z({id:`download`,title:e=>e.strings.downloadPdf,icon:L.download,isVisible:e=>e.zine.canDownload(),action:async e=>{await e.zine.download(),e.close()}}),z({id:`spread`,title:e=>e.zine.isSinglePage()?e.strings.showTwoPages:e.strings.showOnePage,icon:e=>e.zine.isSinglePage()?L.twoPages:L.onePage,isVisible:e=>!e.zine.isResponsiveSingle(),action:e=>{e.zine.toggleSpreadMode(),e.close()}}),z({id:`print`,title:e=>e.strings.print,icon:L.print,isVisible:e=>e.zine.canPrint(),action:async e=>{await e.zine.print(),e.close()}}),z({id:`menu`,title:e=>e.strings.more,icon:L.menu,children:[`first`,`last`,`spread`,`thumbnails`,`outline`,`mute`,`print`,`download`]})}var an,on,sn=n((()=>{R(),H(),an=Math.SQRT2,on=e=>e.zine.container.ownerDocument?.fullscreenElement===e.zine.container}));function cn(e){return e===`|`?null:typeof e==`string`?e:e.id}function ln(e,t){return t.size?e.filter(e=>{let n=cn(e);return n===null||!t.has(n)}):e}function un(e,t){return typeof e.title==`function`?e.title(t):e.title}function dn(e,t){return typeof e.icon==`function`?e.icon(t):e.icon}function fn(e){return e instanceof HTMLButtonElement||e instanceof HTMLInputElement?[e]:[...e.querySelectorAll(`button, input`)]}function pn(e,t){e.classList.toggle(`zine-controls-busy`,t),e.setAttribute(`aria-busy`,String(t)),e.disabled=t}function mn(e,t,n,r){if(e.isDisabled?.(n)||t.classList.contains(`zine-controls-busy`))return;let i=e.action?.(n);i&&typeof i.then==`function`&&(pn(t,!0),i.finally(()=>{pn(t,!1),r()})),r()}function hn(e,t,n,r,i,a=!1){let o=e.createElement(`button`),s=un(t,r),c=dn(t,r);if(o.type=`button`,o.className=n,o.title=s,o.setAttribute(`aria-label`,s),c&&o.appendChild(I(e,c)),a||!c){let t=e.createElement(`span`);t.className=`zine-controls-label`,t.textContent=s,o.appendChild(t)}return o.addEventListener(`click`,()=>i(t,o)),o}function gn(e,t,n,r,i){let a=i??t.isVisible?.(n);a!==void 0&&(e.style.display=a?``:`none`);let o=e.classList.contains(`zine-controls-busy`),s=(t.isDisabled?.(n)??!1)||o,c=fn(e);for(let e of c)e.disabled=s;if(c.length||e.setAttribute(`aria-disabled`,String(s)),e.classList.toggle(`zine-controls-off`,s),t.isActive&&e.setAttribute(`aria-pressed`,String(t.isActive(n))),typeof t.title==`function`){let r=t.title(n);e.title=r,e.setAttribute(`aria-label`,r);let i=e.querySelector(`.zine-controls-label`);i&&(i.textContent=r)}typeof t.icon==`function`&&e.querySelector(`svg`)?.replaceWith(I(r,t.icon(n)))}function _n(e,t,n=vn){return e.isVisible&&!e.isVisible(t)?!1:ln(e.children??[],n).some(e=>{if(e===`|`)return!1;let n=Pt(e);return!n.isVisible||n.isVisible(t)})}var vn,yn,bn=n((()=>{R(),H(),vn=new Set,yn=class{el;#e;#t;#n;#r;#i=[];constructor(e,t,n,r=vn){this.#e=e,this.#t=t,this.#n=n,this.#r=r,this.el=e.createElement(`div`),this.el.className=`zine-controls-menu`,this.el.setAttribute(`role`,`menu`)}build(e){this.el.replaceChildren(),this.#i=[];let t=this.#t();for(let n of ln(e,this.#r)){if(n===`|`)continue;let e=Pt(n);if(e.isVisible&&!e.isVisible(t))continue;let r;r=e.render?e.render(this.#t()):hn(this.#e,e,`zine-controls-btn`,t,(e,t)=>mn(e,t,this.#t(),this.#n),!0),r.setAttribute(`role`,`menuitem`),this.el.appendChild(r),this.#i.push({el:r,def:e})}}refresh(){let e=this.#t();for(let{el:t,def:n}of this.#i)gn(t,n,e,this.#e)}contains(e){return e!==null&&this.el.contains(e)}focusFirst(){this.el.querySelector(`button`)?.focus()}destroy(){this.el.remove(),this.#i=[]}}})),Y,xn=n((()=>{R(),Y=class{root;#e;#t=null;#n=null;#r=null;#i=null;#a;#o=null;#s=null;constructor(e,t,n){this.#a=e,this.#e=e.createElement(`div`),this.#e.className=`zine-panel-holder`,this.#e.style.width=`${n.width}px`,this.#o=n.pageBox??null,this.root=e.createElement(`div`),this.root.className=`zine-panel ${n.className}`,this.root.setAttribute(`role`,`listbox`),this.root.setAttribute(`aria-label`,n.label),this.#e.appendChild(this.root);for(let e of[`pointerdown`,`pointerup`,`pointermove`,`click`,`dblclick`,`wheel`])this.root.addEventListener(e,e=>e.stopPropagation());this.#u(e,t,n.rtl??!1,n.overlay??!1),n.onDismiss&&this.#d(e,n.onDismiss,n.closeLabel??`Close`),this.#c(t)}#c(e){this.#o&&(this.#l(),!(typeof ResizeObserver>`u`)&&(this.#s=new ResizeObserver(()=>this.#l()),this.#s.observe(e)))}#l(){let e=this.#o?.();e&&(this.#e.style.top=`${e.y}px`,this.#e.style.bottom=`auto`,this.#e.style.height=`${e.height}px`)}setWidth(e){this.#e.style.width=`${e}px`}#u(e,t,n,r){if(!t.parentNode){this.#e.classList.add(`zine-panel-overlay`),t.appendChild(this.#e);return}let i=t.closest(`.zine-controls-wrap`)??t,a=e.createElement(`div`);a.className=`zine-panel-wrap`,n&&a.classList.add(`zine-panel-wrap-rtl`),r&&a.classList.add(`zine-panel-wrap-overlay`),i.parentNode.insertBefore(a,i),a.append(this.#e,i),this.#t=a}#d(e,t,n){let r=e.createElement(`button`);if(r.type=`button`,r.className=`zine-panel-close`,r.setAttribute(`aria-label`,n),r.appendChild(I(e,L.close)),r.addEventListener(`click`,e=>{e.stopPropagation(),t()}),this.#e.appendChild(r),this.#r=r,this.#t){let n=e.createElement(`div`);n.className=`zine-panel-scrim`,this.#t.insertBefore(n,this.#e);for(let e of[`pointerdown`,`click`])n.addEventListener(e,e=>{e.stopPropagation(),t()});this.#n=n}this.#i=e=>{e.key===`Escape`&&t()},e.addEventListener(`keydown`,this.#i)}destroy(){this.#s?.disconnect(),this.#s=null,this.#i&&=(this.#a.removeEventListener(`keydown`,this.#i),null),this.#n?.remove(),this.#n=null,this.#r=null,this.#e.remove();let e=this.#t;if(e?.parentNode){for(;e.firstChild;)e.parentNode.insertBefore(e.firstChild,e);e.remove()}this.#t=null}}})),Sn,Cn,wn=n((()=>{xn(),Sn=78,Cn=class{root;#e;#t;#n;#r=[];#i=null;#a=[];constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#n=new Y(r,t,{className:`zine-thumbs`,label:e.strings.thumbnailsLabel,closeLabel:e.strings.close,width:90,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#o(),this.#a.push(e.on(`pageChanged`,()=>this.#l())),this.#l()}#o(){let e=this.#e.getSpreads(),t=this.#e.getDirection()===`rtl`,n=e.some(e=>e.left!==null&&e.right!==null);this.#n.root.classList.toggle(`zine-thumbs-solo`,!n),n&&this.#n.setWidth(170);for(let[r,i]of e.entries()){let e=this.#t.createElement(`button`);e.type=`button`,e.className=`zine-thumbs-row`,e.setAttribute(`role`,`option`),t&&(e.style.flexDirection=`row-reverse`);let a=[i.left,i.right].filter(e=>e!==null);n&&a.length===1&&e.classList.add(`zine-thumbs-row-lone`);for(let t of a){let n=this.#t.createElement(`span`);n.className=`zine-thumbs-cell`,n.dataset.page=String(t),e.appendChild(n)}let o=[...a].sort((e,t)=>e-t).map(e=>e+1);e.setAttribute(`aria-label`,this.#e.strings.thumbnailAria(o.map(String)));let s=this.#t.createElement(`span`);s.className=`zine-thumbs-caption`,s.textContent=o.join(`–`),e.appendChild(s),e.addEventListener(`click`,()=>{a.length>0&&this.#e.flipTo(Math.min(...a))}),this.#n.root.appendChild(e),this.#r.push({el:e,spread:r,pages:a})}this.#s()}#s(){let e=[...this.#n.root.querySelectorAll(`.zine-thumbs-cell[data-page]`)];if(typeof IntersectionObserver>`u`){for(let t of e)this.#c(t);return}this.#i=new IntersectionObserver((e,t)=>{for(let n of e)n.isIntersecting&&(t.unobserve(n.target),this.#c(n.target))},{root:this.#n.root,rootMargin:`200px`});for(let t of e)this.#i.observe(t)}async#c(e){let t=Number(e.dataset.page),n=await this.#e.getPageImage(t);if(!n||!e.isConnected)return;let r=n.width,i=n.height;if(!r||!i)return;let a=Math.min(2,globalThis.devicePixelRatio||1),o=this.#t.createElement(`canvas`);o.width=Math.max(1,Math.round(Sn*a)),o.height=Math.max(1,Math.round(Sn*i/r*a)),o.className=`zine-thumbs-img`;let s=o.getContext(`2d`);if(s){try{s.drawImage(n,0,0,o.width,o.height)}catch{return}e.replaceChildren(o)}}#l(){let e=this.#e.getPage();for(let{el:t,pages:n}of this.#r){let r=n.includes(e);t.classList.toggle(`zine-panel-active`,r),t.setAttribute(`aria-selected`,String(r)),r&&t.scrollIntoView?.({block:`nearest`})}}destroy(){for(let e of this.#a)e();this.#a=[],this.#i?.disconnect(),this.#i=null,this.#n.destroy()}}})),Tn,En,Dn,On=n((()=>{xn(),Tn=208,En=12,Dn=class{root;#e;#t;#n;#r=[];#i=[];#a;constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#a=n.onDismiss,this.#n=new Y(r,t,{className:`zine-outline`,label:e.strings.outlineLabel,closeLabel:e.strings.close,width:Tn,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,overlay:!0,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#o(e.strings.outlineLoading),this.#s(),this.#i.push(e.on(`pageChanged`,()=>this.#l()))}#o(e){let t=this.#t.createElement(`div`);t.className=`zine-panel-note`,t.textContent=e,this.#n.root.replaceChildren(t)}async#s(){let e=await this.#e.getOutline();if(this.#n.root.isConnected){if(e.length===0){this.#o(this.#e.strings.outlineEmpty);return}this.#n.root.replaceChildren(),this.#c(e,0),this.#l()}}#c(e,t){for(let n of e){let e=this.#t.createElement(`button`);e.type=`button`,e.className=`zine-outline-row`,e.setAttribute(`role`,`option`),e.style.paddingLeft=`${8+t*En}px`;let r=n.title.trim()||this.#e.strings.untitled;if(e.textContent=r,e.title=r,n.page===null)e.disabled=!0;else{let t=n.page;e.setAttribute(`aria-label`,this.#e.strings.outlineEntryAria(r,t+1)),e.addEventListener(`click`,()=>{this.#e.flipTo(t),this.#a?.()}),this.#r.push({el:e,page:t})}this.#n.root.appendChild(e),n.children.length>0&&this.#c(n.children,t+1)}}#l(){let e=this.#e.getPage(),t=null,n=-1;for(let{el:r,page:i}of this.#r)r.classList.remove(`zine-panel-active`),r.removeAttribute(`aria-selected`),i<=e&&i>=n&&(t=r,n=i);t&&(t.classList.add(`zine-panel-active`),t.setAttribute(`aria-selected`,`true`),t.scrollIntoView?.({block:`nearest`}))}destroy(){for(let e of this.#i)e();this.#i=[],this.#n.destroy()}}})),kn,An,jn,Mn,Nn=n((()=>{xn(),kn=208,An=180,jn=2,Mn=class{root;#e;#t;#n;#r;#i;#a=0;#o=null;#s;#c=[];constructor(e,t,n={}){this.#e=e;let r=t.ownerDocument;this.#t=r,this.#s=n.onDismiss,this.#n=new Y(r,t,{className:`zine-search`,label:e.strings.searchResultsLabel,closeLabel:e.strings.close,width:kn,onDismiss:n.onDismiss,rtl:e.getDirection()===`rtl`,overlay:!0,pageBox:()=>e.getPageBox()}),this.root=this.#n.root,this.#r=r.createElement(`input`),this.#r.type=`search`,this.#r.className=`zine-search-input`,this.#r.placeholder=e.strings.searchPlaceholder,this.#r.setAttribute(`aria-label`,e.strings.searchInputLabel),this.#r.addEventListener(`input`,()=>{this.#o&&clearTimeout(this.#o),this.#o=setTimeout(()=>void this.#u(),An)}),this.#r.addEventListener(`keydown`,e=>{e.key===`Enter`&&(this.#o&&clearTimeout(this.#o),this.#u())}),this.#i=r.createElement(`div`),this.#i.className=`zine-search-hits`,this.#n.root.append(this.#r,this.#i);let i=n.state;i&&i.query&&(this.#r.value=i.query,this.#a++,this.#d(i.query,i.results)),this.#r.focus()}getState(){return{query:this.#r.value,results:this.#c}}#l(e){let t=this.#t.createElement(`div`);t.className=`zine-panel-note`,t.textContent=e,this.#i.replaceChildren(t)}async#u(){let e=this.#r.value.trim(),t=++this.#a;if(e.length<jn){this.#c=[],this.#i.replaceChildren();return}this.#l(this.#e.strings.searching);let n=await this.#e.search(e);t!==this.#a||!this.#n.root.isConnected||this.#d(e,n)}#d(e,t){if(this.#c=t,t.length===0){this.#l(this.#e.strings.noMatches(e));return}this.#i.replaceChildren(...t.map(e=>{let t=this.#t.createElement(`button`);t.type=`button`,t.className=`zine-search-hit`,t.setAttribute(`role`,`option`),t.setAttribute(`aria-label`,this.#e.strings.searchHitAria(e.page+1,e.excerpt));let n=this.#t.createElement(`span`);n.className=`zine-search-page`,n.textContent=this.#e.strings.searchHitLabel(e.page+1);let r=this.#t.createElement(`small`);return r.textContent=e.excerpt,t.append(n,r),t.addEventListener(`click`,()=>{this.#e.flipTo(e.page),this.#s?.()}),t}))}destroy(){this.#o&&clearTimeout(this.#o),this.#o=null,this.#a++,this.#n.destroy()}}})),Pn,Fn=n((()=>{R(),J(),Pn=class{#e;#t;#n;#r=null;#i;#a=[];constructor(e,t,n=`auto`,r=null){this.#e=e,this.#i=r;let i=t.ownerDocument,a=e.getDirection()===`rtl`;if(this.#t=this.#o(i,a?L.next:L.prev,e.strings.prevPage,()=>e.flipPrev()),this.#n=this.#o(i,a?L.prev:L.next,e.strings.nextPage,()=>e.flipNext()),this.#s(i,t),this.#r)q(this.#r,n);else for(let e of[this.#t,this.#n])q(e,n);this.#a.push(e.on(`pageChanged`,({page:e})=>this.#c(e))),this.#a.push(e.on(`flipEnd`,()=>this.#c())),this.#c()}#o(e,t,n,r){let i=e.createElement(`button`);i.type=`button`,i.className=`zine-arrow`,i.title=n,i.setAttribute(`aria-label`,n),i.appendChild(I(e,t)),i.addEventListener(`click`,r);for(let e of[`pointerdown`,`pointerup`,`click`])i.addEventListener(e,e=>e.stopPropagation());return i}#s(e,t){let n=t.closest(`.zine-panel-wrap`)??t.closest(`.zine-controls-wrap`)??t,r=n.parentNode;if(!r)return;let i=e.createElement(`div`);i.className=`zine-arrows-wrap`,this.#i&&i.classList.add(`zine-arrows-${this.#i}`),r.insertBefore(i,n),i.append(this.#t,n,this.#n),this.#r=i}#c(e){let{prev:t,next:n}=this.#l(e);for(let[e,r]of[[this.#t,t],[this.#n,n]])e.disabled=!r,e.classList.toggle(`zine-arrow-hidden`,!r)}#l(e){if(e!==void 0){let t=this.#e.getSpreads(),n=t.findIndex(t=>t.left===e||t.right===e);if(n>=0)return{prev:n>0,next:n+1<t.length}}return{prev:this.#e.canFlipPrev(),next:this.#e.canFlipNext()}}destroy(){for(let e of this.#a)e();this.#a=[],this.#t.remove(),this.#n.remove();let e=this.#r;if(e?.parentNode){for(;e.firstChild;)e.parentNode.insertBefore(e.firstChild,e);e.remove()}this.#r=null}}}));function In(e){let t=[];for(let n of e)n===`|`&&(t.length===0||t[t.length-1]===`|`)||t.push(n);return t[t.length-1]===`|`&&t.pop(),t}function Ln(e){rn(),z({id:`thumbnails`,title:t=>e.openPanel()===`thumbnails`?t.strings.hideThumbnails:t.strings.showThumbnails,icon:L.thumbnails,isVisible:e=>e.zine.isDocument(),isActive:()=>e.openPanel()===`thumbnails`,action:t=>{e.togglePanel(`thumbnails`),t.close()}}),z({id:`outline`,title:t=>e.openPanel()===`outline`?t.strings.hideOutline:t.strings.showOutline,icon:L.outline,isVisible:()=>e.hasOutline(),isActive:()=>e.openPanel()===`outline`,action:t=>{e.togglePanel(`outline`),t.close()}}),z({id:`pageInput`,title:e=>e.strings.pageWidgetLabel,render:()=>e.makePageInput()}),z({id:`search`,title:t=>e.openPanel()===`search`?t.strings.searchClose:t.strings.searchOpen,icon:L.search,isVisible:e=>e.zine.canSearch(),isActive:()=>e.openPanel()===`search`,action:()=>e.togglePanel(`search`)})}var Rn,zn,Bn,Vn=n((()=>{R(),H(),sn(),bn(),J(),wn(),On(),Nn(),Fn(),Rn={thumbnails:Cn,outline:Dn,search:Mn},zn=[`pointerdown`,`pointerup`,`pointermove`,`click`,`dblclick`,`wheel`,`keydown`],Bn=class{#e;#t;#n;#r;#i=[];#a=null;#o=[];#s=null;#c=null;#l;#u=null;#d=null;#f=null;#p=null;#m=null;#h;#g;#_;constructor(e,t,n,r=new Set){this.#e=e,this.#l=t,this.#_=r;let i=t.ownerDocument;this.#t=i,Yt(i),this.#h=n.colorScheme??`auto`;let a=n.position??`bottom`;this.#g=a;let o=n.docked??!0;this.#n=i.createElement(`div`),this.#n.className=[`zine-controls`,`zine-controls-${a}`,o?`zine-controls-docked`:`zine-controls-floating`,n.className].filter(Boolean).join(` `),this.#n.setAttribute(`role`,`toolbar`),this.#n.setAttribute(`aria-label`,this.#e.strings.controlsLabel),q(this.#n,this.#h),this.#r=i.createElement(`div`),this.#r.className=`zine-controls-bar`,this.#n.appendChild(this.#r),this.#n.addEventListener(`keydown`,e=>this.#E(e));for(let e of zn)this.#n.addEventListener(e,e=>this.#y(e));this.#v(t,a,o);let s=()=>this.#D();this.#o.push(e.on(`pageChanged`,s)),this.#o.push(e.on(`zoomChanged`,s)),this.#o.push(e.on(`flipEnd`,s));let c=e=>{if(!this.#a)return;let t=e.target;this.#a.menu.contains(t)||this.#a.trigger.contains(t)||this.#T()};i.addEventListener(`pointerdown`,c,!0),this.#o.push(()=>i.removeEventListener(`pointerdown`,c,!0))}#v(e,t,n){if(!n){e.appendChild(this.#n);return}let r=e.parentNode;if(!r){this.#n.classList.replace(`zine-controls-docked`,`zine-controls-floating`),e.appendChild(this.#n);return}let i=this.#t.createElement(`div`);i.className=`zine-controls-wrap zine-controls-wrap-${t}`,r.insertBefore(i,e),i.appendChild(e),t===`top`||t===`left`?i.insertBefore(this.#n,e):i.appendChild(this.#n),this.#c=i}mount(e){this.#x(e.items??V);let t=e.arrows??!0;t!==!1&&(this.#m=new Pn(this.#e,this.#l,this.#h,t===!0?null:t)),this.#D(),this.#O()}destroy(){for(let e of this.#o)e();this.#o=[],this.#T(),this.#u?.destroy(),this.#u=null,this.#d=null,this.#n.remove();let e=this.#c;e?.parentNode&&(e.parentNode.insertBefore(e.firstChild,e),e.remove()),this.#c=null,this.#m?.destroy(),this.#m=null}#y(e){e.stopPropagation()}#b(e=()=>this.#T()){return{zine:this.#e,close:e,colorScheme:this.#h,strings:this.#e.strings}}#x(e){for(let t of In(ln(e,this.#_))){if(t===`|`){let e=this.#t.createElement(`div`);e.className=`zine-controls-sep`,this.#r.appendChild(e);continue}let e=Pt(t),n;n=e.render?e.render(this.#b()):hn(this.#t,e,`zine-controls-btn`,this.#b(),(e,t)=>this.#S(e,t)),this.#i.push({el:n,def:e}),this.#r.appendChild(n)}}#S(e,t){if(!e.isDisabled?.(this.#b())){if(e.children){this.#a?.trigger===t?this.#T():this.#C(e,t);return}mn(e,t,this.#b(),()=>this.#D())}}#C(e,t){this.#T();let n=new yn(this.#t,()=>this.#b(),()=>this.#D(),this.#_);n.build(e.children??[]),this.#n.appendChild(n.el),this.#a={menu:n,trigger:t},t.setAttribute(`aria-expanded`,`true`),this.#w(n.el,t),n.refresh(),n.focusFirst()}#w(e,t){let n=this.#n.getBoundingClientRect(),r=t.getBoundingClientRect(),i=e.getBoundingClientRect();if(!n.width||!i.width)return;let a=r.left-n.left+r.width/2-i.width/2;a=Math.max(4,Math.min(a,n.width-i.width-4)),e.style.left=`${a}px`;let o=r.bottom-n.top+6,s=r.top-n.top-i.height-6;e.style.top=`${this.#g===`bottom`||s>=0?s:o}px`}#T(){if(!this.#a)return;let{menu:e,trigger:t}=this.#a;this.#a=null,t.removeAttribute(`aria-expanded`);let n=this.#t.activeElement!==null&&e.contains(this.#t.activeElement);e.destroy(),n&&t.focus()}#E(e){if(e.key===`Escape`&&this.#a){let{trigger:t}=this.#a;this.#T(),t.focus(),e.preventDefault();return}let t=[...this.#n.querySelectorAll(`button, input`)],n=t.indexOf(this.#t.activeElement);if(n<0||this.#t.activeElement instanceof HTMLInputElement)return;let r=e.key===`ArrowRight`||e.key===`ArrowDown`?1:e.key===`ArrowLeft`||e.key===`ArrowUp`?-1:0;r!==0&&(t[(n+r+t.length)%t.length]?.focus(),e.preventDefault())}#D(){let e=this.#b();for(let{el:t,def:n}of this.#i){let r=n.children?_n(n,e,this.#_):n.isVisible?.(e);gn(t,n,e,this.#t,r)}this.#a?.menu.refresh(),this.#s&&this.#t.activeElement!==this.#s&&(this.#s.value=String(this.#e.getPage()+1))}makePageInput(){let e=this.#t.createElement(`div`);e.className=`zine-controls-page`;let t=this.#t.createElement(`input`);t.type=`number`,t.min=`1`,t.max=String(this.#e.getPageCount()),t.value=String(this.#e.getPage()+1),t.setAttribute(`aria-label`,this.#e.strings.pageNumberLabel);let n=this.#t.createElement(`span`);n.textContent=this.#e.strings.pageTotal(this.#e.getPageCount());let r=!1,i=()=>{if(r)return;r=!0;let e=Number(t.value),n=Math.max(0,this.#e.getPageCount()-1),i=Number.isFinite(e)?Math.min(Math.max(Math.round(e)-1,0),n):this.#e.getPage();i===this.#e.getPage()?t.value=String(this.#e.getPage()+1):this.#e.flipTo(i)};return t.addEventListener(`focus`,()=>{r=!1}),t.addEventListener(`keydown`,e=>{e.key===`Enter`&&(i(),t.blur())}),t.addEventListener(`blur`,i),e.append(t,n),this.#s=t,e}openPanel(){return this.#d}hasOutline(){return this.#p===!0}#O(){this.#p!==null||!this.#e.canOutline()||(this.#p=!1,this.#e.getOutline().then(e=>{if(e.length===0)return;this.#p=!0,this.#D();let t=this.#a;if(t){let e=this.#i.find(e=>e.el===t.trigger)?.def;this.#T(),e&&this.#C(e,t.trigger)}}))}togglePanel(e){let t=this.#d;this.#u instanceof Mn&&(this.#f=this.#u.getState()),this.#u?.destroy(),this.#u=null,this.#d=null,t!==e&&(this.#u=new Rn[e](this.#e,this.#l,{onDismiss:()=>this.togglePanel(e),...e===`search`&&this.#f?{state:this.#f}:{}}),q(this.#u.root,this.#h),this.#d=e),this.#D()}}})),Hn,Un,Wn,Gn=n((()=>{H(),sn(),bn(),J(),Hn=[`zoomIn`,`zoomOut`,`|`,`prev`,`next`,`|`,`fullscreen`,`mute`,`|`,`print`,`download`,`share`],Un=new Set([`pageInput`,`thumbnails`,`outline`,`search`]),Wn=class{#e;#t;#n;#r;#i;#a;#o=null;#s=[];constructor(e,t,n={},r=new Set){this.#e=e,this.#t=t,this.#a=r,this.#n=t.ownerDocument,rn(),Yt(this.#n),this.#i=n.colorScheme??`auto`,this.#r=(n.items??Hn).filter(e=>typeof e!=`string`||!Un.has(e)||Nt(e)!==void 0);let i=e=>{e.preventDefault(),this.#l(e.clientX,e.clientY)};this.#t.addEventListener(`contextmenu`,i),this.#s.push(()=>this.#t.removeEventListener(`contextmenu`,i));let a=e=>{this.#o&&!this.#o.contains(e.target)&&this.#d()},o=e=>{e.key===`Escape`&&this.#o&&(this.#d(),e.preventDefault())};this.#n.addEventListener(`pointerdown`,a,!0),this.#n.addEventListener(`keydown`,o,!0),this.#s.push(()=>this.#n.removeEventListener(`pointerdown`,a,!0)),this.#s.push(()=>this.#n.removeEventListener(`keydown`,o,!0));let s=()=>this.#o?.refresh();this.#s.push(e.on(`pageChanged`,s)),this.#s.push(e.on(`zoomChanged`,s)),this.#s.push(e.on(`flipEnd`,s))}#c(){return{zine:this.#e,close:()=>this.#d(),colorScheme:this.#i,strings:this.#e.strings}}#l(e,t){this.#d();let n=new yn(this.#n,()=>this.#c(),()=>this.#d(),this.#a);if(n.build(this.#r),!n.el.querySelector(`button`))return;let r=this.#n.createElement(`div`);r.className=`zine-context-layer`,q(r,this.#i),r.appendChild(n.el),this.#t.appendChild(r),this.#o=n,n.refresh(),this.#u(n.el,e,t),n.focusFirst()}#u(e,t,n){let r=this.#t.getBoundingClientRect(),i=e.getBoundingClientRect();if(!i.width){e.style.left=`${t}px`,e.style.top=`${n}px`;return}let a=Math.min(t,r.right-i.width-4),o=Math.min(n,r.bottom-i.height-4);e.style.left=`${Math.max(r.left+4,a)}px`,e.style.top=`${Math.max(r.top+4,o)}px`}#d(){if(!this.#o)return;let e=this.#o.el.parentElement,t=this.#n.activeElement!==null&&this.#o.contains(this.#n.activeElement);this.#o.destroy(),e?.remove(),this.#o=null,t&&typeof this.#t.focus==`function`&&this.#t.focus()}destroy(){this.#d();for(let e of this.#s)e();this.#s=[]}}})),Kn=r({DEFAULT_ITEMS:()=>V,ICONS:()=>L,createIcon:()=>I,defineControl:()=>z,getControl:()=>Nt,mountContextMenu:()=>Jn,mountControls:()=>qn});function qn(e,t,n={},r=new Set){let i=new Bn(e,t,n,r);return Ln(i),i.mount(n),()=>i.destroy()}function Jn(e,t,n={},r=new Set){let i=new Wn(e,t,n,r);return()=>i.destroy()}var Yn=n((()=>{Vn(),Gn(),H(),R()}));E();var Xn=.25,Zn=.0015,Qn=6,X=250,$n=24,er=2*X,tr=1.2,nr=32,rr=60,ir=2.5,ar=1.5,or=120,sr=.85,cr=.82,lr=.12,ur=360,dr=28,fr=260,pr=7e3,mr=2200,hr=`zine:hints-learned`,gr=`zine:sound-muted`;function _r(e,t,n){let r=Math.max(0,t-nr),i=Math.min(e.length,t+n+nr),a=e.slice(r,i).replace(/\s+/g,` `).trim();return`${r>0?`…`:``}${a}${i<e.length?`…`:``}`}var vr=class{#e;#t;#n=new c;#r=new s(2);#i=new d;#a;#o;#s;#c;#l=1;#u;#d;#f;#p=null;#m=new Map;#h;#g;#_;#v=null;#y=null;#b;#x;#S;#C;#w=null;#T=!1;#E=!1;#D=!1;#O={turn:!1,zoom:!1,pan:!1};#k=null;#A=null;#j=null;#M=null;#N=null;#P=null;#F=!1;#I=``;#L;#R;#z;#B=!1;#V=null;#H=!1;#U;#W=null;#G;#K;#q;#J=null;#Y=null;#X=[];#Z=0;#Q=0;#$={left:null,right:null};#ee;#te;#ne;#re;#ie;#ae=null;#oe=!1;#se=1;#ce=0;#le=0;#ue=null;#de=!1;#fe=!1;#pe=null;#me=null;#he=null;#ge=null;#_e=null;#ve=null;#ye=null;#be=0;#xe=null;#Se=!1;#Ce=1;#we=!1;#Te=null;#Ee=null;#De=null;#Oe=null;#ke=null;#Ae=null;#je=-1/0;#Me=null;#Ne=null;#Pe=new Set;#Fe;#Ie=null;#Le;#Re=null;#ze;#Be;#Ve=null;#He=null;#Ue=`download`;#We=1;#Ge=0;#Ke=null;#qe;debug={setFlipProgress:(e,t)=>{this.#ue?.setFlipProgress(e,t)}};constructor(e,t){xr(e,t),this.#e=e,t.width!==void 0&&(e.style.width=`${t.width}px`),t.height!==void 0&&(e.style.height=`${t.height}px`),this.#t=tt(t.source,{frontCover:t.frontCover,backCover:t.backCover,pages:t.pages});let n=t.direction??`ltr`;this.#a=n,this.#K=(t.deepLink??!0)&&y(),this.#q=t.disableContextMenu??!1,this.#o=t.spreadMode??`cover`,this.#s=this.#o,this.#c=t.curl??`cone`,this.#u=t.clickToFlip??`edge`,this.#d=t.fit??`contain`,this.#f=t.gutterOverlap??0,this.#f===`auto`&&(this.#p=Promise.resolve().then(()=>(gt(),ot)).then(e=>e.detectOverlap,()=>null)),this.#h=at(t.strings),this.#g=t.clickZoneSize??64,this.#_=t.cursorHints??!0;let r=t.hints??!0;this.#b=r===!0||r!==!1&&(r.enabled??!0),this.#x=r!==!0&&r!==!1&&(r.persist??!1),this.#x&&this.#wt();let i=t.sound??!1;this.#S=i!==!1,this.#C=i===!0||i===!1?{}:i,this.#T=typeof i==`object`&&i?i.muted??!1:!1,this.#E=typeof i==`object`&&i?i.persist??!1:!1,this.#S&&this.#E&&this.#et(),this.#z=t.singlePageThreshold??640,this.#U=t.responsiveSpread??!0,this.#Fe=t.controls??!0,this.#Le=t.contextMenu??!t.disableContextMenu,this.#ze=new Set(t.hideControls??[]),this.#Be=t.loading??!0,this.#G=t.startPage,typeof this.#t.open!=`function`&&this.#An(),this.#ee=t.flipDuration??800,this.#te=t.zoom?.enabled??!0,this.#ne=t.zoom?.wheel??!0;let a=t.zoom?.doubleClick,o=a===!1?[]:[...a??[1,2,4]].sort((e,t)=>e-t);this.#re=o.length>0?o:null,this.#ie=t.zoom?.max??4;let s=this.#te&&this.#re!==null,c=t.zoom?.doubleClickInFlipZone??this.#u===`half`;this.#L=this.#u!==`off`&&s&&c&&t.clickFlipDelay!==0,this.#R=this.#L?t.clickFlipDelay??X:0,this.#qe=this.#Jt(t.renderer??`auto`)}get ready(){return this.#qe}getPageCount(){return this.#t.pageCount}getPage(){return this.#Q}get container(){return this.#e}getPageBox(){return this.#ue?.measure().book??null}getSpreads(){return this.#X}getSpreadIndex(){return this.#Z}getDirection(){return this.#a}getSpreadMode(){return this.#o}isSinglePage(){return this.#B}setSpreadMode(e){e!==this.#o&&(this.#o=e,this.#H=!1,this.#pn(),this.#mn())}toggleSpreadMode(){this.setSpreadMode(this.#o===`single`?this.#s===`single`?`double`:this.#s:`single`)}getResponsiveSpread(){return this.#U}isResponsiveSingle(){return this.#H&&this.#o!==`single`}setResponsiveSpread(e){if(e!==this.#U){if(this.#U=e,e){let e=this.#ue?.measure().containerWidth;if(e===void 0)return;this.#H=!1,this.#fn(e)}else{if(!this.#H)return;this.#H=!1,this.#pn()}this.#mn()}}getPageImage(e){return this.#Dn(e)}canFlipNext(){return this.#Z+1<this.#X.length}canFlipPrev(){return this.#Z>0}getMaxZoom(){return this.#ie}canSearch(){return typeof this.#t.getText==`function`}canDownload(){return typeof this.#t.getDownload==`function`}isDocument(){return typeof this.#t.getOutline==`function`||typeof this.#t.getText==`function`}canPrint(){return typeof this.#t.getDownload==`function`&&this.#e.ownerDocument?.defaultView?.navigator?.pdfViewerEnabled!==!1}async print(){let e=await this.getSourceFile(),t=this.#e.ownerDocument;if(!e||!t)return!1;let{url:n,revoke:r}=await this.#Je(e,t),i=t.createElement(`iframe`);return i.style.cssText=`position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;`,i.setAttribute(`aria-hidden`,`true`),i.src=n,new Promise(e=>{let a=!1,o=t=>{a||(a=!0,setTimeout(()=>{i.remove(),r&&URL.revokeObjectURL(n)},6e4),e(t))};i.addEventListener(`load`,()=>{try{let e=i.contentWindow;if(!e)return o(!1);e.focus(),e.print(),o(!0)}catch{o(!1)}}),i.addEventListener(`error`,()=>o(!1)),t.body.appendChild(i)})}canOutline(){return typeof this.#t.getOutline==`function`}getOutline(){if(!this.#Ne){let e=this.#t.getOutline;this.#Ne=typeof e==`function`?Promise.resolve(e.call(this.#t)).catch(()=>[]):Promise.resolve([])}return this.#Ne}async getSourceFile(){let e=this.#t.getDownload;return typeof e==`function`?await e.call(this.#t)??null:null}async download(){let e=await this.getSourceFile();if(!e)return!1;let t=this.#e.ownerDocument;if(!t)return!1;let{url:n,revoke:r}=await this.#Je(e,t),i=t.createElement(`a`);return i.href=n,i.download=e.filename,i.rel=`noopener`,t.body.appendChild(i),i.click(),i.remove(),r&&setTimeout(()=>URL.revokeObjectURL(n),1e4),!0}async#Je(e,t){if(e.revoke||!this.#Ye(e.url,t))return{url:e.url,revoke:e.revoke??!1};try{let t=await(await fetch(e.url)).blob();return{url:URL.createObjectURL(t),revoke:!0}}catch{return{url:e.url,revoke:!1}}}#Ye(e,t){let n=t.defaultView?.location?.href;if(!n)return!1;try{return new URL(e,n).origin!==new URL(n).origin}catch{return!1}}async search(e,t={}){let n=this.#t.getText,r=e.trim().toLowerCase();if(typeof n!=`function`||r===``)return[];let i=t.limit??50,a=[];for(let e=0;e<this.#t.pageCount&&a.length<i;e++){let t;try{t=await n.call(this.#t,e)}catch(t){this.#n.emit(`sourceError`,{index:e,error:t});continue}let i=t.toLowerCase().indexOf(r);i<0||a.push({page:e,excerpt:_r(t,i,r.length)})}return a}flipNext(){this.#Xe(1)}flipPrev(){this.#Xe(-1)}#Xe(e){this.#Ze(()=>this.#it(this.#Z+e))}flipTo(e){let t=Z(e,0,Math.max(0,this.#t.pageCount-1));this.#Ze(()=>this.#it(this.#kn(t)))}#Ze(e){this.#i.state===`idle`?e():this.#ye?(this.#ve=null,this.#Qe(),e()):this.#ve=e}#Qe(){let e=this.#ye;e&&(this.#ye=null,this.#pe!==null&&(cancelAnimationFrame(this.#pe),this.#pe=null),this.#ue?.setFlipProgress(e.toT,e.direction),e.onDone())}#$e(){let e=this.#ve;if(!e){this.#Sn();return}this.#ve=null,e()}getZoom(){return this.#se}setZoom(e,t){if(!this.#ue||!this.#te)return;this.#kt(),this.#Mt();let n=Z(e,1,this.#ie),r=this.#ue.measure(),i=r.screenAt?.(this.#se),a=t??(i?{x:i.x+this.#ce+i.width/2,y:i.y+this.#le+i.height/2}:null)??{x:r.containerWidth/2,y:r.containerHeight/2},o=this.#se,s=n===1?0:a.x-n/o*(a.x-this.#ce),c=n===1?0:a.y-n/o*(a.y-this.#le);[s,c]=this.#rt(s,c,n,r.containerWidth,r.containerHeight),this.#se=n,this.#ce=s,this.#le=c,this.#ue.setViewTransform(n,s,c),o>1!=n>1&&this.#nt(),this.#vn(),this.#St(),o<=1&&n>1&&(this.#Tt(`zoom`),this.#Nt()),this.#n.emit(`zoomChanged`,{scale:n})}resetZoom(){this.setZoom(1)}get strings(){return this.#h}isSoundEnabled(){return this.#S}isSoundMuted(){return this.#S&&this.#T}setSoundMuted(e){this.#S&&(this.#T=e,this.#w?.setMuted(e),this.#E&&this.#tt(e),e||this.#Yt())}#et(){try{let e=localStorage.getItem(gr);(e===`true`||e===`false`)&&(this.#T=e===`true`)}catch{}}#tt(e){try{localStorage.setItem(gr,String(e))}catch{}}#nt(){this.#e.style.touchAction=this.#se>1?`none`:`pan-y`}#rt(e,t,n,r,i){let a=typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1,o=e=>Math.round(e*a)/a||0,s=this.#ue?.measure().screenAt?.(n)??{x:0,y:0,width:r*n,height:i*n},[c,l]=yr(s.x,s.width,r),[u,d]=yr(s.y,s.height,i);return[o(Z(e,c,l)),o(Z(t,u,d))]}on(e,t){return this.#n.on(e,t)}destroy(){this.#fe=!0,this.#pe!==null&&cancelAnimationFrame(this.#pe),this.#ye=null,this.#ve=null,this.#zt(),this.#Dt(),this.#kt(),this.#Mt(),this.#Rt(),this.#Ft(),this.#w?.destroy(),this.#w=null,this.#ae?.disconnect(),this.#J?.stop(),this.#J=null,this.#Y?.(),this.#K&&b(),this.#Ie?.(),this.#Re?.(),this.#en(),this.#Me?.(),this.#De?.(),this.#ke?.(),this.#Oe?.(),this.#y?.(),this.#Ee?.(),this.#Ke!==null&&clearTimeout(this.#Ke),this.#Ge++,this.#ue?.destroy(),this.#ue=null,this.#t.destroy(),this.#n.clear()}#it(e){if(e<0||e>=this.#X.length||e===this.#Z||(this.#kt(),this.#Mt(),this.#i.send(`flip`)===null))return;let t=e>this.#Z?`forward`:`backward`,n=this.#lt(e);this.#n.emit(`flipStart`,{from:this.#Q,to:n}),this.#Xt(),this.#at(e,t,n,++this.#be)}async#at(e,t,n,r){let i=this.#X[e],a=i?await this.#Tn(i):{left:null,right:null};r===this.#be&&(this.#ue?.beginFlip(this.#$,a,t,{fill:this.#B,fit:this.#d,curl:this.#un(),anchor:{y:this.#l}}),this.#ot(0,1,t,()=>this.#ct(e,n,a),()=>this.#st(n)))}#ot(e,t,n,r,i){let a=this.#ln()*Math.abs(t-e);if(a<=0){this.#ue?.setFlipProgress(t,n),r();return}let o={toT:t,direction:n,onDone:r};this.#ye=o;let s=performance.now(),c=!1,l=u=>{if(this.#ye!==o)return;let d=Math.min(1,(u-s)/a),f=br(d);i&&!c&&f>=(this.#B?cr:sr)&&(c=!0,i()),d<1?(this.#ue?.setFlipProgress(e+(t-e)*f,n),this.#pe=requestAnimationFrame(l)):(this.#ue?.setFlipProgress(t,n),this.#pe=null,this.#ye=null,r())};this.#pe=requestAnimationFrame(l)}#st(e){this.#Q!==e&&(this.#Q=e,this.#cn(),this.#n.emit(`pageChanged`,{page:e}))}#ct(e,t,n){let r=this.#X[e];this.#Z=e,this.#$=n,r&&this.#hn(r,n),this.#On(),this.#i.send(`settle`),this.#je=performance.now(),this.#st(t),this.#Tt(`turn`),this.#St(),this.#n.emit(`flipEnd`,{page:t}),this.#$e()}#lt(e){let t=this.#X[e];if(!t)return this.#Q;let n=[t.left,t.right].filter(e=>e!==null);return n.length>0?Math.min(...n):this.#Q}#ut(e,t){if(this.#Se||!this.#ue)return;if(this.#Mt(),this.#zt(),this.#se>1){if(this.#i.send(`panStart`)===null)return;this.#xe={baseTx:this.#ce,baseTy:this.#le};return}let n=this.#_t(),r=this.#vt(e,t);this.#ge=r;let i=Math.min(n.width,n.height)*Xn,a=r.x>=0&&r.x<=n.width&&r.y>=0&&r.y<=n.height,o=r.x<=i||r.x>=n.width-i,s=a&&o;if(this.#i.state!==`idle`){if(!this.#ye||!s){this.#he=null;return}this.#Qe()}if(!s)return;this.#l=Z(r.y/n.height,0,1);let c=r.x>n.width/2,l=this.#a===`rtl`?!c:c,u=this.#Z+(l?1:-1);u<0||u>=this.#X.length||(this.#he={direction:l?`forward`:`backward`,targetIndex:u,toPage:this.#lt(u),width:n.width})}#dt(){let e=this.#he;e&&(this.#he=null,this.#i.send(`grab`)!==null&&(this.#me={direction:e.direction,targetIndex:e.targetIndex,toPage:e.toPage,toContent:{left:null,right:null},width:e.width,t:0},this.#n.emit(`flipStart`,{from:this.#Q,to:e.toPage}),this.#ft(e.targetIndex,e.direction)))}async#ft(e,t){let n=this.#X[e],r=n?await this.#Tn(n):{left:null,right:null};this.#me?.targetIndex===e&&(this.#me.toContent=r,this.#ue?.beginFlip(this.#$,r,t,{fill:this.#B,fit:this.#d,curl:this.#un(),anchor:{y:this.#l}}),this.#ue?.setFlipProgress(this.#me.t,t))}#pt(e,t){if(this.#Se)return;if(this.#xe){if(!this.#ue)return;let n=this.#ue.measure(),[r,i]=this.#rt(this.#xe.baseTx+e,this.#xe.baseTy+t,this.#se,n.containerWidth,n.containerHeight);this.#ce=r,this.#le=i,this.#ue.setViewTransform(this.#se,r,i),this.#vn(),this.#Tt(`pan`),this.#Ft();return}this.#he&&Math.hypot(e,t)>Qn&&this.#dt();let n=this.#me;n&&(n.t=Z((n.direction===`forward`?-e:e)/n.width,0,1),this.#ue?.setFlipProgress(n.t,n.direction))}#mt(e){if(this.#Se)return;if(this.#xe){this.#xe=null,this.#i.send(`panEnd`),this.#St();return}let t=this.#me;if(!t){this.#he=null,this.#ht(e)||this.#gt(e);return}this.#me=null,this.#i.send(`release`);let n=e.swipe&&Math.abs(e.vx)>Math.abs(e.vy),r=t.direction===`forward`?e.vx<0:e.vx>0,i=n&&r,a=n&&!r;i||t.t>=.5&&!a?(this.#Xt(),this.#ot(t.t,1,t.direction,()=>this.#ct(t.targetIndex,t.toPage,t.toContent),()=>this.#st(t.toPage))):this.#ot(t.t,0,t.direction,()=>this.#Bt())}#ht(e){if(this.#se>1||!e.swipe||Math.abs(e.dx)<=Math.abs(e.dy))return!1;let t=this.#a===`rtl`?e.dx>0:e.dx<0,n=t?`forward`:`backward`;if(!this.#bt(n))return this.#jt(n),!1;let r=t?1:-1;return this.#Ze(()=>this.#it(this.#Z+r)),!0}#gt(e){if(this.#u===`off`||this.#se>1||!this.#ge||Math.abs(e.dx)>Qn||Math.abs(e.dy)>Qn)return;let t=this.#yt(this.#ge);if(!t)return;if(!this.#bt(t)){this.#jt(t);return}this.#l=Z(this.#ge.y/this.#_t().height,0,1);let n=t===`forward`?1:-1,r=()=>this.#it(this.#Z+n);if(this.#zt(),this.#R<=0){this.#Ze(r);return}this.#_e=setTimeout(()=>{this.#_e=null,this.#Ze(r)},this.#R)}#_t(){let e=this.#ue.measure();return e.content??e.book??{x:0,y:0,width:e.containerWidth,height:e.containerHeight}}#vt(e,t){let n=this.#e.getBoundingClientRect(),r=this.#_t();return{x:e-n.left-r.x,y:t-n.top-r.y}}#yt(e){if(!this.#ue)return null;let t=this.#_t().width,n;if(n=this.#u===`half`?e.x>t/2?`right`:`left`:e.x<=this.#g?`left`:e.x>=t-this.#g?`right`:null,!n)return null;let r=this.#a===`rtl`?`left`:`right`;return n===r?`forward`:`backward`}#bt(e){let t=this.#Z+(e===`forward`?1:-1);return t>=0&&t<this.#X.length}#xt(){let e=e=>{let t=e;this.#v={x:t.clientX,y:t.clientY},this.#St()},t=()=>{this.#v=null,this.#St()};this.#e.addEventListener(`pointermove`,e),this.#e.addEventListener(`pointerleave`,t),this.#y=()=>{this.#e.removeEventListener(`pointermove`,e),this.#e.removeEventListener(`pointerleave`,t)}}#St(){if(!this.#_||!this.#ue)return;let e=``;this.#me||this.#xe?e=`grabbing`:this.#v&&(e=this.#Ct(this.#v.x,this.#v.y)),this.#e.style.cursor=e}#Ct(e,t){if(!this.#ue)return``;let n=this.#_t(),r=this.#vt(e,t);if(r.x<0||r.y<0||r.x>n.width||r.y>n.height)return``;if(this.#se>1)return`grab`;let i=this.#yt(r);return i&&this.#bt(i)?`pointer`:this.#te&&this.#re!==null?`zoom-in`:``}#wt(){try{let e=localStorage.getItem(hr);if(!e)return;let t=JSON.parse(e);this.#O={turn:t.turn===!0,zoom:t.zoom===!0,pan:t.pan===!0}}catch{}}#Tt(e){if(!this.#O[e]&&(this.#O[e]=!0,e===`turn`&&this.#Dt(),e===`zoom`&&this.#Rt(),this.#x))try{localStorage.setItem(hr,JSON.stringify(this.#O))}catch{}}#Et(){!this.#b||this.#we||this.#O.turn||(this.#Dt(),this.#k=setTimeout(()=>{this.#k=null,this.#Ot()},pr))}#Dt(){this.#k!==null&&(clearTimeout(this.#k),this.#k=null)}async#Ot(){if(!this.#b||this.#we||this.#O.turn||!this.#ue||typeof requestAnimationFrame!=`function`||this.#i.state!==`idle`)return;let e=this.#Z+1,t=this.#X[e];if(!t)return;let n=await this.#Tn(t);if(this.#fe||this.#O.turn||this.#i.state!==`idle`||this.#A)return;this.#l=1,this.#ue.beginFlip(this.#$,n,`forward`,{fill:this.#B,fit:this.#d,curl:this.#un(),anchor:{y:this.#l}});let r={};this.#A=r;let i=performance.now(),a=ur*2,o=()=>{if(this.#A!==r)return;let e=Math.min(1,(performance.now()-i)/a),t=lr*Math.sin(e*Math.PI);this.#ue?.setFlipProgress(Math.max(0,t),`forward`),e<1?this.#pe=requestAnimationFrame(o):(this.#pe=null,this.#A=null,this.#At())};this.#pe=requestAnimationFrame(o)}#kt(){this.#A&&(this.#A=null,this.#pe!==null&&(cancelAnimationFrame(this.#pe),this.#pe=null),this.#At())}#At(){let e=this.#X[this.#Z];e&&this.#i.state===`idle`&&this.#hn(e,this.#$)}#jt(e){if(!this.#ue||typeof requestAnimationFrame!=`function`||this.#we||this.#i.state!==`idle`||this.#se>1||this.#j)return;let t=e===`forward`,n=(this.#a===`rtl`?!t:t)?-1:1,r={};this.#j=r;let i=performance.now(),a=()=>{if(this.#j!==r)return;let e=Math.min(1,(performance.now()-i)/fr),t=dr*Math.sin(e*Math.PI);this.#ue?.setViewTransform(1,n*t,0),e<1?this.#pe=requestAnimationFrame(a):(this.#pe=null,this.#j=null,this.#ue?.setViewTransform(1,0,0))};this.#pe=requestAnimationFrame(a)}#Mt(){this.#j&&(this.#j=null,this.#pe!==null&&(cancelAnimationFrame(this.#pe),this.#pe=null),this.#ue?.setViewTransform(1,0,0))}#Nt(){this.#O.pan||this.#Pt(this.#h.panHint)}#Pt(e){if(!this.#b)return;let t=this.#e.ownerDocument;if(!t||typeof this.#e.appendChild!=`function`)return;this.#Ft();let n=t.createElement(`div`);n.className=`zine-hint-caption`,n.setAttribute(`aria-hidden`,`true`),n.textContent=e,n.style.cssText=`position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:3;pointer-events:none;padding:6px 12px;border-radius:999px;font:500 13px/1.2 system-ui,sans-serif;color:#fff;background:rgba(24,24,27,0.82);box-shadow:0 1px 4px rgba(0,0,0,0.35);white-space:nowrap;opacity:0;`;let r=!this.#we&&typeof requestAnimationFrame==`function`;r&&(n.style.transition=`opacity 200ms ease`),this.#e.appendChild(n),this.#M=n,r?requestAnimationFrame(()=>{this.#M===n&&(n.style.opacity=`1`)}):n.style.opacity=`1`,this.#N=setTimeout(()=>this.#Ft(),mr)}#Ft(){this.#N!==null&&(clearTimeout(this.#N),this.#N=null),this.#M?.remove(),this.#M=null}#It(e,t){!this.#b||this.#O.zoom||this.#F||this.#I===`mouse`&&this.#Ct(e,t)===`zoom-in`&&(this.#i.state===`animating`||performance.now()-this.#je<=er||(this.#Rt(),this.#P=setTimeout(()=>{this.#P=null,!(this.#O.zoom||this.#F)&&(this.#F=!0,this.#Pt(this.#Lt()))},X)))}#Lt(){let e=this.#e.ownerDocument?.defaultView?.navigator,t=/Mac|iPhone|iPad/.test(e?.platform??``);return this.#h.zoomHint({doubleClick:this.#re!==null,wheel:this.#ne,mac:t})}#Rt(){this.#P!==null&&(clearTimeout(this.#P),this.#P=null)}#zt(){this.#_e!==null&&(clearTimeout(this.#_e),this.#_e=null)}#Bt(){let e=this.#X[this.#Z];e&&this.#hn(e,this.#$),this.#i.send(`settle`),this.#St(),this.#n.emit(`flipEnd`,{page:this.#Q}),this.#$e()}#Vt(){if(this.#he=null,this.#zt(),this.#me){this.#me=null,this.#i.send(`release`),this.#i.send(`settle`);let e=this.#X[this.#Z];e&&this.#hn(e,this.#$)}else this.#xe&&(this.#xe=null,this.#i.send(`panEnd`));this.#Se=!0,this.#Ce=this.#se}#Ht(e,t,n){if(!this.#Se)return;let r=this.#e.getBoundingClientRect();this.setZoom(this.#Ce*n,{x:e-r.left,y:t-r.top})}#Ut(){this.#Se=!1}#Wt(){if(!this.#q)return;let e=e=>e.preventDefault();this.#e.addEventListener(`contextmenu`,e),this.#Oe=()=>this.#e.removeEventListener(`contextmenu`,e)}#Gt(){let e=e=>{if(!this.#ne||!this.#te||!(e.ctrlKey||e.metaKey))return;e.preventDefault();let t=this.#e.getBoundingClientRect(),n=Math.exp(-e.deltaY*Zn);this.setZoom(this.#se*n,{x:e.clientX-t.left,y:e.clientY-t.top})};this.#e.addEventListener(`wheel`,e,{passive:!1}),this.#De=()=>this.#e.removeEventListener(`wheel`,e)}#Kt(){let e=e=>{this.#I=e.pointerType},t=e=>{let t=this.#re;if(!this.#te||t===null||!this.#ue)return;let n=performance.now(),r=this.#Ae;if(!(r!==null&&n-r.t<=X&&Math.hypot(e.clientX-r.x,e.clientY-r.y)<=$n)){this.#Ae={t:n,x:e.clientX,y:e.clientY},this.#It(e.clientX,e.clientY);return}this.#Ae=null,this.#Rt(),this.#qt(e.clientX,e.clientY,t)};this.#e.addEventListener(`pointerdown`,e),this.#e.addEventListener(`click`,t),this.#ke=()=>{this.#e.removeEventListener(`pointerdown`,e),this.#e.removeEventListener(`click`,t)}}#qt(e,t,n){if(this.#se<=1&&this.#u!==`off`&&!this.#L){let n=this.#vt(e,t),r=this.#yt(n);if(r!==null&&this.#bt(r)||this.#i.state===`animating`||performance.now()-this.#je<=er)return}this.#zt();let r=n.find(e=>e>this.#se+1e-6)??n[0]??this.#se,i=this.#e.getBoundingClientRect();this.setZoom(r,{x:e-i.left,y:t-i.top})}async#Jt(e){let t=et(e);if(this.#t.onProgress?.(e=>this.#Zt(e)),typeof this.#t.open==`function`){this.#Qt();try{await this.#t.open(),this.#An()}catch(e){throw this.#en(),e}this.#$t(`preparing`)}this.#t.prefetch([this.#Q]);let n=await t,r=await this.#tn(n);this.#ue=r,this.#t.onPageUpdate?.(e=>this.#_n(e)),this.#fn(r.measure().containerWidth);let i=new p({onStart:e=>this.#ut(e.x,e.y),onMove:e=>this.#pt(e.dx,e.dy),onEnd:e=>this.#mt(e)}),a=new g({onPinchStart:()=>this.#Vt(),onPinchMove:e=>this.#Ht(e.centerX,e.centerY,e.scale),onPinchEnd:()=>this.#Ut()});this.#Ee=m(this.#e,{pointer:i,pinch:a}),this.#nt(),this.#Gt(),this.#Kt(),this.#Wt(),this.#xt(),this.#rn(),this.#Me=this.#on(),await this.#mn(),this.#en(),this.#Cn(),this.#On(),this.#cn(),this.#an(),await this.#in(),this.#Yt(),this.#n.emit(`ready`),this.#Ot(),this.#Et()}async#Yt(){if(!(!this.#S||this.#T||this.#D||this.#fe)){this.#D=!0;try{let{FlipSound:e}=await Promise.resolve().then(()=>(Tt(),yt));if(this.#fe)return;this.#w=new e(this.#C),this.#w.setMuted(this.#T)}catch{}}}#Xt(){this.#w?.play()}#Zt(e){this.#He=e,this.#n.emit(`progress`,e),this.#Ve?.update(e)}async#Qt(){if(this.#Be===!1||this.#fe)return;let e=this.#e;if(!(!e.ownerDocument||typeof e.appendChild!=`function`))try{let{mountLoading:t}=await Promise.resolve().then(()=>(Mt(),Et));if(this.#Ue===`done`||this.#fe)return;this.#Ve=t(e,this.#h),this.#He&&this.#Ve.update(this.#He),this.#Ue===`preparing`&&this.#Ve.preparing()}catch{}}#$t(e){this.#Ue!==`done`&&(this.#Ue=e,this.#Ve?.preparing())}#en(){this.#Ue=`done`,this.#Ve?.destroy(),this.#Ve=null}async#tn(e){try{return await e.mount(this.#e),e.onFatal?.(()=>{this.#nn()}),e}catch{e.destroy();let t=await et(`css`);return await t.mount(this.#e),this.#de=!0,this.#n.emit(`rendererFallback`,{from:`webgl2`,to:`css`}),t}}async#nn(){if(this.#de||this.#fe)return;this.#de=!0,this.#ue?.destroy(),this.#ue=null;let e=await et(`css`);if(this.#fe){e.destroy();return}await e.mount(this.#e),this.#ue=e,this.#fn(e.measure().containerWidth),await this.#mn(),this.#n.emit(`rendererFallback`,{from:`webgl2`,to:`css`})}#rn(){if(typeof matchMedia!=`function`)return;let e=matchMedia(`(prefers-reduced-motion: reduce)`);this.#we=e.matches,e.addEventListener?.(`change`,e=>{this.#we=e.matches})}async#in(){let e=this.#Fe!==!1,t=this.#Le!==!1;if(!e&&!t||this.#fe)return;let n=this.#e;if(!(!n.ownerDocument||typeof n.appendChild!=`function`))try{let{mountControls:e,mountContextMenu:t}=await Promise.resolve().then(()=>(Yn(),Kn));if(this.#fe)return;if(this.#Fe!==!1){let t=this.#Fe===!0?{}:this.#Fe;this.#Ie=e(this,n,t,this.#ze)}if(this.#Le!==!1){let e=this.#Le===!0?{}:this.#Le;this.#Re=t(this,n,e,this.#ze)}}catch{}}#an(){if(!this.#K||globalThis.location===void 0)return;let e=globalThis;this.#J=C(e,e=>{e!==this.#Q&&this.flipTo(e)}),this.#J.push(this.#Q),this.#Y=this.#n.on(`pageChanged`,({page:e})=>{this.#J?.push(e)})}pageLink(e=this.#Q){let t=globalThis.location?.href??``;if(!t)return``;let n=new URL(t);return n.hash=S(n.hash,Z(e,0,Math.max(0,this.#t.pageCount-1))),n.toString()}#on(){let e=this.#e,t=e.ownerDocument;if(!t||typeof e.setAttribute!=`function`)return null;e.hasAttribute(`tabindex`)||(e.tabIndex=0),e.setAttribute(`aria-roledescription`,this.#h.roledescription);let n=e=>this.#sn(e);e.addEventListener(`keydown`,n);let r=t.createElement(`div`);return r.setAttribute(`aria-live`,`polite`),r.setAttribute(`aria-atomic`,`true`),r.style.cssText=`position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;`,e.appendChild(r),this.#Te=r,()=>{e.removeEventListener(`keydown`,n),r.remove(),this.#Te=null}}#sn(e){let t=this.#a===`rtl`?`ArrowLeft`:`ArrowRight`;switch(e.key){case`ArrowRight`:case`ArrowLeft`:e.key===t?this.flipNext():this.flipPrev(),e.preventDefault();break;case`Home`:this.flipTo(0),e.preventDefault();break;case`End`:this.flipTo(this.#t.pageCount-1),e.preventDefault();break;default:break}}#cn(){this.#Te&&(this.#Te.textContent=this.#h.pageAnnounce(this.#Q+1,this.#t.pageCount))}#ln(){return this.#we?or:this.#ee*(this.#B?tr:1)}#un(){return this.#we?`simple`:this.#c}update(){!this.#ue||this.#i.state!==`idle`||(this.#fn(this.#ue.measure().containerWidth),this.#mn(),this.#St())}#dn(){return this.#H||this.#o===`single`?`single`:this.#o}#fn(e){let t=this.#U&&a(e,this.#z);t!==this.#H&&(this.#H=t,this.#pn())}#pn(){let e=this.#dn(),t=e!==this.#V;this.#V=e,this.#B=e===`single`,this.#X=i(this.#t.pageCount,{direction:this.#a,mode:e}),this.#Z=this.#kn(this.#Q),t&&this.#n.emit(`spreadChanged`,{mode:e,singlePage:this.#B})}async#mn(){let e=this.#X[this.#Z];!e||!this.#ue||(this.#$=await this.#Tn(e),this.#hn(e,this.#$))}#hn(e,t){this.#ue?.renderSpread(e,t,{fill:this.#B,fit:this.#d}),this.#gn(),this.#We=1,this.#vn()}#gn(){let e=this.#ue?.measure(),t=e?.containerAspect;if(t===void 0){let n=e?.book;if(!n||n.width<=0||n.height<=0)return;t=n.width/n.height}t<=0||this.#W!==null&&Math.abs(t-this.#W)<.005||(this.#W=t,this.#e.style.aspectRatio=t.toFixed(4))}#_n(e){if(this.#i.state!==`idle`){this.#Pe.add(e);return}let t=this.#X[this.#Z];if(!(!t||!(t.left===e||t.right===e))){if(this.#se>1){this.#vn();return}this.#mn()}}#vn(){this.#Ke!==null&&clearTimeout(this.#Ke);let e=this.#bn();if(e!==this.#We){if(e===1){this.#Ge++,this.#We=1,this.#mn();return}this.#Ke=setTimeout(()=>{this.#Ke=null,this.#xn()},rr)}}#yn(){let e=this.#ue?.measure(),t=e?.content??e?.book;if(!t||t.width<=0)return 1;let n=this.#$,r=+!!n.left+ +!!n.right;if(r===0)return 1;let i=t.width/r,a=typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1,o=0;for(let e of[n.left,n.right]){if(!e||e.width<=0)continue;let t=e.width/this.#We;o=Math.max(o,i*a/t)}return o===0?1:o}#bn(){let e=Math.max(1,ar/(typeof devicePixelRatio==`number`&&devicePixelRatio>0?devicePixelRatio:1)),t=this.#se<=1?1:this.#se,n=this.#yn()*Math.max(t,e);return n<=1.001?1:Math.min(Math.ceil(n*2)/2,ir)}async#xn(){let e=this.#X[this.#Z];if(!this.#ue||!e)return;let t=this.#bn();if(t===1||t===this.#We||this.#i.state!==`idle`)return;let n=++this.#Ge,r={x:0,y:0,width:1,height:1},i=await Promise.all([e.left,e.right].map(async e=>{if(e===null)return null;try{return await this.#t.get(e,{scale:t,region:r,maxSize:this.#ue?.maxTextureSize})}catch(t){return this.#n.emit(`sourceError`,{index:e,error:t}),null}}));if(n!==this.#Ge||this.#bn()!==t||this.#i.state!==`idle`)return;let a=i[0]??this.#$.left,o=i[1]??this.#$.right;a===this.#$.left&&o===this.#$.right||(this.#We=t,this.#$={left:a,right:o},this.#ue.renderSpread(e,this.#$,{fill:this.#B,fit:this.#d}))}#Sn(){if(this.#Pe.size===0)return;let e=this.#X[this.#Z],t=e!==void 0&&[e.left,e.right].some(e=>e!==null&&this.#Pe.has(e));this.#Pe.clear(),t&&(this.#se>1?this.#vn():this.#mn())}#Cn(){typeof ResizeObserver>`u`||(this.#ae=new ResizeObserver(()=>this.#wn()),this.#ae.observe(this.#e))}#wn(){this.#oe||(this.#oe=!0,requestAnimationFrame(()=>{this.#oe=!1,this.update()}))}async#Tn(e){let[t,n]=await Promise.all([this.#Dn(e.left),this.#Dn(e.right)]),r=await this.#En(e,t,n);return r>0?{left:t,right:n,spineTrim:r}:{left:t,right:n}}async#En(e,t,n){let r=this.#f;if(r===0||t===null||n===null)return 0;if(r!==`auto`)return r/2;let i=`${e.left}:${e.right}`,a=this.#m.get(i);if(t.width!==n.width||t.height!==n.height)return(a?.overlap??0)/2;if(a!==void 0&&a.width>=t.width)return a.overlap/2;let o=await this.#p;if(!o)return 0;let s=o(t,n);return this.#m.set(i,{overlap:s,width:t.width}),s/2}async#Dn(e){if(e===null)return null;try{return await this.#t.get(e)}catch(t){return this.#n.emit(`sourceError`,{index:e,error:t}),null}}#On(){let{toMount:e}=this.#r.update(this.#Z,this.#X.length),t=[];for(let n of e){let e=this.#X[n];e?.left!=null&&t.push(e.left),e?.right!=null&&t.push(e.right)}this.#t.prefetch(t)}#kn(e){let t=this.#X.findIndex(t=>t.left===e||t.right===e);return t===-1?0:t}#An(){let e=this.#t.pageCount;if(!Number.isInteger(e)||e<1)throw Error(`Zine: source has ${e} pages; a Source must have at least 1 page.`);let t=this.#G;if(t!==void 0&&(!Number.isInteger(t)||t<0||t>=e))throw Error(`Zine: startPage ${JSON.stringify(t)} is out of range for a ${e}-page book (valid 0..${e-1}).`);let n=this.#dn();this.#B=n===`single`,this.#X=i(e,{direction:this.#a,mode:n});let r=this.#K?x(globalThis.location?.hash??``):null;this.#Q=Z(r??t??0,0,e-1),this.#Z=this.#kn(this.#Q)}};function Z(e,t,n){return e<t?t:e>n?n:e}function yr(e,t,n){if(t<=n){let r=(n-t)/2-e;return[r,r]}return[n-(e+t),-e]}function br(e){return e<.5?2*e*e:1-(-2*e+2)**2/2}function Q(e){return e===null?`null`:Array.isArray(e)?`array`:typeof e}function xr(e,t){if(typeof e!=`object`||!e||typeof e.appendChild!=`function`||typeof e.addEventListener!=`function`)throw Error(`Zine: container must be a DOM element; received ${Q(e)}.`);if(typeof t!=`object`||!t)throw Error("Zine: an options object with a `source` is required.");let n=t,r=n.source;if(typeof r!=`object`||!r||typeof r.get!=`function`||typeof r.pageCount!=`number`)throw Error("Zine: `source` is required and must be a Source, e.g. new ImageSource(urls).");let i=n.startPage;if(i!==void 0&&(typeof i!=`number`||!Number.isInteger(i)||i<0))throw Error(`Zine: startPage must be a non-negative integer; got ${JSON.stringify(i)}.`);let a=n.direction;if(a!==void 0&&a!==`ltr`&&a!==`rtl`)throw Error(`Zine: direction must be 'ltr' or 'rtl'; got ${JSON.stringify(a)}.`);let o=n.clickToFlip;if(o!==void 0&&![`edge`,`half`,`off`].includes(o))throw Error(`Zine: clickToFlip must be 'edge', 'half', or 'off'; got ${JSON.stringify(o)}.`);let s=n.fit;if(s!==void 0&&s!==`contain`&&s!==`fill`)throw Error(`Zine: fit must be 'contain' or 'fill'; got ${JSON.stringify(s)}.`);let c=n.gutterOverlap;if(c!==void 0&&c!==`auto`&&!(typeof c==`number`&&c>=0&&c<=.5))throw Error(`Zine: gutterOverlap must be 'auto' or a number from 0 to 0.5 (a fraction of page width); got ${JSON.stringify(c)}.`);let l=n.strings;if(l!==void 0&&(typeof l!=`object`||!l))throw Error(`Zine: strings must be an object of text overrides; got ${Q(l)}.`);let u=n.curl;if(u!==void 0){if(typeof u==`object`&&u){if(typeof u.deform!=`function`)throw Error(`Zine: a curl model must have a deform() function.`)}else if(T.includes(u))throw Error(`Zine: the '${String(u)}' curl is not bundled. Import it and pass the model: import { ${String(u)} } from '@zinejs/core/curls'  →  curl: ${String(u)}`);else if(!w.includes(u))throw Error(`Zine: curl must be ${w.join(` or `)}, or a model imported from '@zinejs/core/curls' (${T.join(`, `)}); got ${JSON.stringify(u)}.`)}for(let e of[`deepLink`,`disableContextMenu`,`responsiveSpread`,`loading`])if(n[e]!==void 0&&typeof n[e]!=`boolean`)throw Error(`Zine: ${e} must be a boolean; got ${Q(n[e])}.`);let d=n.controls;if(d!==void 0&&typeof d!=`boolean`&&(typeof d!=`object`||!d))throw Error(`Zine: controls must be a boolean or an options object; got ${Q(d)}.`);let f=d?.position;if(f!==void 0&&![`top`,`bottom`,`left`,`right`].includes(f))throw Error(`Zine: controls.position must be 'top', 'bottom', 'left', or 'right'; got ${JSON.stringify(f)}.`);let p=d?.colorScheme;if(p!==void 0&&![`light`,`dark`,`auto`].includes(p))throw Error(`Zine: controls.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(p)}.`);let m=d?.arrows;if(m!==void 0&&typeof m!=`boolean`&&![`desktop`,`mobile`].includes(m))throw Error(`Zine: controls.arrows must be a boolean, 'desktop', or 'mobile'; got ${JSON.stringify(m)}.`);let h=n.contextMenu;if(h!==void 0&&typeof h!=`boolean`&&(typeof h!=`object`||!h))throw Error(`Zine: contextMenu must be a boolean or an options object; got ${Q(h)}.`);let g=h?.colorScheme;if(g!==void 0&&![`light`,`dark`,`auto`].includes(g))throw Error(`Zine: contextMenu.colorScheme must be 'light', 'dark', or 'auto'; got ${JSON.stringify(g)}.`);if(n.disableContextMenu===!0&&h!==void 0&&h!==!1)throw Error(`Zine: disableContextMenu and contextMenu are mutually exclusive — one removes the browser's right-click menu, the other replaces it. Enable only one.`);let _=n.hideControls;if(_!==void 0&&(!Array.isArray(_)||_.some(e=>typeof e!=`string`)))throw Error(`Zine: hideControls must be an array of control-id strings; got ${Q(_)}.`);let v=n.sound;if(v!==void 0&&typeof v!=`boolean`&&(typeof v!=`object`||!v))throw Error(`Zine: sound must be a boolean or an options object; got ${Q(v)}.`);if(typeof v==`object`&&v){let e=v;if(e.url!==void 0&&typeof e.url!=`string`)throw Error(`Zine: sound.url must be a string URL; got ${Q(e.url)}.`);if(e.volume!==void 0&&(typeof e.volume!=`number`||e.volume<0||e.volume>1))throw Error(`Zine: sound.volume must be a number between 0 and 1; got ${JSON.stringify(e.volume)}.`);if(e.muted!==void 0&&typeof e.muted!=`boolean`)throw Error(`Zine: sound.muted must be a boolean; got ${Q(e.muted)}.`);if(e.persist!==void 0&&typeof e.persist!=`boolean`)throw Error(`Zine: sound.persist must be a boolean; got ${Q(e.persist)}.`)}let y=n.spreadMode;if(y!==void 0&&![`double`,`single`,`cover`,`book`].includes(y))throw Error(`Zine: spreadMode must be 'double', 'single', 'cover', or 'book'; got ${JSON.stringify(y)}.`);for(let e of[`frontCover`,`backCover`]){let t=n[e];if(t!==void 0&&typeof t!=`string`)throw Error(`Zine: ${e} must be an image URL string; got ${JSON.stringify(t)}.`)}let b=n.pages;if(b!==void 0&&(typeof b!=`object`||!b||Array.isArray(b)))throw Error(`Zine: pages must be an object mapping page indices to image URLs.`);$(n.width,`width`,1),$(n.height,`height`,1),$(n.flipDuration,`flipDuration`,0),$(n.clickZoneSize,`clickZoneSize`,0),$(n.clickFlipDelay,`clickFlipDelay`,0),$(n.singlePageThreshold,`singlePageThreshold`,0),Sr(n.zoom),Cr(n.renderer)}function $(e,t,n){if(e!==void 0&&(typeof e!=`number`||!Number.isFinite(e)||e<n))throw Error(`Zine: ${t} must be a number >= ${n}; got ${JSON.stringify(e)}.`)}function Sr(e){if(e===void 0)return;if(typeof e!=`object`||!e||Array.isArray(e))throw Error(`Zine: zoom must be an object, e.g. { max: 4 }.`);let t=e;if(t.enabled!==void 0&&typeof t.enabled!=`boolean`)throw Error(`Zine: zoom.enabled must be a boolean; got ${JSON.stringify(t.enabled)}.`);if(t.wheel!==void 0&&typeof t.wheel!=`boolean`)throw Error(`Zine: zoom.wheel must be a boolean; got ${JSON.stringify(t.wheel)}.`);if(t.doubleClickInFlipZone!==void 0&&typeof t.doubleClickInFlipZone!=`boolean`)throw Error(`Zine: zoom.doubleClickInFlipZone must be a boolean; got ${JSON.stringify(t.doubleClickInFlipZone)}.`);if(t.doubleClick!==void 0&&t.doubleClick!==!1){let e=t.doubleClick;if(!Array.isArray(e)||e.some(e=>typeof e!=`number`||!Number.isFinite(e)||e<1))throw Error(`Zine: zoom.doubleClick must be false or an array of zoom levels >= 1, e.g. [1, 2, 4].`)}$(t.max,`zoom.max`,1)}function Cr(e){if(e!==void 0){if(typeof e==`string`){if(e!==`auto`&&e!==`css`&&e!==`webgl2`)throw Error(`Zine: renderer '${e}' is not recognized; use 'auto', 'css', 'webgl2', an array of those, or a custom Renderer.`);return}if(Array.isArray(e)){for(let t of e)if(t!==`css`&&t!==`webgl2`)throw Error(`Zine: renderer order array may only contain 'css' or 'webgl2'; got ${JSON.stringify(t)}.`);return}if(!(typeof e==`object`&&e&&typeof e.mount==`function`))throw Error(`Zine: renderer must be 'auto', 'css', 'webgl2', an array of those, or a custom Renderer instance.`)}}var wr=class{pageCount;fit;#e;#t;#n=new Map;constructor(e,t={}){this.#e=e,this.pageCount=e.length,this.#t=t.preload??1,this.fit=t.fit??`contain`}get(e){let t=this.#r(e);for(let t=1;t<=this.#t;t++)this.prefetch([e-t,e+t]);return t}prefetch(e){for(let t of e)t>=0&&t<this.pageCount&&this.#r(t).catch(()=>{})}destroy(){for(let e of this.#n.values())e.then(e=>e.close()).catch(()=>{});this.#n.clear()}#r(e){let t=this.#n.get(e);if(t)return t;let n=this.#e[e];if(n===void 0)return Promise.reject(RangeError(`ImageSource: page ${e} is out of range (0..${this.pageCount-1}).`));let r=(async()=>{let t=await fetch(n);if(!t.ok)throw Error(`ImageSource: failed to fetch page ${e} (${n}) — HTTP ${t.status}.`);return createImageBitmap(await t.blob())})().catch(t=>{throw this.#n.delete(e),t});return this.#n.set(e,r),r}};H(),E(),e.CURL_TYPES=w,e.DEFAULT_ITEMS=V,e.IMPORTABLE_CURLS=T,e.ImageSource=wr,e.Zine=vr,e.defaultStrings=it,e.defineControl=z,e.getControl=Nt});
//# sourceMappingURL=index.umd.js.map