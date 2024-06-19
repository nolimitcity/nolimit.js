import {nolimitApiFactory} from './nolimit-api';
import {loadInfo} from './info';
import nolimitCss from './nolimit.css';

const CDN = 'https://{ENV}';
const LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}';
const REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
const GAMES_URL = '{CDN}/games';

const DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': __VERSION__
};

/**
 * @property {String} version current version of nolimit.js
 */
export const version = __VERSION__;

let options = {};

/**
 * Initialize loader with default parameters. Can be skipped if the parameters are included in the call to load instead.
 *
 * @param {Object}  initOptions
 * @param {String}  initOptions.operator the operator code for the operator
 * @param {String}  [initOptions.language="en"] the language to use for the game
 * @param {String}  [initOptions.device=desktop] type of device: 'desktop' or 'mobile'. Recommended to always set this to make sure the correct device is used.
 * @param {String}  [initOptions.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
 * @param {Boolean} [initOptions.fullscreen=true] set to false to disable automatic fullscreen on mobile (Android only)
 * @param {Boolean} [initOptions.clock=true] set to false to disable in-game clock
 * @param {Boolean} [initOptions.autoplay=true] set to false to disable and remove the auto play button.
 * @param {Boolean} [initOptions.mute=false] start the game without sound
 * @param {Boolean} [initOptions.hideCurrency] hide currency symbols/codes in the game
 * @param {String}  [initOptions.quality] force asset quality. Possible values are 'high', 'medium', 'low'. Defaults to smart loading in each game.
 * @param {Object}  [initOptions.jurisdiction] force a specific jurisdiction to enforce specific license requirements and set specific options and overrides. See README for jurisdiction-specific details.
 * @param {Object}  [initOptions.jurisdiction.name] the name of the jurisdiction, for example "MT", "DK", "LV", "RO", "UKGC", "PT", "ES", "IT" or "SE".
 * @param {Object}  [initOptions.realityCheck] set options for reality check. See README for more details.
 * @param {Object}  [initOptions.realityCheck.enabled=true] set to false to disable reality-check dialog.
 * @param {Number}  [initOptions.realityCheck.interval=60] Interval in minutes between showing reality-check dialog.
 * @param {Number}  [initOptions.realityCheck.sessionStart=Date.now()] override session start, default is Date.now().
 * @param {Number}  [initOptions.realityCheck.nextTime] next time to show dialog, defaults to Date.now() + interval.
 * @param {Number}  [initOptions.realityCheck.bets=0] set initial bets if player already has bets in the session.
 * @param {Number}  [initOptions.realityCheck.winnings=0] set initial winnings if player already has winnings in the session.
 * @param {Number}  [initOptions.realityCheck.message] Message to display when dialog is opened. A generic default is provided.
 * @param {String}  [initOptions.playForFunCurrency=EUR] currency to use when in playing for fun mode. Uses EUR if not specified.
 * @param {Boolean} [initOptions.hideExitButton=false] set to true to control closing of mobile games from outside of game area.
 * @param {Boolean} [initOptions.showExitButtonDesktop=false] set to true to show exit button also in desktop mode.
 * @param {Boolean} [initOptions.useReplayLinkPopup=false] set to true to show a popup for loading replays instead of trying to open directly.
 * @param {Boolean} [initOptions.googleAnalytics=true] set to false to completely disable the use of analytics.
 * @param {String}  [initOptions.lobbyUrl="history:back()"] URL to redirect back to lobby on mobile, if not using a target
 * @param {String}  [initOptions.depositUrl] URL to deposit page, if not using a target element
 * @param {String}  [initOptions.supportUrl] URL to support page, if not using a target element
 * @param {Boolean} [initOptions.depositEvent] instead of using URL, emit "deposit" event (see event documentation)
 * @param {Boolean} [initOptions.lobbyEvent] instead of using URL, emit "lobby" event (see event documentation) (mobile only)
 * @param {String}  [initOptions.accountHistoryUrl] URL to support page, if not using a target element
 *
 * @example
 * nolimit.init({
 *    operator: 'SMOOTHOPERATOR',
 *    language: 'sv',
 *    device: 'mobile',
 *    environment: 'partner',
 *    currency: 'SEK',
 *    jurisdiction: {
 *        name: 'SE'
 *    },
 *    realityCheck: {
 *        interval: 30
 *    }
 * });
 */
export function init(initOptions) {
    window.nolimit.options = initOptions;
}

/**
 * Load game, replacing target with the game.
 *
 * <li> If target is a HTML element, it will be replaced with an iframe, keeping all the attributes of the original element, so those can be used to set id, classes, styles and more.
 * <li> If target is a Window element, the game will be loaded directly in that.
 * <li> If target is undefined, it will default to the current window.
 *
 * @param {Object} loadOptions see init for details
 * @see {@link init} for details on more options
 * @param {String}              loadOptions.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
 * @param {HTMLElement|Window}  [loadOptions.target=window] the HTMLElement or Window to load the game in
 * @param {String}              [loadOptions.token] the token to use for real money play
 * @param {String}              [loadOptions.version] force specific game version such as '1.2.3', or 'development' to disable cache
 *
 * @returns {nolimitApi}        The API connection to the opened game.
 *
 * @example
 * var api = nolimit.load({
 *    game: 'DragonTribe',
 *    target: document.getElementById('game'),
 *    token: realMoneyToken,
 *    mute: true
 * });
 */
export function load(loadOptions) {
    loadOptions = processOptions(mergeOptions(options, loadOptions));

    let target = loadOptions.target || window;

    if (target.Window && target instanceof target.Window) {
        target = document.createElement('div');
        target.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden;');
        document.body.appendChild(target);
    }

    if (target.ownerDocument && target instanceof target.ownerDocument.defaultView.HTMLElement) {
        const iframe = makeIframe(target);
        target.parentNode.replaceChild(iframe, target);

        return nolimitApiFactory(iframe, () => html(iframe.contentWindow, loadOptions));
    } else {
        throw 'Invalid option target: ' + target;
    }
}

/**
 * Load game in a new, separate page. This offers the best isolation, but no communication with the game is possible.
 *
 * @param {Object} replaceOptions see init for details
 * @see {@link init} for details on more options
 * @param {String}              replaceOptions.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
 * @param {String}              [replaceOptions.token] the token to use for real money play
 * @param {String}              [replaceOptions.version] force specific game version such as '1.2.3', or 'development' to disable cache
 *
 * @example
 * var api = nolimit.replace({
 *    game: 'DragonTribe',
 *    target: document.getElementById('game'),
 *    token: realMoneyToken,
 *    mute: true
 * });
 */
export function replace(replaceOptions) {
    location.href = url(replaceOptions);

    function noop() {
    }

    return {on: noop, call: noop};
}

/**
 * Constructs a URL for manually loading the game in an iframe or via redirect.

 * @param {Object} urlOptions see init for details
 * @see {@link init} for details on options
 * @return {string}
 */
export function url(urlOptions) {
    const gameOptions = processOptions(mergeOptions(options, urlOptions));
    return REPLACE_URL
        .replace('{CDN}', gameOptions.cdn)
        .replace('{QUERY}', makeQueryString(gameOptions));
}

/**
 * Load information about the game, such as: current version, preferred width/height etc.
 *
 * @param {Object}      infoOptions
 * @param {String}      [infoOptions.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
 * @param {String}      infoOptions.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
 * @param {String}      [infoOptions.version] force specific version of game to load.
 * @param {Function}    callback  called with the info object, if there was an error, the 'error' field will be set
 *
 * @example
 * nolimit.info({game: 'DragonTribe'}, function(info) {
 *     var target = document.getElementById('game');
 *     target.style.width = info.size.width + 'px';
 *     target.style.height = info.size.height + 'px';
 *     console.log(info.name, info.version);
 * });
 */
export function info(infoOptions, callback) {
    infoOptions = processOptions(mergeOptions(options, infoOptions));
    loadInfo(infoOptions, callback);
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
    iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups');

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
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
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
    optionsToProcess.playForFunCurrency = optionsToProcess.playForFunCurrency || optionsToProcess.currency;
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
            loaderElement.contentWindow.postMessage(JSON.stringify({'error': error}), '*');
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
        infoPromise.then(info => {
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
        }).catch(info => {
            contentWindow.trigger('error', info.error);
            loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
        });
        loaderElement.onload = function () {
        };
    };

    document.body.appendChild(loaderElement);
}

function copyAttributes(from, to) {
    const attributes = from.attributes;
    for (let i = 0; i < attributes.length; i++) {
        let attr = attributes[i];
        to.setAttribute(attr.name, attr.value);
    }
}

const generateName = (function () {
    let generatedIndex = 1;
    return function (name) {
        return name || 'Nolimit-' + generatedIndex++;
    };
})();

