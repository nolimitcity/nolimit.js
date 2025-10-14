/**
 * @module nolimit
 */
import { nolimitApiFactory } from './nolimit-api';
import { loadInfo } from './info';
import nolimitCss from './nolimit.css';

const CDN = 'https://{ENV}';
const LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}';
const REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
const GAMES_URL = '{CDN}/games';

// Flobby assets (IIFE exposes window.Flobby.init)
const FLOBBY_CSS_URL = 'http://localhost:4173/flobby.css';
const FLOBBY_JS_URL = 'http://localhost:4173/flobby.js';

const DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': __VERSION__,
};

export const version = __VERSION__;
let options = {};

/* ========== Public API ========== */

export function init(initOptions) {
    options = window.nolimit.options = initOptions;
}

export function load(loadOptions) {
    loadOptions = processOptions(mergeOptions(options, loadOptions));

    let target = loadOptions.target || window;

    if (target.Window && target instanceof target.Window) {
        target = document.createElement('div');
        target.setAttribute('style', 'position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;');
        document.body.appendChild(target);
    }

    if (target.ownerDocument && target instanceof target.ownerDocument.defaultView.HTMLElement) {
        const gameFrame = makeIframe(target);
        target.parentNode.replaceChild(gameFrame, target);

        return nolimitApiFactory(gameFrame, () => {
            html(gameFrame.contentWindow, loadOptions);
            mountLauncherInsideGame(gameFrame, FLOBBY_CSS_URL, FLOBBY_JS_URL);
        });
    }

    throw 'Invalid option target: ' + target;
}

export function replace(replaceOptions) {
    location.href = url(replaceOptions);
    const noop = () => {
    };
    return { on: noop, call: noop };
}

export function url(urlOptions) {
    const gameOptions = processOptions(mergeOptions(options, urlOptions));
    return REPLACE_URL.replace('{CDN}', gameOptions.cdn).replace('{QUERY}', makeQueryString(gameOptions));
}

export function info(infoOptions, callback) {
    infoOptions = processOptions(mergeOptions(options, infoOptions));
    loadInfo(infoOptions, callback);
}

/* ========== Internals ========== */

function mountLauncherInsideGame(gameFrame, cssUrl, jsUrl) {
    const gameDoc = gameFrame.contentDocument || gameFrame.contentWindow?.document;
    if (!gameDoc) {
        return;
    }

    const ensure = () => {
        if (!gameDoc.body) {
            return void setTimeout(ensure, 10);
        }
        if (!gameDoc.body.style.position) {
            gameDoc.body.style.position = 'relative';
        }

        // Small launcher iframe
        const launcherFrame = gameDoc.createElement('iframe');
        launcherFrame.title = 'Flobby Launcher';
        launcherFrame.setAttribute('frameBorder', '0');
        launcherFrame.setAttribute('allow', 'autoplay');
        launcherFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        launcherFrame.style.position = 'absolute';
        launcherFrame.style.top = '8px';
        launcherFrame.style.left = '8px';
        launcherFrame.style.width = '1px';
        launcherFrame.allowTransparency = true;
        launcherFrame.style.background = 'transparent';
        launcherFrame.style.backgroundColor = 'transparent'; // some engines
// optional legacy flag (non-standard, harmless)
        launcherFrame.setAttribute('allowTransparency', 'true');
        launcherFrame.style.pointerEvents = 'auto';
        launcherFrame.style.zIndex = '2147483648';

        gameDoc.body.appendChild(launcherFrame);
        writeLauncherDoc(launcherFrame, cssUrl, jsUrl);
    };
    ensure();
}

function writeLauncherDoc(launcherFrame, cssUrl, jsUrl) {
    const doc = launcherFrame.contentDocument || launcherFrame.contentWindow?.document;
    if (!doc) {
        return;
    }

    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  html,body{margin:0;pointer-events: auto;}
  .nlc-flobby-launcher{
    display:inline-flex;align-items:center;justify-content:center;
    width:48px;height:48px;border-radius:9999px;
    border:2px solid #111;background:rgba(0,0,0,.2);backdrop-filter:saturate(120%) blur(4px);
    cursor:pointer;user-select:none;font:600 12px/1 system-ui;color:#fff;
    pointer-events: auto;
  }
  .nlc-flobby-launcher:active{transform:scale(.98)}
</style>
</head>
<body>
  <button id="nlc-flobby-launcher" class="nlc-flobby-launcher" title="Open Playin">▶</button>
</body>
</html>`);
    doc.close();

    const btn = doc.getElementById('nlc-flobby-launcher');
    const sizeToButton = () => {
        const r = btn.getBoundingClientRect();
        launcherFrame.style.width = Math.ceil(r.width) + 'px';
        launcherFrame.style.height = Math.ceil(r.height) + 'px';
    };
    sizeToButton();

    btn.addEventListener('click', () => {
        expandToFull(launcherFrame);
        bootFlobbyInExistingFrame(launcherFrame, cssUrl, jsUrl);
    });
}

function expandToFull(frameEl) {
    frameEl.style.position = 'absolute';
    frameEl.style.inset = '0';
    frameEl.style.width = '100%';
    frameEl.style.height = '100%';
    frameEl.style.top = '0';
    frameEl.style.left = '0';
}

function bootFlobbyInExistingFrame(frameEl, cssUrl, jsUrl) {
    const doc = frameEl.contentDocument || frameEl.contentWindow?.document;
    if (!doc) {
        return;
    }

    // Replace launcher document with full flobby root
    doc.open();
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="${cssUrl}">
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{
    margin:0;
    width:100%;
    height:100%;
    background:transparent !important;
    color-scheme: light only; /* prevents UA dark backgrounds */
  }
  #flobby-root{
    position:relative;
    width:100%;
    height:100%;
    overflow:visible;
  }
</style>
</head>
<body>
  <div id="flobby-root"></div>
</body>
</html>`);
    doc.close();

    const script = doc.createElement('script');
    script.src = jsUrl;
    script.async = true;
    script.onload = () => {
        const win = frameEl.contentWindow;
        const root = doc.getElementById('flobby-root');
        if (win && win.Flobby && typeof win.Flobby.init === 'function') {
            win.Flobby.init(root);
            // root.addEventListener('mousedown', () => frameEl.contentWindow?.focus());
        } else {
            console.error('Flobby.init not found');
        }
    };
    script.onerror = () => console.error('Failed to load Flobby script:', jsUrl);
    doc.body.appendChild(script);
}

function makeQueryString(makeQueryStringOptions) {
    const query = [];
    for (let key in makeQueryStringOptions) {
        let value = makeQueryStringOptions[key];
        if (typeof value === 'undefined') {
            continue;
        }
        if (value instanceof HTMLElement) {
            continue;
        }
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
    return query.join('&');
}

function makeIframe(element) {
    const iframe = document.createElement('iframe');
    copyAttributes(element, iframe);

    iframe.setAttribute('frameBorder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute(
        'sandbox',
        'allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups'
    );

    const name = generateName(iframe.getAttribute('name') || iframe.id);
    iframe.setAttribute('name', name);

    return iframe;
}

function mergeOptions(globalOptions, gameOptions) {
    delete globalOptions.version;
    delete globalOptions.replay;
    delete globalOptions.token;
    const result = {};
    for (let name in DEFAULT_OPTIONS) {
        result[name] = DEFAULT_OPTIONS[name];
    }
    for (let name in globalOptions) {
        result[name] = globalOptions[name];
    }
    for (let name in gameOptions) {
        result[name] = gameOptions[name];
    }
    return result;
}

function insertCss(document) {
    const style = document.createElement('style');
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(nolimitCss));
}

function setupViewport(head) {
    const viewport = head.querySelector('meta[name="viewport"]');
    if (!viewport) {
        head.insertAdjacentHTML(
            'beforeend',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
        );
    }
}

function processOptions(optionsToProcess) {
    optionsToProcess.device = optionsToProcess.device.toLowerCase();
    optionsToProcess.mute = optionsToProcess.mute || false;
    let environment = optionsToProcess.environment.toLowerCase();
    if (environment.indexOf('.') === -1) {
        environment += '.nolimitcdn.com';
    }
    optionsToProcess.cdn = optionsToProcess.cdn || CDN.replace('{ENV}', environment);
    optionsToProcess.staticRoot = optionsToProcess.staticRoot || GAMES_URL.replace('{CDN}', optionsToProcess.cdn);
    optionsToProcess.playForFunCurrency =
        optionsToProcess.playForFunCurrency || optionsToProcess.currency;
    if (optionsToProcess.language === 'pe' || optionsToProcess.language === 'cl') {
        optionsToProcess.language = 'es';
    }
    return optionsToProcess;
}

function html(contentWindow, htmlOptions) {
    const document = contentWindow.document;

    contentWindow.focus();

    insertCss(document);
    setupViewport(document.head);

    const loaderElement = document.createElement('iframe');
    loaderElement.setAttribute('frameBorder', '0');
    loaderElement.style.backgroundColor = 'black';
    loaderElement.style.width = '100vw';
    loaderElement.style.height = '100vh';
    loaderElement.style.position = 'relative';
    loaderElement.style.zIndex = '2147483647';
    loaderElement.classList.add('loader');

    loaderElement.src = LOADER_URL
        .replace('{CDN}', htmlOptions.cdn)
        .replace('{DEVICE}', htmlOptions.device)
        .replace('{OPERATOR}', htmlOptions.operator)
        .replace('{GAME}', htmlOptions.game)
        .replace('{LANGUAGE}', htmlOptions.language);

    document.body.innerHTML = '';

    contentWindow.on('error', function (error) {
        if (loaderElement && loaderElement.contentWindow) {
            loaderElement.contentWindow.postMessage(JSON.stringify({ error: error }), '*');
        }
    });

    const infoPromise = new Promise((resolve, reject) => {
        window.nolimit.info(htmlOptions, function (info) {
            if (info.error) {
                reject(info);
            } else {
                resolve(info);
            }
        });
    });

    loaderElement.onload = function () {
        infoPromise
            .then((info) => {
                contentWindow.trigger('info', info);
                loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
                const gameElement = document.createElement('script');
                gameElement.src = info.staticRoot + '/game.js';
                contentWindow.nolimit = window.nolimit;
                contentWindow.nolimit.options = htmlOptions;
                contentWindow.nolimit.options.loadStart = Date.now();
                contentWindow.nolimit.options.version = info.version;
                contentWindow.nolimit.options.info = info;
                document.body.appendChild(gameElement);
            })
            .catch((info) => {
                contentWindow.trigger('error', info.error);
                loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
            });
        loaderElement.onload = function () {
        };
    };

    document.body.appendChild(loaderElement);
}

function copyAttributes(from, to) {
    const attributes = from?.attributes || [];
    for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        to.setAttribute(attr.name, attr.value);
    }
}

const generateName = (function () {
    let generatedIndex = 1;
    return function (name) {
        return name || 'Nolimit-' + generatedIndex++;
    };
})();