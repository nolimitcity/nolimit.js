'use strict';

var nolimitApiFactory = require('./nolimit-api');

var CDN = 'https://{ENV}.nolimitcdn.com';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html';
var GAMES_URL = '{CDN}/games';
var GAME_JS_URL = '/{GAME}/game.js';

var DEFAULT_OPTIONS = {
    currency: 'EUR',
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    loader: 'nolimit.js'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * Initialize loader with default parameters. Can be skipped if the parameters are included in the call to load instead.
     *
     * @param {Object}  options
     * @param {String}  options.operator the operator code for the operator
     * @param {String}  [options.language="en"] the language to use for the game
     * @param {String}  [options.device=desktop] type of device: 'desktop' or 'mobile'
     * @param {String}  [options.environment=partner] which environment to use; usually 'partner' or 'production'
     * @param {String}  [options.currency=EUR] currency to use, if not provided by server
     */
    init: function (options) {
        this.options = options;
    },


    /**
     * Load game, replacing target with the game.
     *
     * <li> If target is a HTML element, it will be replaced with an iframe, keeping all the attributes of the original element, so those can be used to set id, classes, styles and more.
     * <li> If target is a Window element, the game will be loaded directly in that.
     * <li> If target is undefined, it will default to the current window.
     *
     * @param {Object}              options
     * @param {String}              options.game case sensitive game code, for example 'CreepyCarnival' or 'SpaceArcade'
     * @param {HTMLElement|Window}  [options.target=window] the HTMLElement or Window to load the game in
     * @param {String}              [options.token=undefined] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {Object}              [options.events={}] events from within the game
     */
    load: function (options) {
        var target = options.target || window;
        options.mute = options.mute || false;

        var allOptions = mergeOptions(this.options, options);

        if (target instanceof HTMLElement) {
            var iframe = makeIframe(target);

            iframe.addEventListener('load', function () {
                html(iframe.contentWindow, allOptions);
            });

            var iframeConnection = nolimitApiFactory(iframe);

            target.parentNode.replaceChild(iframe, target);
            return iframeConnection;

        } else if (target.Window && target instanceof target.Window) {

            var windowConnection = nolimitApiFactory(target);
            html(target, allOptions);
            return windowConnection;

        } else {
            throw 'Invalid option target: ' + target;
        }
    }
};

function makeIframe(element) {
    var iframe = document.createElement('iframe');
    copyAttributes(element, iframe);

    iframe.setAttribute('frameBorder', '0');
    var name = generateName(iframe.getAttribute('name') || iframe.id);
    iframe.setAttribute('name', name);

    iframe.style.display = getComputedStyle(element).display;

    return iframe;
}

function mergeOptions(globalOptions, gameOptions) {
    var options = {}, name;
    for (name in DEFAULT_OPTIONS) {
        options[name] = DEFAULT_OPTIONS[name];
    }
    for (name in globalOptions) {
        options[name] = globalOptions[name];
    }
    for (name in gameOptions) {
        options[name] = gameOptions[name];
    }
    return options;
}

function insertCss(document) {
    var style = document.createElement('style');
    style.textContent = require('./nolimit.css');
    document.head.appendChild(style);
}

function setupViewport(head) {
    var viewport = head.querySelector('meta[name="viewport"]');
    if (!viewport) {
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1">');
    }
}

function html(window, options) {

    var document = window.document;
    var body = document.body;

    insertCss(document);
    setupViewport(document.head);

    var loaderElement = document.createElement('iframe');
    loaderElement.setAttribute('frameBorder', '0');
    loaderElement.style.backgroundColor = 'black';
    loaderElement.style.width = '100vw';
    loaderElement.style.height = '100vh';
    loaderElement.style.zIndex = '2147483647';

    var cdn = CDN.replace('{ENV}', options.environment.toLowerCase());
    loaderElement.src = LOADER_URL.replace('{CDN}', cdn).replace('{DEVICE}', options.device.toLowerCase());

    window.nolimit = window.nolimit || {};
    
    window.nolimit.options = options;

    var development = window.nolimit.development || JSON.parse(sessionStorage.getItem('nolimit.development'));
    if(development) {
        window.nolimit.development = development;
        console.log('window.nolimit', window.nolimit);
    }
    
    var gameElement = document.createElement('script');

    var staticRoot = options.staticRoot || GAMES_URL.replace('{CDN}', cdn);
    gameElement.src = staticRoot + GAME_JS_URL.replace('{GAME}', options.game);

    body.innerHTML = '';

    loaderElement.onload = function () {
        body.appendChild(gameElement);
    };

    body.appendChild(loaderElement);
}

function copyAttributes(from, to) {
    var attributes = from.attributes;
    for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        to.setAttribute(attr.name, attr.value);
    }
}

var generateName = (function () {
    var generatedIndex = 1;
    return function (name) {
        return name || 'Nolimit-' + generatedIndex++;
    };
})();

console.log('nolimit.js', '__VERSION__');

module.exports = nolimit;
