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
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}';
var REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
var GAMES_URL = '{CDN}/games';
var GAME_JS_URL = '/{GAME}{VERSION}/game.js';

var DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': '1.2.9'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.9',

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
     * @param {String}  [options.quality] force asset quality. Possible values are 'high', 'medium', 'low'. Defaults to smart loading in each game.
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
     * var api = nolimit.replace({
     *    game: 'SpaceArcade',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    replace: function(options) {
        location.href = this.url(options);
        function noop() {}
        return {on: noop, call: noop};
    },

    /**
     * Constructs a URL for manually loading the game in an iframe or via redirect.

     * @param {Object} options see replace for details
     * @see {@link nolimit.replace} for details on options
     * @return {string}
     */
    url: function(options) {
        var gameOptions = processOptions(mergeOptions(this.options, options));
        return REPLACE_URL
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
        .replace('{GAME}', options.game)
        .replace('{LANGUAGE}', options.language);

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
                options.version = info.version;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSU5GT19KU09OX1VSTCA9ICcve0dBTUV9L2luZm8uanNvbic7XG5cbnZhciBjYWNoZSA9IHt9O1xuXG52YXIgaW5mbyA9IHtcbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgdXJsID0gb3B0aW9ucy5zdGF0aWNSb290ICsgSU5GT19KU09OX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgICAgIHZhciBpbmZvID0gY2FjaGVbdXJsXTtcbiAgICAgICAgaWYoaW5mbykge1xuICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgZnVuY3Rpb24gb25GYWlsKCkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gcmVxdWVzdC5zdGF0dXNUZXh0IHx8ICdObyBlcnJvciBtZXNzYWdlIGF2YWlsYWJsZTsgcHJvYmFibHkgYSBDT1JTIGlzc3VlLic7XG4gICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYocmVxdWVzdC5zdGF0dXMgPj0gMjAwICYmIHJlcXVlc3Quc3RhdHVzIDwgNDAwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZm8gPSBKU09OLnBhcnNlKHJlcXVlc3QucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgaW5mby5zdGF0aWNSb290ID0gW29wdGlvbnMuc3RhdGljUm9vdCwgaW5mby5uYW1lLCBpbmZvLnZlcnNpb25dLmpvaW4oJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgaW5mby5hc3BlY3RSYXRpbyA9IGluZm8uc2l6ZS53aWR0aCAvIGluZm8uc2l6ZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNhY2hlW3VybF0gPSBpbmZvO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soe1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGUubWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9uRmFpbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IG9uRmFpbDtcblxuICAgICAgICByZXF1ZXN0LnNlbmQoKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluZm87XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGV4cG9ydHMgbm9saW1pdEFwaUZhY3RvcnlcbiAqIEBwcml2YXRlXG4gKi9cbnZhciBub2xpbWl0QXBpRmFjdG9yeSA9IGZ1bmN0aW9uKHRhcmdldCwgb25sb2FkKSB7XG5cbiAgICB2YXIgbGlzdGVuZXJzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZEV2ZW50cyA9IHt9O1xuICAgIHZhciB1bmhhbmRsZWRDYWxscyA9IFtdO1xuICAgIHZhciBwb3J0O1xuXG4gICAgZnVuY3Rpb24gaGFuZGxlVW5oYW5kbGVkQ2FsbHMocG9ydCkge1xuICAgICAgICB3aGlsZSh1bmhhbmRsZWRDYWxscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKHVuaGFuZGxlZENhbGxzLnNoaWZ0KCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkTWVzc2FnZUxpc3RlbmVyKGdhbWVXaW5kb3cpIHtcbiAgICAgICAgZ2FtZVdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgaWYoZS5wb3J0cyAmJiBlLnBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gZS5wb3J0c1swXTtcbiAgICAgICAgICAgICAgICBwb3J0Lm9ubWVzc2FnZSA9IG9uTWVzc2FnZTtcbiAgICAgICAgICAgICAgICByZWdpc3RlckV2ZW50cyhPYmplY3Qua2V5cyhsaXN0ZW5lcnMpKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGdhbWVXaW5kb3cudHJpZ2dlciA9IHRyaWdnZXI7XG4gICAgICAgIGdhbWVXaW5kb3cub24gPSBvbjtcbiAgICAgICAgb25sb2FkKCk7XG4gICAgfVxuXG4gICAgaWYodGFyZ2V0Lm5vZGVOYW1lID09PSAnSUZSQU1FJykge1xuICAgICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldC5jb250ZW50V2luZG93KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKGUpIHtcbiAgICAgICAgdHJpZ2dlcihlLmRhdGEubWV0aG9kLCBlLmRhdGEucGFyYW1zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZW5kTWVzc2FnZShtZXRob2QsIGRhdGEpIHtcbiAgICAgICAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgICAgbWVzc2FnZS5wYXJhbXMgPSBkYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYocG9ydCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBjYXRjaChpZ25vcmVkKSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB1bmhhbmRsZWRDYWxscy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkQ2FsbHMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyRXZlbnRzKGV2ZW50cykge1xuICAgICAgICBzZW5kTWVzc2FnZSgncmVnaXN0ZXInLCBldmVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgaWYobGlzdGVuZXJzW2V2ZW50XSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXSA9IHVuaGFuZGxlZEV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXS5wdXNoKGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0gPSBsaXN0ZW5lcnNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB3aGlsZSh1bmhhbmRsZWRFdmVudHNbZXZlbnRdICYmIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJpZ2dlcihldmVudCwgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5wb3AoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZWdpc3RlckV2ZW50cyhbZXZlbnRdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0aW9uIHRvIHRoZSBnYW1lIHVzaW5nIE1lc3NhZ2VDaGFubmVsXG4gICAgICogQGV4cG9ydHMgbm9saW1pdEFwaVxuICAgICAqL1xuICAgIHZhciBub2xpbWl0QXBpID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGxpc3RlbmVyIGZvciBldmVudCBmcm9tIHRoZSBzdGFydGVkIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIG9uXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgIGV2ZW50ICAgIG5hbWUgb2YgdGhlIGV2ZW50XG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGNhbGxiYWNrIGZvciB0aGUgZXZlbnQsIHNlZSBzcGVjaWZpYyBldmVudCBkb2N1bWVudGF0aW9uIGZvciBhbnkgcGFyYW1ldGVyc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiBhcGkub24oJ2RlcG9zaXQnLCBmdW5jdGlvbiBvcGVuRGVwb3NpdCAoKSB7XG4gICAgICAgICAqICAgICBzaG93RGVwb3NpdCgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAqICAgICAgICAgLy8gYXNrIHRoZSBnYW1lIHRvIHJlZnJlc2ggYmFsYW5jZSBmcm9tIHNlcnZlclxuICAgICAgICAgKiAgICAgICAgIGFwaS5jYWxsKCdyZWZyZXNoJyk7XG4gICAgICAgICAqICAgICB9KTtcbiAgICAgICAgICogfSk7XG4gICAgICAgICAqL1xuICAgICAgICBvbjogb24sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGwgbWV0aG9kIGluIHRoZSBvcGVuIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZCBuYW1lIG9mIHRoZSBtZXRob2QgdG8gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIG9wdGlvbmFsIGRhdGEgZm9yIHRoZSBtZXRob2QgY2FsbGVkLCBpZiBhbnlcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gcmVsb2FkIHRoZSBnYW1lXG4gICAgICAgICAqIGFwaS5jYWxsKCdyZWxvYWQnKTtcbiAgICAgICAgICovXG4gICAgICAgIGNhbGw6IHNlbmRNZXNzYWdlXG4gICAgfTtcblxuICAgIHJldHVybiBub2xpbWl0QXBpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBub2xpbWl0QXBpRmFjdG9yeTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJ2h0bWwsIGJvZHkge1xcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xcbiAgICBtYXJnaW46IDA7XFxuICAgIHdpZHRoOiAxMDAlO1xcbiAgICBoZWlnaHQ6IDEwMCU7XFxufVxcblxcbmJvZHkge1xcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XFxufVxcbic7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSByZXF1aXJlKCcuL25vbGltaXQtYXBpJyk7XG52YXIgaW5mbyA9IHJlcXVpcmUoJy4vaW5mbycpO1xuXG52YXIgQ0ROID0gJ3tQUk9UT0NPTH0vL3tFTlZ9JztcbnZhciBMT0FERVJfVVJMID0gJ3tDRE59L2xvYWRlci9sb2FkZXIte0RFVklDRX0uaHRtbD9vcGVyYXRvcj17T1BFUkFUT1J9JmdhbWU9e0dBTUV9Jmxhbmd1YWdlPXtMQU5HVUFHRX0nO1xudmFyIFJFUExBQ0VfVVJMID0gJ3tDRE59L2xvYWRlci9nYW1lLWxvYWRlci5odG1sP3tRVUVSWX0nO1xudmFyIEdBTUVTX1VSTCA9ICd7Q0ROfS9nYW1lcyc7XG52YXIgR0FNRV9KU19VUkwgPSAnL3tHQU1FfXtWRVJTSU9OfS9nYW1lLmpzJztcblxudmFyIERFRkFVTFRfT1BUSU9OUyA9IHtcbiAgICBkZXZpY2U6ICdkZXNrdG9wJyxcbiAgICBlbnZpcm9ubWVudDogJ3BhcnRuZXInLFxuICAgIGxhbmd1YWdlOiAnZW4nLFxuICAgICdub2xpbWl0LmpzJzogJzEuMi45J1xufTtcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0XG4gKi9cbnZhciBub2xpbWl0ID0ge1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHtTdHJpbmd9IHZlcnNpb24gY3VycmVudCB2ZXJzaW9uIG9mIG5vbGltaXQuanNcbiAgICAgKi9cbiAgICB2ZXJzaW9uOiAnMS4yLjknLFxuXG4gICAgb3B0aW9uczoge30sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGxvYWRlciB3aXRoIGRlZmF1bHQgcGFyYW1ldGVycy4gQ2FuIGJlIHNraXBwZWQgaWYgdGhlIHBhcmFtZXRlcnMgYXJlIGluY2x1ZGVkIGluIHRoZSBjYWxsIHRvIGxvYWQgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgb3B0aW9ucy5vcGVyYXRvciB0aGUgb3BlcmF0b3IgY29kZSBmb3IgdGhlIG9wZXJhdG9yXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5sYW5ndWFnZT1cImVuXCJdIHRoZSBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5kZXZpY2U9ZGVza3RvcF0gdHlwZSBvZiBkZXZpY2U6ICdkZXNrdG9wJyBvciAnbW9iaWxlJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmN1cnJlbmN5PUVVUl0gY3VycmVuY3kgdG8gdXNlLCBpZiBub3QgcHJvdmlkZWQgYnkgc2VydmVyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5xdWFsaXR5XSBmb3JjZSBhc3NldCBxdWFsaXR5LiBQb3NzaWJsZSB2YWx1ZXMgYXJlICdoaWdoJywgJ21lZGl1bScsICdsb3cnLiBEZWZhdWx0cyB0byBzbWFydCBsb2FkaW5nIGluIGVhY2ggZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbml0KHtcbiAgICAgKiAgICBvcGVyYXRvcjogJ1NNT09USE9QRVJBVE9SJyxcbiAgICAgKiAgICBsYW5ndWFnZTogJ3N2JyxcbiAgICAgKiAgICBkZXZpY2U6ICdtb2JpbGUnLFxuICAgICAqICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICogICAgY3VycmVuY3k6ICdTRUsnXG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUsIHJlcGxhY2luZyB0YXJnZXQgd2l0aCB0aGUgZ2FtZS5cbiAgICAgKlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgSFRNTCBlbGVtZW50LCBpdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gaWZyYW1lLCBrZWVwaW5nIGFsbCB0aGUgYXR0cmlidXRlcyBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCwgc28gdGhvc2UgY2FuIGJlIHVzZWQgdG8gc2V0IGlkLCBjbGFzc2VzLCBzdHlsZXMgYW5kIG1vcmUuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBXaW5kb3cgZWxlbWVudCwgdGhlIGdhbWUgd2lsbCBiZSBsb2FkZWQgZGlyZWN0bHkgaW4gdGhhdC5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgZGVmYXVsdCB0byB0aGUgY3VycmVudCB3aW5kb3cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8V2luZG93fSAgW29wdGlvbnMudGFyZ2V0PXdpbmRvd10gdGhlIEhUTUxFbGVtZW50IG9yIFdpbmRvdyB0byBsb2FkIHRoZSBnYW1lIGluXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmhpZGVDdXJyZW5jeV0gaGlkZSBjdXJyZW5jeSBzeW1ib2xzL2NvZGVzIGluIHRoZSBnYW1lXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bm9saW1pdEFwaX0gICAgICAgIFRoZSBBUEkgY29ubmVjdGlvbiB0byB0aGUgb3BlbmVkIGdhbWUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcGkgPSBub2xpbWl0LmxvYWQoe1xuICAgICAqICAgIGdhbWU6ICdTcGFjZUFyY2FkZScsXG4gICAgICogICAgdGFyZ2V0OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpLFxuICAgICAqICAgIHRva2VuOiByZWFsTW9uZXlUb2tlbixcbiAgICAgKiAgICBtdXRlOiB0cnVlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgbG9hZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgdGFyZ2V0ID0gb3B0aW9ucy50YXJnZXQgfHwgd2luZG93O1xuXG4gICAgICAgIHZhciBnYW1lT3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKG1lcmdlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpKTtcblxuICAgICAgICBpZih0YXJnZXQuV2luZG93ICYmIHRhcmdldCBpbnN0YW5jZW9mIHRhcmdldC5XaW5kb3cpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAncG9zaXRpb246IGZpeGVkOyB0b3A6IDA7IGxlZnQ6IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47Jyk7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIGlmcmFtZSA9IG1ha2VJZnJhbWUodGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIGlmcmFtZUNvbm5lY3Rpb24gPSBub2xpbWl0QXBpRmFjdG9yeShpZnJhbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGh0bWwoaWZyYW1lLmNvbnRlbnRXaW5kb3csIGdhbWVPcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoaWZyYW1lLCB0YXJnZXQpO1xuICAgICAgICAgICAgcmV0dXJuIGlmcmFtZUNvbm5lY3Rpb247XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBvcHRpb24gdGFyZ2V0OiAnICsgdGFyZ2V0O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSBpbiBhIG5ldywgc2VwYXJhdGUgcGFnZS4gVGhpcyBvZmZlcnMgdGhlIGJlc3QgaXNvbGF0aW9uLCBidXQgbm8gY29tbXVuaWNhdGlvbiB3aXRoIHRoZSBnYW1lIGlzIHBvc3NpYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fFdpbmRvd30gIFtvcHRpb25zLnRhcmdldF0gdGhlIEhUTUxFbGVtZW50IG9yIFdpbmRvdyB0byBsb2FkIHRoZSBnYW1lIGluXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmhpZGVDdXJyZW5jeV0gaGlkZSBjdXJyZW5jeSBzeW1ib2xzL2NvZGVzIGluIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5sb2JieVVybD1cImhpc3Rvcnk6YmFjaygpXCJdIFVSTCB0byByZWRpcmVjdCBiYWNrIHRvIGxvYmJ5IG9uIG1vYmlsZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5kZXBvc2l0VXJsXSBVUkwgdG8gZGVwb3NpdCBwYWdlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXQgZWxlbWVudFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuc3VwcG9ydFVybF0gVVJMIHRvIHN1cHBvcnQgcGFnZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0IGVsZW1lbnRcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQucmVwbGFjZSh7XG4gICAgICogICAgZ2FtZTogJ1NwYWNlQXJjYWRlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICByZXBsYWNlOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGxvY2F0aW9uLmhyZWYgPSB0aGlzLnVybChvcHRpb25zKTtcbiAgICAgICAgZnVuY3Rpb24gbm9vcCgpIHt9XG4gICAgICAgIHJldHVybiB7b246IG5vb3AsIGNhbGw6IG5vb3B9O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RzIGEgVVJMIGZvciBtYW51YWxseSBsb2FkaW5nIHRoZSBnYW1lIGluIGFuIGlmcmFtZSBvciB2aWEgcmVkaXJlY3QuXG5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBzZWUgcmVwbGFjZSBmb3IgZGV0YWlsc1xuICAgICAqIEBzZWUge0BsaW5rIG5vbGltaXQucmVwbGFjZX0gZm9yIGRldGFpbHMgb24gb3B0aW9uc1xuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1cmw6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdhbWVPcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICByZXR1cm4gUkVQTEFDRV9VUkxcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7Q0ROfScsIGdhbWVPcHRpb25zLmNkbilcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7UVVFUll9JywgbWFrZVF1ZXJ5U3RyaW5nKGdhbWVPcHRpb25zKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGdhbWUsIHN1Y2ggYXM6IGN1cnJlbnQgdmVyc2lvbiwgcHJlZmVycmVkIHdpZHRoL2hlaWdodCBldGMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICBjYWxsYmFjayAgY2FsbGVkIHdpdGggdGhlIGluZm8gb2JqZWN0LCBpZiB0aGVyZSB3YXMgYW4gZXJyb3IsIHRoZSAnZXJyb3InIGZpZWxkIHdpbGwgYmUgc2V0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5mbyh7Z2FtZTogJ1NwYWNlQXJjYWRlJ30sIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgKiAgICAgdmFyIHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyk7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS53aWR0aCA9IGluZm8uc2l6ZS53aWR0aCArICdweCc7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS5oZWlnaHQgPSBpbmZvLnNpemUuaGVpZ2h0ICsgJ3B4JztcbiAgICAgKiAgICAgY29uc29sZS5sb2coaW5mby5uYW1lLCBpbmZvLnZlcnNpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluZm86IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGluZm8ubG9hZChvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbWFrZVF1ZXJ5U3RyaW5nKG9wdGlvbnMpIHtcbiAgICB2YXIgcXVlcnkgPSBbXTtcbiAgICBmb3IodmFyIGtleSBpbiBvcHRpb25zKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IG9wdGlvbnNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdmFsdWUgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcXVlcnkucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnkuam9pbignJicpO1xufVxuXG5mdW5jdGlvbiBtYWtlSWZyYW1lKGVsZW1lbnQpIHtcbiAgICB2YXIgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgY29weUF0dHJpYnV0ZXMoZWxlbWVudCwgaWZyYW1lKTtcblxuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdhbGxvd2Z1bGxzY3JlZW4nLCAnJyk7XG5cbiAgICB2YXIgbmFtZSA9IGdlbmVyYXRlTmFtZShpZnJhbWUuZ2V0QXR0cmlidXRlKCduYW1lJykgfHwgaWZyYW1lLmlkKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCduYW1lJywgbmFtZSk7XG5cbiAgICByZXR1cm4gaWZyYW1lO1xufVxuXG5mdW5jdGlvbiBtZXJnZU9wdGlvbnMoZ2xvYmFsT3B0aW9ucywgZ2FtZU9wdGlvbnMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHt9LCBuYW1lO1xuICAgIGZvcihuYW1lIGluIERFRkFVTFRfT1BUSU9OUykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gREVGQVVMVF9PUFRJT05TW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnbG9iYWxPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBnbG9iYWxPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnYW1lT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2FtZU9wdGlvbnNbbmFtZV07XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBpbnNlcnRDc3MoZG9jdW1lbnQpIHtcbiAgICB2YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gcmVxdWlyZSgnLi9ub2xpbWl0LmNzcycpO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufVxuXG5mdW5jdGlvbiBzZXR1cFZpZXdwb3J0KGhlYWQpIHtcbiAgICB2YXIgdmlld3BvcnQgPSBoZWFkLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT1cInZpZXdwb3J0XCJdJyk7XG4gICAgaWYoIXZpZXdwb3J0KSB7XG4gICAgICAgIGhlYWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCAnPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAsIG1heGltdW0tc2NhbGU9MS4wLCB1c2VyLXNjYWxhYmxlPW5vXCI+Jyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5kZXZpY2UgPSBvcHRpb25zLmRldmljZS50b0xvd2VyQ2FzZSgpO1xuICAgIG9wdGlvbnMubXV0ZSA9IG9wdGlvbnMubXV0ZSB8fCBmYWxzZTtcbiAgICB2YXIgZW52aXJvbm1lbnQgPSBvcHRpb25zLmVudmlyb25tZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgaWYoZW52aXJvbm1lbnQuaW5kZXhPZignLicpID09PSAtMSkge1xuICAgICAgICBlbnZpcm9ubWVudCArPSAnLm5vbGltaXRjZG4uY29tJztcbiAgICB9XG4gICAgb3B0aW9ucy5jZG4gPSBDRE4ucmVwbGFjZSgne1BST1RPQ09MfScsIGxvY2F0aW9uLnByb3RvY29sKS5yZXBsYWNlKCd7RU5WfScsIGVudmlyb25tZW50KTtcbiAgICBvcHRpb25zLnN0YXRpY1Jvb3QgPSBvcHRpb25zLnN0YXRpY1Jvb3QgfHwgR0FNRVNfVVJMLnJlcGxhY2UoJ3tDRE59Jywgb3B0aW9ucy5jZG4pO1xuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBodG1sKHdpbmRvdywgb3B0aW9ucykge1xuICAgIHZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudDtcblxuICAgIHdpbmRvdy5mb2N1cygpO1xuXG4gICAgaW5zZXJ0Q3NzKGRvY3VtZW50KTtcbiAgICBzZXR1cFZpZXdwb3J0KGRvY3VtZW50LmhlYWQpO1xuXG4gICAgdmFyIGxvYWRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBsb2FkZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLndpZHRoID0gJzEwMHZ3JztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmhlaWdodCA9ICcxMDB2aCc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS56SW5kZXggPSAnMjE0NzQ4MzY0Nyc7XG4gICAgbG9hZGVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdsb2FkZXInKTtcblxuICAgIGxvYWRlckVsZW1lbnQuc3JjID0gTE9BREVSX1VSTFxuICAgICAgICAucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbilcbiAgICAgICAgLnJlcGxhY2UoJ3tERVZJQ0V9Jywgb3B0aW9ucy5kZXZpY2UpXG4gICAgICAgIC5yZXBsYWNlKCd7T1BFUkFUT1J9Jywgb3B0aW9ucy5vcGVyYXRvcilcbiAgICAgICAgLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tMQU5HVUFHRX0nLCBvcHRpb25zLmxhbmd1YWdlKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQgJiYgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHsnZXJyb3InOiBlcnJvcn0pLCAnKicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZihvcHRpb25zLndlaW5yZSkge1xuICAgICAgICAgICAgdmFyIHdlaW5yZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgd2VpbnJlLnNyYyA9IG9wdGlvbnMud2VpbnJlO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh3ZWlucmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9saW1pdC5pbmZvKG9wdGlvbnMsIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgICAgICAgIGlmKGluZm8uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cudHJpZ2dlcignZXJyb3InLCBpbmZvLmVycm9yKTtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoaW5mbyksICcqJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdpbmZvJywgaW5mbyk7XG5cbiAgICAgICAgICAgICAgICB2YXIgdmVyc2lvbiA9IC9eXFxkK1xcLlxcZCtcXC5cXGQrJC8udGVzdChpbmZvLnZlcnNpb24pID8gJy8nICsgaW5mby52ZXJzaW9uIDogJyc7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ2FtZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICBnYW1lRWxlbWVudC5zcmMgPSBvcHRpb25zLnN0YXRpY1Jvb3QgKyBHQU1FX0pTX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpLnJlcGxhY2UoJ3tWRVJTSU9OfScsIHZlcnNpb24pO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5sb2FkU3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMudmVyc2lvbiA9IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdCA9IHdpbmRvdy5ub2xpbWl0IHx8IHt9O1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChnYW1lRWxlbWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxvYWRlckVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBjb3B5QXR0cmlidXRlcyhmcm9tLCB0bykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZnJvbS5hdHRyaWJ1dGVzO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXTtcbiAgICAgICAgdG8uc2V0QXR0cmlidXRlKGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgfVxufVxuXG52YXIgZ2VuZXJhdGVOYW1lID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5hbWUgfHwgJ05vbGltaXQtJyArIGdlbmVyYXRlZEluZGV4Kys7XG4gICAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdDtcbiJdfQ==
