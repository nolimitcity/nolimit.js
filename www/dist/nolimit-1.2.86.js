!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.nolimit=t():e.nolimit=t()}(self,(()=>(()=>{"use strict";var e={d:(t,n)=>{for(var o in n)e.o(n,o)&&!e.o(t,o)&&Object.defineProperty(t,o,{enumerable:!0,get:n[o]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{info:()=>m,init:()=>d,load:()=>u,replace:()=>p,url:()=>f,version:()=>c});const n="html, body {\n    overflow: hidden;\n    margin: 0;\n    width: 100%;\n    height: 100%;\n}\n\nbody {\n    position: relative;\n}\n",o="https://{ENV}",i="{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}",r="{CDN}/loader/game-loader.html?{QUERY}",a="{CDN}/games",s={device:"desktop",environment:"partner",language:"en","nolimit.js":"1.2.86"},c="1.2.86";let l={};function d(e){window.nolimit.options=e}function u(e){let t=(e=h(g(l,e))).target||window;if(t.Window&&t instanceof t.Window&&(t=document.createElement("div"),t.setAttribute("style","position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden;"),document.body.appendChild(t)),t.ownerDocument&&t instanceof t.ownerDocument.defaultView.HTMLElement){const o=function(e){const t=document.createElement("iframe");(function(e,t){const n=e.attributes;for(let e=0;e<n.length;e++){let o=n[e];t.setAttribute(o.name,o.value)}})(e,t),t.setAttribute("frameBorder","0"),t.setAttribute("allowfullscreen",""),t.setAttribute("allow","autoplay; fullscreen"),t.setAttribute("sandbox","allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups");const n=w(t.getAttribute("name")||t.id);return t.setAttribute("name",n),t}(t);return t.parentNode.replaceChild(o,t),function(e,t){const n={},o={},i=[];let r;function a(e){e.addEventListener("message",(function(e){e.ports&&e.ports.length>0&&(r=e.ports[0],r.onmessage=s,function(e){for(;i.length>0;)e.postMessage(i.shift())}(r))})),e.trigger=l,e.on=d,t()}function s(e){l(e.data.method,e.data.params)}function c(e,t){const n={jsonrpc:"2.0",method:e};if(t&&(n.params=t),r)try{r.postMessage(n)}catch(e){r=void 0,i.push(n)}else i.push(n)}function l(e,t){n[e]?n[e].forEach((function(e){e(t)})):(o[name]=o[name]||[],o[name].push(t))}function d(e,t){for(n[e]=n[e]||[],n[e].push(t);o[e]&&o[e].length>0;)l(e,o[e].pop());c("register",[e])}return"IFRAME"===e.nodeName?e.contentWindow&&e.contentWindow.document&&"complete"===e.contentWindow.document.readyState?a(e.contentWindow):e.addEventListener("load",(function(){a(e.contentWindow)})):a(e),{on:d,call:c,trigger:l}}(o,(()=>function(e,t){const o=e.document;var r;e.focus(),function(e){const t=e.createElement("style");e.head.appendChild(t),t.appendChild(e.createTextNode(n))}(o),(r=o.head).querySelector('meta[name="viewport"]')||r.insertAdjacentHTML("beforeend",'<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');const a=o.createElement("iframe");a.setAttribute("frameBorder","0"),a.style.backgroundColor="black",a.style.width="100vw",a.style.height="100vh",a.style.position="relative",a.style.zIndex="2147483647",a.classList.add("loader"),a.src=i.replace("{CDN}",t.cdn).replace("{DEVICE}",t.device).replace("{OPERATOR}",t.operator).replace("{GAME}",t.game).replace("{LANGUAGE}",t.language),o.body.innerHTML="",e.on("error",(function(e){a&&a.contentWindow&&a.contentWindow.postMessage(JSON.stringify({error:e}),"*")}));const s=new Promise(((e,n)=>{window.nolimit.info(t,(function(t){t.error?n(t):e(t)}))}));a.onload=function(){s.then((n=>{e.trigger("info",n),a.contentWindow.postMessage(JSON.stringify(n),"*");const i=o.createElement("script");i.src=n.staticRoot+"/game.js",e.nolimit=window.nolimit,e.nolimit.options=t,e.nolimit.options.loadStart=Date.now(),e.nolimit.options.version=n.version,e.nolimit.options.info=n,o.body.appendChild(i)})).catch((t=>{e.trigger("error",t.error),a.contentWindow.postMessage(JSON.stringify(t),"*")})),a.onload=function(){}},o.body.appendChild(a)}(o.contentWindow,e)))}throw"Invalid option target: "+t}function p(e){function t(){}return location.href=f(e),{on:t,call:t}}function f(e){const t=h(g(l,e));return r.replace("{CDN}",t.cdn).replace("{QUERY}",function(e){const t=[];for(let n in e){let o=e[n];void 0!==o&&(o instanceof HTMLElement||("object"==typeof o&&(o=JSON.stringify(o)),t.push(encodeURIComponent(n)+"="+encodeURIComponent(o))))}return t.join("&")}(t))}function m(e,t){!function(e,t){const n=[e.staticRoot,e.game.replace(/DX[0-9]+$/,"").replace(/[A-Z]{2}$/,"")];e.version&&n.push(e.version),n.push("info.json");const o=n.join("/"),i=new XMLHttpRequest;function r(){const e=i.statusText||"No error message available; CORS or server missing?";t({error:e})}i.open("GET",o,!0),i.onload=()=>{if(i.status>=200&&i.status<400)try{const n=JSON.parse(i.responseText);n.staticRoot=[e.staticRoot,n.name,n.version].join("/"),n.aspectRatio=n.size.width/n.size.height,n.infoJson=o,t(n)}catch(e){t({error:e.message})}else r()},i.onerror=r,i.send()}(e=h(g(l,e)),t)}function g(e,t){delete e.version,delete e.replay,delete e.token;const n={};for(let e in s)n[e]=s[e];for(let t in e)n[t]=e[t];for(let e in t)n[e]=t[e];return n}function h(e){e.device=e.device.toLowerCase(),e.mute=e.mute||!1;let t=e.environment.toLowerCase();return-1===t.indexOf(".")&&(t+=".nolimitcdn.com"),e.cdn=e.cdn||o.replace("{ENV}",t),e.staticRoot=e.staticRoot||a.replace("{CDN}",e.cdn),e.playForFunCurrency=e.playForFunCurrency||e.currency,"pe"!==e.language&&"cl"!==e.language||(e.language="es"),e}const w=function(){let e=1;return function(t){return t||"Nolimit-"+e++}}();return t})()));
//# sourceMappingURL=nolimit-1.2.86.js.map