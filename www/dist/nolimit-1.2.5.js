(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nolimit = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var INFO_JSON_URL = '/{GAME}/info.json';

var cache = {};

var info = {
    load: function(options, callback) {
        var url = options.staticRoot + INFO_JSON_URL.replace('{GAME}', options.game);

        var info = cache[url];
        if(info) {
            info.version = options.version || info.version;
            return callback(info);
        }

        var request = new XMLHttpRequest();

        function onFail() {
            var error = request.statusText || 'No error message available; probably a CORS issue.';
            callback({
                error: error
            });
        }

        request.open('GET', url, true);

        request.onload = function() {
            if(request.status >= 200 && request.status < 400) {
                try {
                    var info = JSON.parse(request.responseText);
                    info.version = options.version || info.version;
                    info.staticRoot = [options.staticRoot, info.name, info.version].join('/');
                    info.aspectRatio = info.size.width / info.size.height;
                    cache[url] = info;
                    callback(info);
                } catch(e) {
                    callback({
                        error: e.message
                    });
                }
            } else {
                onFail();
            }
        };

        request.onerror = onFail;

        request.send();
    }
};

module.exports = info;

},{}],2:[function(require,module,exports){
'use strict';

/**
 * @exports nolimitApiFactory
 * @private
 */
var nolimitApiFactory = function(target, onload) {

    var listeners = {};
    var unhandledEvents = {};
    var unhandledCalls = [];
    var port;

    function handleUnhandledCalls(port) {
        while(unhandledCalls.length > 0) {
            port.postMessage(unhandledCalls.shift());
        }
    }

    function addMessageListener(gameWindow) {
        gameWindow.addEventListener('message', function(e) {
            if(e.ports && e.ports.length > 0) {
                port = e.ports[0];
                port.onmessage = onMessage;
                registerEvents(Object.keys(listeners));
                handleUnhandledCalls(port);
            }
        });
        gameWindow.trigger = trigger;
        gameWindow.on = on;
        onload();
    }

    if(target.nodeName === 'IFRAME') {
        target.addEventListener('load', function() {
            addMessageListener(target.contentWindow);
        });
    } else {
        addMessageListener(target);
    }

    function onMessage(e) {
        trigger(e.data.method, e.data.params);
    }

    function sendMessage(method, data) {
        var message = {
            jsonrpc: '2.0',
            method: method
        };

        if(data) {
            message.params = data;
        }

        if(port) {
            try {
                port.postMessage(message);
            } catch(ignored) {
                port = undefined;
                unhandledCalls.push(message);
            }
        } else {
            unhandledCalls.push(message);
        }
    }

    function registerEvents(events) {
        sendMessage('register', events);
    }

    function trigger(event, data) {
        if(listeners[event]) {
            listeners[event].forEach(function(callback) {
                callback(data);
            });
        } else {
            unhandledEvents[name] = unhandledEvents[name] || [];
            unhandledEvents[name].push(data);
        }
    }

    function on(event, callback) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(callback);
        while(unhandledEvents[event] && unhandledEvents[event].length > 0) {
            trigger(event, unhandledEvents[event].pop());
        }

        registerEvents([event]);
    }

    /**
     * Connection to the game using MessageChannel
     * @exports nolimitApi
     */
    var nolimitApi = {
        /**
         * Add listener for event from the started game
         *
         * @function on
         * @param {String}   event    name of the event
         * @param {Function} callback callback for the event, see specific event documentation for any parameters
         *
         * @example
         * api.on('deposit', function openDeposit () {
         *     showDeposit().then(function() {
         *         // ask the game to refresh balance from server
         *         api.call('refresh');
         *     });
         * });
         */
        on: on,

        /**
         * Call method in the open game
         *
         * @function call
         * @param {String} method name of the method to call
         * @param {Object} [data] optional data for the method called, if any
         *
         * @example
         * // reload the game
         * api.call('reload');
         */
        call: sendMessage
    };

    return nolimitApi;
};

module.exports = nolimitApiFactory;

},{}],3:[function(require,module,exports){
module.exports = 'html, body {\n    overflow: hidden;\n    margin: 0;\n    width: 100%;\n    height: 100%;\n}\n\nbody {\n    position: relative;\n}\n';
},{}],4:[function(require,module,exports){
'use strict';

var nolimitApiFactory = require('./nolimit-api');
var info = require('./info');

var CDN = '{PROTOCOL}//{ENV}';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}';
var REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
var GAMES_URL = '{CDN}/games';
var GAME_JS_URL = '/{GAME}{VERSION}/game.js';

var DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': '1.2.5'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.5',

    options: {},

    /**
     * Initialize loader with default parameters. Can be skipped if the parameters are included in the call to load instead.
     *
     * @param {Object}  options
     * @param {String}  options.operator the operator code for the operator
     * @param {String}  [options.language="en"] the language to use for the game
     * @param {String}  [options.device=desktop] type of device: 'desktop' or 'mobile'
     * @param {String}  [options.environment=partner] which environment to use; usually 'partner' or 'production'
     * @param {String}  [options.currency=EUR] currency to use, if not provided by server
     *
     * @example
     * nolimit.init({
     *    operator: 'SMOOTHOPERATOR',
     *    language: 'sv',
     *    device: 'mobile',
     *    environment: 'production',
     *    currency: 'SEK'
     * });
     */
    init: function(options) {
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
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     * @param {Boolean}             [options.hideCurrency] hide currency symbols/codes in the game
     *
     * @returns {nolimitApi}        The API connection to the opened game.
     *
     * @example
     * var api = nolimit.load({
     *    game: 'SpaceArcade',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    load: function(options) {
        var target = options.target || window;

        var gameOptions = processOptions(mergeOptions(this.options, options));

        if(target.Window && target instanceof target.Window) {
            target = document.createElement('div');
            target.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden;');
            document.body.appendChild(target);
        }

        if(target instanceof HTMLElement) {
            var iframe = makeIframe(target);

            var iframeConnection = nolimitApiFactory(iframe, function() {
                html(iframe.contentWindow, gameOptions);
            });

            target.parentNode.replaceChild(iframe, target);
            return iframeConnection;
        } else {
            throw 'Invalid option target: ' + target;
        }
    },

    /**
     * Load game in a new, separate page. This offers the best isolation, but no communication with the game is possible.
     *
     * @param {Object}              options
     * @param {String}              options.game case sensitive game code, for example 'CreepyCarnival' or 'SpaceArcade'
     * @param {HTMLElement|Window}  [options.target] the HTMLElement or Window to load the game in
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     * @param {Boolean}             [options.hideCurrency] hide currency symbols/codes in the game
     * @param {String}              [options.lobbyUrl="history:back()"] URL to redirect back to lobby on mobile, if not using a target
     * @param {String}              [options.depositUrl] URL to deposit page, if not using a target element
     * @param {String}              [options.supportUrl] URL to support page, if not using a target element
     *
     * @example
     * var api = nolimit.load({
     *    game: 'SpaceArcade',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    replace: function(options) {
        var gameOptions = processOptions(mergeOptions(this.options, options));
        location.href = REPLACE_URL
            .replace('{CDN}', gameOptions.cdn)
            .replace('{QUERY}', makeQueryString(gameOptions));
    },

    /**
     * Load information about the game, such as: current version, preferred width/height etc.
     *
     * @param {Object}      options
     * @param {String}      [options.environment=partner] which environment to use; usually 'partner' or 'production'
     * @param {String}      options.game case sensitive game code, for example 'CreepyCarnival' or 'SpaceArcade'
     * @param {Function}    callback  called with the info object, if there was an error, the 'error' field will be set
     *
     * @example
     * nolimit.info({game: 'SpaceArcade'}, function(info) {
     *     var target = document.getElementById('game');
     *     target.style.width = info.size.width + 'px';
     *     target.style.height = info.size.height + 'px';
     *     console.log(info.name, info.version);
     * });
     */
    info: function(options, callback) {
        options = processOptions(mergeOptions(this.options, options));
        info.load(options, callback);
    }
};

function makeQueryString(options) {
    var query = [];
    for(var key in options) {
        var value = options[key];
        if(typeof value === 'object') {
            value = JSON.stringify(value);
        }
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
    return query.join('&');
}

function makeIframe(element) {
    var iframe = document.createElement('iframe');
    copyAttributes(element, iframe);

    iframe.setAttribute('frameBorder', '0');
    iframe.setAttribute('allowfullscreen', '');

    var name = generateName(iframe.getAttribute('name') || iframe.id);
    iframe.setAttribute('name', name);

    return iframe;
}

function mergeOptions(globalOptions, gameOptions) {
    var options = {}, name;
    for(name in DEFAULT_OPTIONS) {
        options[name] = DEFAULT_OPTIONS[name];
    }
    for(name in globalOptions) {
        options[name] = globalOptions[name];
    }
    for(name in gameOptions) {
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
    if(!viewport) {
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
    }
}

function processOptions(options) {
    options.device = options.device.toLowerCase();
    options.mute = options.mute || false;
    var environment = options.environment.toLowerCase();
    if(environment.indexOf('.') === -1) {
        environment += '.nolimitcdn.com';
    }
    options.cdn = CDN.replace('{PROTOCOL}', location.protocol).replace('{ENV}', environment);
    options.staticRoot = options.staticRoot || GAMES_URL.replace('{CDN}', options.cdn);
    return options;
}

function html(window, options) {
    var document = window.document;

    window.focus();

    insertCss(document);
    setupViewport(document.head);

    var loaderElement = document.createElement('iframe');
    loaderElement.setAttribute('frameBorder', '0');
    loaderElement.style.backgroundColor = 'black';
    loaderElement.style.width = '100vw';
    loaderElement.style.height = '100vh';
    loaderElement.style.position = 'relative';
    loaderElement.style.zIndex = '2147483647';
    loaderElement.classList.add('loader');

    loaderElement.src = LOADER_URL
        .replace('{CDN}', options.cdn)
        .replace('{DEVICE}', options.device)
        .replace('{OPERATOR}', options.operator)
        .replace('{GAME}', options.game);

    document.body.innerHTML = '';

    loaderElement.onload = function() {
        window.on('error', function(error) {
            if(loaderElement && loaderElement.contentWindow) {
                loaderElement.contentWindow.postMessage(JSON.stringify({'error': error}), '*');
            }
        });

        if(options.weinre) {
            var weinre = document.createElement('script');
            weinre.src = options.weinre;
            document.body.appendChild(weinre);
        }

        nolimit.info(options, function(info) {
            if(info.error) {
                window.trigger('error', info.error);
                loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
            } else {
                window.trigger('info', info);

                var version = /^\d+\.\d+\.\d+$/.test(info.version) ? '/' + info.version : '';

                var gameElement = document.createElement('script');
                gameElement.src = options.staticRoot + GAME_JS_URL.replace('{GAME}', options.game).replace('{VERSION}', version);

                options.loadStart = Date.now();
                window.nolimit = window.nolimit || {};
                window.nolimit.options = options;

                document.body.appendChild(gameElement);
            }
        });
    };

    document.body.appendChild(loaderElement);
}

function copyAttributes(from, to) {
    var attributes = from.attributes;
    for(var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        to.setAttribute(attr.name, attr.value);
    }
}

var generateName = (function() {
    var generatedIndex = 1;
    return function(name) {
        return name || 'Nolimit-' + generatedIndex++;
    };
})();

module.exports = nolimit;

},{"./info":1,"./nolimit-api":2,"./nolimit.css":3}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIElORk9fSlNPTl9VUkwgPSAnL3tHQU1FfS9pbmZvLmpzb24nO1xuXG52YXIgY2FjaGUgPSB7fTtcblxudmFyIGluZm8gPSB7XG4gICAgbG9hZDogZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHVybCA9IG9wdGlvbnMuc3RhdGljUm9vdCArIElORk9fSlNPTl9VUkwucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKTtcblxuICAgICAgICB2YXIgaW5mbyA9IGNhY2hlW3VybF07XG4gICAgICAgIGlmKGluZm8pIHtcbiAgICAgICAgICAgIGluZm8udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvbiB8fCBpbmZvLnZlcnNpb247XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soaW5mbyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRmFpbCgpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IHJlcXVlc3Quc3RhdHVzVGV4dCB8fCAnTm8gZXJyb3IgbWVzc2FnZSBhdmFpbGFibGU7IHByb2JhYmx5IGEgQ09SUyBpc3N1ZS4nO1xuICAgICAgICAgICAgY2FsbGJhY2soe1xuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvclxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmKHJlcXVlc3Quc3RhdHVzID49IDIwMCAmJiByZXF1ZXN0LnN0YXR1cyA8IDQwMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmZvID0gSlNPTi5wYXJzZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvbiB8fCBpbmZvLnZlcnNpb247XG4gICAgICAgICAgICAgICAgICAgIGluZm8uc3RhdGljUm9vdCA9IFtvcHRpb25zLnN0YXRpY1Jvb3QsIGluZm8ubmFtZSwgaW5mby52ZXJzaW9uXS5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uYXNwZWN0UmF0aW8gPSBpbmZvLnNpemUud2lkdGggLyBpbmZvLnNpemUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBjYWNoZVt1cmxdID0gaW5mbztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soaW5mbyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvbkZhaWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBvbkZhaWw7XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbmZvO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRBcGlGYWN0b3J5XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSBmdW5jdGlvbih0YXJnZXQsIG9ubG9hZCkge1xuXG4gICAgdmFyIGxpc3RlbmVycyA9IHt9O1xuICAgIHZhciB1bmhhbmRsZWRFdmVudHMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkQ2FsbHMgPSBbXTtcbiAgICB2YXIgcG9ydDtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpIHtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkQ2FsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZSh1bmhhbmRsZWRDYWxscy5zaGlmdCgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE1lc3NhZ2VMaXN0ZW5lcihnYW1lV2luZG93KSB7XG4gICAgICAgIGdhbWVXaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGlmKGUucG9ydHMgJiYgZS5wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IGUucG9ydHNbMF07XG4gICAgICAgICAgICAgICAgcG9ydC5vbm1lc3NhZ2UgPSBvbk1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgcmVnaXN0ZXJFdmVudHMoT2JqZWN0LmtleXMobGlzdGVuZXJzKSk7XG4gICAgICAgICAgICAgICAgaGFuZGxlVW5oYW5kbGVkQ2FsbHMocG9ydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBnYW1lV2luZG93LnRyaWdnZXIgPSB0cmlnZ2VyO1xuICAgICAgICBnYW1lV2luZG93Lm9uID0gb247XG4gICAgICAgIG9ubG9hZCgpO1xuICAgIH1cblxuICAgIGlmKHRhcmdldC5ub2RlTmFtZSA9PT0gJ0lGUkFNRScpIHtcbiAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFkZE1lc3NhZ2VMaXN0ZW5lcih0YXJnZXQuY29udGVudFdpbmRvdyk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFkZE1lc3NhZ2VMaXN0ZW5lcih0YXJnZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTWVzc2FnZShlKSB7XG4gICAgICAgIHRyaWdnZXIoZS5kYXRhLm1ldGhvZCwgZS5kYXRhLnBhcmFtcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2VuZE1lc3NhZ2UobWV0aG9kLCBkYXRhKSB7XG4gICAgICAgIHZhciBtZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBtZXRob2Q6IG1ldGhvZFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgICAgIG1lc3NhZ2UucGFyYW1zID0gZGF0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHBvcnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gY2F0Y2goaWdub3JlZCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdW5oYW5kbGVkQ2FsbHMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlckV2ZW50cyhldmVudHMpIHtcbiAgICAgICAgc2VuZE1lc3NhZ2UoJ3JlZ2lzdGVyJywgZXZlbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIGlmKGxpc3RlbmVyc1tldmVudF0pIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc1tldmVudF0uZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0gPSB1bmhhbmRsZWRFdmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdID0gbGlzdGVuZXJzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkRXZlbnRzW2V2ZW50XSAmJiB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyaWdnZXIoZXZlbnQsIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ucG9wKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVnaXN0ZXJFdmVudHMoW2V2ZW50XSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdGlvbiB0byB0aGUgZ2FtZSB1c2luZyBNZXNzYWdlQ2hhbm5lbFxuICAgICAqIEBleHBvcnRzIG5vbGltaXRBcGlcbiAgICAgKi9cbiAgICB2YXIgbm9saW1pdEFwaSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBsaXN0ZW5lciBmb3IgZXZlbnQgZnJvbSB0aGUgc3RhcnRlZCBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBvblxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gICBldmVudCAgICBuYW1lIG9mIHRoZSBldmVudFxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBjYWxsYmFjayBmb3IgdGhlIGV2ZW50LCBzZWUgc3BlY2lmaWMgZXZlbnQgZG9jdW1lbnRhdGlvbiBmb3IgYW55IHBhcmFtZXRlcnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogYXBpLm9uKCdkZXBvc2l0JywgZnVuY3Rpb24gb3BlbkRlcG9zaXQgKCkge1xuICAgICAgICAgKiAgICAgc2hvd0RlcG9zaXQoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgKiAgICAgICAgIC8vIGFzayB0aGUgZ2FtZSB0byByZWZyZXNoIGJhbGFuY2UgZnJvbSBzZXJ2ZXJcbiAgICAgICAgICogICAgICAgICBhcGkuY2FsbCgncmVmcmVzaCcpO1xuICAgICAgICAgKiAgICAgfSk7XG4gICAgICAgICAqIH0pO1xuICAgICAgICAgKi9cbiAgICAgICAgb246IG9uLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIG1ldGhvZCBpbiB0aGUgb3BlbiBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2QgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSBvcHRpb25hbCBkYXRhIGZvciB0aGUgbWV0aG9kIGNhbGxlZCwgaWYgYW55XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIHJlbG9hZCB0aGUgZ2FtZVxuICAgICAgICAgKiBhcGkuY2FsbCgncmVsb2FkJyk7XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsOiBzZW5kTWVzc2FnZVxuICAgIH07XG5cbiAgICByZXR1cm4gbm9saW1pdEFwaTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdEFwaUZhY3Rvcnk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICdodG1sLCBib2R5IHtcXG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcXG4gICAgbWFyZ2luOiAwO1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAxMDAlO1xcbn1cXG5cXG5ib2R5IHtcXG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xcbn1cXG4nOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gcmVxdWlyZSgnLi9ub2xpbWl0LWFwaScpO1xudmFyIGluZm8gPSByZXF1aXJlKCcuL2luZm8nKTtcblxudmFyIENETiA9ICd7UFJPVE9DT0x9Ly97RU5WfSc7XG52YXIgTE9BREVSX1VSTCA9ICd7Q0ROfS9sb2FkZXIvbG9hZGVyLXtERVZJQ0V9Lmh0bWw/b3BlcmF0b3I9e09QRVJBVE9SfSZnYW1lPXtHQU1FfSc7XG52YXIgUkVQTEFDRV9VUkwgPSAne0NETn0vbG9hZGVyL2dhbWUtbG9hZGVyLmh0bWw/e1FVRVJZfSc7XG52YXIgR0FNRVNfVVJMID0gJ3tDRE59L2dhbWVzJztcbnZhciBHQU1FX0pTX1VSTCA9ICcve0dBTUV9e1ZFUlNJT059L2dhbWUuanMnO1xuXG52YXIgREVGQVVMVF9PUFRJT05TID0ge1xuICAgIGRldmljZTogJ2Rlc2t0b3AnLFxuICAgIGVudmlyb25tZW50OiAncGFydG5lcicsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgJ25vbGltaXQuanMnOiAnMS4yLjUnXG59O1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRcbiAqL1xudmFyIG5vbGltaXQgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge1N0cmluZ30gdmVyc2lvbiBjdXJyZW50IHZlcnNpb24gb2Ygbm9saW1pdC5qc1xuICAgICAqL1xuICAgIHZlcnNpb246ICcxLjIuNScsXG5cbiAgICBvcHRpb25zOiB7fSxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgbG9hZGVyIHdpdGggZGVmYXVsdCBwYXJhbWV0ZXJzLiBDYW4gYmUgc2tpcHBlZCBpZiB0aGUgcGFyYW1ldGVycyBhcmUgaW5jbHVkZWQgaW4gdGhlIGNhbGwgdG8gbG9hZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBvcHRpb25zLm9wZXJhdG9yIHRoZSBvcGVyYXRvciBjb2RlIGZvciB0aGUgb3BlcmF0b3JcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmxhbmd1YWdlPVwiZW5cIl0gdGhlIGxhbmd1YWdlIHRvIHVzZSBmb3IgdGhlIGdhbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmRldmljZT1kZXNrdG9wXSB0eXBlIG9mIGRldmljZTogJ2Rlc2t0b3AnIG9yICdtb2JpbGUnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuY3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2UsIGlmIG5vdCBwcm92aWRlZCBieSBzZXJ2ZXJcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbml0KHtcbiAgICAgKiAgICBvcGVyYXRvcjogJ1NNT09USE9QRVJBVE9SJyxcbiAgICAgKiAgICBsYW5ndWFnZTogJ3N2JyxcbiAgICAgKiAgICBkZXZpY2U6ICdtb2JpbGUnLFxuICAgICAqICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICogICAgY3VycmVuY3k6ICdTRUsnXG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUsIHJlcGxhY2luZyB0YXJnZXQgd2l0aCB0aGUgZ2FtZS5cbiAgICAgKlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgSFRNTCBlbGVtZW50LCBpdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gaWZyYW1lLCBrZWVwaW5nIGFsbCB0aGUgYXR0cmlidXRlcyBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCwgc28gdGhvc2UgY2FuIGJlIHVzZWQgdG8gc2V0IGlkLCBjbGFzc2VzLCBzdHlsZXMgYW5kIG1vcmUuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBXaW5kb3cgZWxlbWVudCwgdGhlIGdhbWUgd2lsbCBiZSBsb2FkZWQgZGlyZWN0bHkgaW4gdGhhdC5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgZGVmYXVsdCB0byB0aGUgY3VycmVudCB3aW5kb3cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8V2luZG93fSAgW29wdGlvbnMudGFyZ2V0PXdpbmRvd10gdGhlIEhUTUxFbGVtZW50IG9yIFdpbmRvdyB0byBsb2FkIHRoZSBnYW1lIGluXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmhpZGVDdXJyZW5jeV0gaGlkZSBjdXJyZW5jeSBzeW1ib2xzL2NvZGVzIGluIHRoZSBnYW1lXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bm9saW1pdEFwaX0gICAgICAgIFRoZSBBUEkgY29ubmVjdGlvbiB0byB0aGUgb3BlbmVkIGdhbWUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcGkgPSBub2xpbWl0LmxvYWQoe1xuICAgICAqICAgIGdhbWU6ICdTcGFjZUFyY2FkZScsXG4gICAgICogICAgdGFyZ2V0OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpLFxuICAgICAqICAgIHRva2VuOiByZWFsTW9uZXlUb2tlbixcbiAgICAgKiAgICBtdXRlOiB0cnVlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgdGFyZ2V0ID0gb3B0aW9ucy50YXJnZXQgfHwgd2luZG93O1xuXG4gICAgICAgIHZhciBnYW1lT3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKG1lcmdlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpKTtcblxuICAgICAgICBpZih0YXJnZXQuV2luZG93ICYmIHRhcmdldCBpbnN0YW5jZW9mIHRhcmdldC5XaW5kb3cpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAncG9zaXRpb246IGZpeGVkOyB0b3A6IDA7IGxlZnQ6IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47Jyk7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIGlmcmFtZSA9IG1ha2VJZnJhbWUodGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIGlmcmFtZUNvbm5lY3Rpb24gPSBub2xpbWl0QXBpRmFjdG9yeShpZnJhbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGh0bWwoaWZyYW1lLmNvbnRlbnRXaW5kb3csIGdhbWVPcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoaWZyYW1lLCB0YXJnZXQpO1xuICAgICAgICAgICAgcmV0dXJuIGlmcmFtZUNvbm5lY3Rpb247XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBvcHRpb24gdGFyZ2V0OiAnICsgdGFyZ2V0O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSBpbiBhIG5ldywgc2VwYXJhdGUgcGFnZS4gVGhpcyBvZmZlcnMgdGhlIGJlc3QgaXNvbGF0aW9uLCBidXQgbm8gY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBnYW1lIGlzIHBvc3NpYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fFdpbmRvd30gIFtvcHRpb25zLnRhcmdldF0gdGhlIEhUTUxFbGVtZW50IG9yIFdpbmRvdyB0byBsb2FkIHRoZSBnYW1lIGluXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmhpZGVDdXJyZW5jeV0gaGlkZSBjdXJyZW5jeSBzeW1ib2xzL2NvZGVzIGluIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5sb2JieVVybD1cImhpc3Rvcnk6YmFjaygpXCJdIFVSTCB0byByZWRpcmVjdCBiYWNrIHRvIGxvYmJ5IG9uIG1vYmlsZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5kZXBvc2l0VXJsXSBVUkwgdG8gZGVwb3NpdCBwYWdlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXQgZWxlbWVudFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuc3VwcG9ydFVybF0gVVJMIHRvIHN1cHBvcnQgcGFnZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0IGVsZW1lbnRcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ1NwYWNlQXJjYWRlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICByZXBsYWNlOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBnYW1lT3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKG1lcmdlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpKTtcbiAgICAgICAgbG9jYXRpb24uaHJlZiA9IFJFUExBQ0VfVVJMXG4gICAgICAgICAgICAucmVwbGFjZSgne0NETn0nLCBnYW1lT3B0aW9ucy5jZG4pXG4gICAgICAgICAgICAucmVwbGFjZSgne1FVRVJZfScsIG1ha2VRdWVyeVN0cmluZyhnYW1lT3B0aW9ucykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGluZm9ybWF0aW9uIGFib3V0IHRoZSBnYW1lLCBzdWNoIGFzOiBjdXJyZW50IHZlcnNpb24sIHByZWZlcnJlZCB3aWR0aC9oZWlnaHQgZXRjLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgJ3Byb2R1Y3Rpb24nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gICAgY2FsbGJhY2sgIGNhbGxlZCB3aXRoIHRoZSBpbmZvIG9iamVjdCwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLCB0aGUgJ2Vycm9yJyBmaWVsZCB3aWxsIGJlIHNldFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBub2xpbWl0LmluZm8oe2dhbWU6ICdTcGFjZUFyY2FkZSd9LCBmdW5jdGlvbihpbmZvKSB7XG4gICAgICogICAgIHZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUud2lkdGggPSBpbmZvLnNpemUud2lkdGggKyAncHgnO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaW5mby5zaXplLmhlaWdodCArICdweCc7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGluZm8ubmFtZSwgaW5mby52ZXJzaW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbmZvOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBvcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICBpbmZvLmxvYWQob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG1ha2VRdWVyeVN0cmluZyhvcHRpb25zKSB7XG4gICAgdmFyIHF1ZXJ5ID0gW107XG4gICAgZm9yKHZhciBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgICB2YXIgdmFsdWUgPSBvcHRpb25zW2tleV07XG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHF1ZXJ5LnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5LmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gbWFrZUlmcmFtZShlbGVtZW50KSB7XG4gICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGNvcHlBdHRyaWJ1dGVzKGVsZW1lbnQsIGlmcmFtZSk7XG5cbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnYWxsb3dmdWxsc2NyZWVuJywgJycpO1xuXG4gICAgdmFyIG5hbWUgPSBnZW5lcmF0ZU5hbWUoaWZyYW1lLmdldEF0dHJpYnV0ZSgnbmFtZScpIHx8IGlmcmFtZS5pZCk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnbmFtZScsIG5hbWUpO1xuXG4gICAgcmV0dXJuIGlmcmFtZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKGdsb2JhbE9wdGlvbnMsIGdhbWVPcHRpb25zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgbmFtZTtcbiAgICBmb3IobmFtZSBpbiBERUZBVUxUX09QVElPTlMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IERFRkFVTFRfT1BUSU9OU1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2FtZU9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdhbWVPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IHJlcXVpcmUoJy4vbm9saW1pdC5jc3MnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBWaWV3cG9ydChoZWFkKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gaGVhZC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ2aWV3cG9ydFwiXScpO1xuICAgIGlmKCF2aWV3cG9ydCkge1xuICAgICAgICBoZWFkLmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgJzxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wLCBtYXhpbXVtLXNjYWxlPTEuMCwgdXNlci1zY2FsYWJsZT1ub1wiPicpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZGV2aWNlID0gb3B0aW9ucy5kZXZpY2UudG9Mb3dlckNhc2UoKTtcbiAgICBvcHRpb25zLm11dGUgPSBvcHRpb25zLm11dGUgfHwgZmFsc2U7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gQ0ROLnJlcGxhY2UoJ3tQUk9UT0NPTH0nLCBsb2NhdGlvbi5wcm90b2NvbCkucmVwbGFjZSgne0VOVn0nLCBlbnZpcm9ubWVudCk7XG4gICAgb3B0aW9ucy5zdGF0aWNSb290ID0gb3B0aW9ucy5zdGF0aWNSb290IHx8IEdBTUVTX1VSTC5yZXBsYWNlKCd7Q0ROfScsIG9wdGlvbnMuY2RuKTtcbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaHRtbCh3aW5kb3csIG9wdGlvbnMpIHtcbiAgICB2YXIgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQ7XG5cbiAgICB3aW5kb3cuZm9jdXMoKTtcblxuICAgIGluc2VydENzcyhkb2N1bWVudCk7XG4gICAgc2V0dXBWaWV3cG9ydChkb2N1bWVudC5oZWFkKTtcblxuICAgIHZhciBsb2FkZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS53aWR0aCA9ICcxMDB2dyc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMTAwdmgnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzIxNDc0ODM2NDcnO1xuICAgIGxvYWRlckVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbG9hZGVyJyk7XG5cbiAgICBsb2FkZXJFbGVtZW50LnNyYyA9IExPQURFUl9VUkxcbiAgICAgICAgLnJlcGxhY2UoJ3tDRE59Jywgb3B0aW9ucy5jZG4pXG4gICAgICAgIC5yZXBsYWNlKCd7REVWSUNFfScsIG9wdGlvbnMuZGV2aWNlKVxuICAgICAgICAucmVwbGFjZSgne09QRVJBVE9SfScsIG9wdGlvbnMub3BlcmF0b3IpXG4gICAgICAgIC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSAnJztcblxuICAgIGxvYWRlckVsZW1lbnQub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5vbignZXJyb3InLCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgaWYobG9hZGVyRWxlbWVudCAmJiBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoeydlcnJvcic6IGVycm9yfSksICcqJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmKG9wdGlvbnMud2VpbnJlKSB7XG4gICAgICAgICAgICB2YXIgd2VpbnJlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICB3ZWlucmUuc3JjID0gb3B0aW9ucy53ZWlucmU7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHdlaW5yZSk7XG4gICAgICAgIH1cblxuICAgICAgICBub2xpbWl0LmluZm8ob3B0aW9ucywgZnVuY3Rpb24oaW5mbykge1xuICAgICAgICAgICAgaWYoaW5mby5lcnJvcikge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdlcnJvcicsIGluZm8uZXJyb3IpO1xuICAgICAgICAgICAgICAgIGxvYWRlckVsZW1lbnQuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShpbmZvKSwgJyonKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2luZm8nLCBpbmZvKTtcblxuICAgICAgICAgICAgICAgIHZhciB2ZXJzaW9uID0gL15cXGQrXFwuXFxkK1xcLlxcZCskLy50ZXN0KGluZm8udmVyc2lvbikgPyAnLycgKyBpbmZvLnZlcnNpb24gOiAnJztcblxuICAgICAgICAgICAgICAgIHZhciBnYW1lRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IG9wdGlvbnMuc3RhdGljUm9vdCArIEdBTUVfSlNfVVJMLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSkucmVwbGFjZSgne1ZFUlNJT059JywgdmVyc2lvbik7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxvYWRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQgPSB3aW5kb3cubm9saW1pdCB8fCB7fTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdC5vcHRpb25zID0gb3B0aW9ucztcblxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsb2FkZXJFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gY29weUF0dHJpYnV0ZXMoZnJvbSwgdG8pIHtcbiAgICB2YXIgYXR0cmlidXRlcyA9IGZyb20uYXR0cmlidXRlcztcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXR0ciA9IGF0dHJpYnV0ZXNbaV07XG4gICAgICAgIHRvLnNldEF0dHJpYnV0ZShhdHRyLm5hbWUsIGF0dHIudmFsdWUpO1xuICAgIH1cbn1cblxudmFyIGdlbmVyYXRlTmFtZSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZ2VuZXJhdGVkSW5kZXggPSAxO1xuICAgIHJldHVybiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBuYW1lIHx8ICdOb2xpbWl0LScgKyBnZW5lcmF0ZWRJbmRleCsrO1xuICAgIH07XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXQ7XG4iXX0=
