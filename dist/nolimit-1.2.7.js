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
    'nolimit.js': '1.2.7'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.7',

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
     * var api = nolimit.replace({
     *    game: 'SpaceArcade',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    replace: function(options) {
        location.href = this.url(options);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIElORk9fSlNPTl9VUkwgPSAnL3tHQU1FfS9pbmZvLmpzb24nO1xuXG52YXIgY2FjaGUgPSB7fTtcblxudmFyIGluZm8gPSB7XG4gICAgbG9hZDogZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHVybCA9IG9wdGlvbnMuc3RhdGljUm9vdCArIElORk9fSlNPTl9VUkwucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKTtcblxuICAgICAgICB2YXIgaW5mbyA9IGNhY2hlW3VybF07XG4gICAgICAgIGlmKGluZm8pIHtcbiAgICAgICAgICAgIGluZm8udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvbiB8fCBpbmZvLnZlcnNpb247XG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soaW5mbyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRmFpbCgpIHtcbiAgICAgICAgICAgIHZhciBlcnJvciA9IHJlcXVlc3Quc3RhdHVzVGV4dCB8fCAnTm8gZXJyb3IgbWVzc2FnZSBhdmFpbGFibGU7IHByb2JhYmx5IGEgQ09SUyBpc3N1ZS4nO1xuICAgICAgICAgICAgY2FsbGJhY2soe1xuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvclxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG5cbiAgICAgICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGlmKHJlcXVlc3Quc3RhdHVzID49IDIwMCAmJiByZXF1ZXN0LnN0YXR1cyA8IDQwMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmZvID0gSlNPTi5wYXJzZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8udmVyc2lvbiA9IG9wdGlvbnMudmVyc2lvbiB8fCBpbmZvLnZlcnNpb247XG4gICAgICAgICAgICAgICAgICAgIGluZm8uc3RhdGljUm9vdCA9IFtvcHRpb25zLnN0YXRpY1Jvb3QsIGluZm8ubmFtZSwgaW5mby52ZXJzaW9uXS5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uYXNwZWN0UmF0aW8gPSBpbmZvLnNpemUud2lkdGggLyBpbmZvLnNpemUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBjYWNoZVt1cmxdID0gaW5mbztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soaW5mbyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvbkZhaWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBvbkZhaWw7XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbmZvO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRBcGlGYWN0b3J5XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSBmdW5jdGlvbih0YXJnZXQsIG9ubG9hZCkge1xuXG4gICAgdmFyIGxpc3RlbmVycyA9IHt9O1xuICAgIHZhciB1bmhhbmRsZWRFdmVudHMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkQ2FsbHMgPSBbXTtcbiAgICB2YXIgcG9ydDtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpIHtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkQ2FsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZSh1bmhhbmRsZWRDYWxscy5zaGlmdCgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE1lc3NhZ2VMaXN0ZW5lcihnYW1lV2luZG93KSB7XG4gICAgICAgIGdhbWVXaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGlmKGUucG9ydHMgJiYgZS5wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IGUucG9ydHNbMF07XG4gICAgICAgICAgICAgICAgcG9ydC5vbm1lc3NhZ2UgPSBvbk1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgcmVnaXN0ZXJFdmVudHMoT2JqZWN0LmtleXMobGlzdGVuZXJzKSk7XG4gICAgICAgICAgICAgICAgaGFuZGxlVW5oYW5kbGVkQ2FsbHMocG9ydCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBnYW1lV2luZG93LnRyaWdnZXIgPSB0cmlnZ2VyO1xuICAgICAgICBnYW1lV2luZG93Lm9uID0gb247XG4gICAgICAgIG9ubG9hZCgpO1xuICAgIH1cblxuICAgIGlmKHRhcmdldC5ub2RlTmFtZSA9PT0gJ0lGUkFNRScpIHtcbiAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGFkZE1lc3NhZ2VMaXN0ZW5lcih0YXJnZXQuY29udGVudFdpbmRvdyk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGFkZE1lc3NhZ2VMaXN0ZW5lcih0YXJnZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uTWVzc2FnZShlKSB7XG4gICAgICAgIHRyaWdnZXIoZS5kYXRhLm1ldGhvZCwgZS5kYXRhLnBhcmFtcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2VuZE1lc3NhZ2UobWV0aG9kLCBkYXRhKSB7XG4gICAgICAgIHZhciBtZXNzYWdlID0ge1xuICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICBtZXRob2Q6IG1ldGhvZFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgICAgIG1lc3NhZ2UucGFyYW1zID0gZGF0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHBvcnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgICAgIH0gY2F0Y2goaWdub3JlZCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgdW5oYW5kbGVkQ2FsbHMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlckV2ZW50cyhldmVudHMpIHtcbiAgICAgICAgc2VuZE1lc3NhZ2UoJ3JlZ2lzdGVyJywgZXZlbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIGlmKGxpc3RlbmVyc1tldmVudF0pIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc1tldmVudF0uZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0gPSB1bmhhbmRsZWRFdmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdID0gbGlzdGVuZXJzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkRXZlbnRzW2V2ZW50XSAmJiB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyaWdnZXIoZXZlbnQsIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ucG9wKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVnaXN0ZXJFdmVudHMoW2V2ZW50XSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdGlvbiB0byB0aGUgZ2FtZSB1c2luZyBNZXNzYWdlQ2hhbm5lbFxuICAgICAqIEBleHBvcnRzIG5vbGltaXRBcGlcbiAgICAgKi9cbiAgICB2YXIgbm9saW1pdEFwaSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBsaXN0ZW5lciBmb3IgZXZlbnQgZnJvbSB0aGUgc3RhcnRlZCBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBvblxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gICBldmVudCAgICBuYW1lIG9mIHRoZSBldmVudFxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBjYWxsYmFjayBmb3IgdGhlIGV2ZW50LCBzZWUgc3BlY2lmaWMgZXZlbnQgZG9jdW1lbnRhdGlvbiBmb3IgYW55IHBhcmFtZXRlcnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogYXBpLm9uKCdkZXBvc2l0JywgZnVuY3Rpb24gb3BlbkRlcG9zaXQgKCkge1xuICAgICAgICAgKiAgICAgc2hvd0RlcG9zaXQoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgKiAgICAgICAgIC8vIGFzayB0aGUgZ2FtZSB0byByZWZyZXNoIGJhbGFuY2UgZnJvbSBzZXJ2ZXJcbiAgICAgICAgICogICAgICAgICBhcGkuY2FsbCgncmVmcmVzaCcpO1xuICAgICAgICAgKiAgICAgfSk7XG4gICAgICAgICAqIH0pO1xuICAgICAgICAgKi9cbiAgICAgICAgb246IG9uLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIG1ldGhvZCBpbiB0aGUgb3BlbiBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2QgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSBvcHRpb25hbCBkYXRhIGZvciB0aGUgbWV0aG9kIGNhbGxlZCwgaWYgYW55XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIHJlbG9hZCB0aGUgZ2FtZVxuICAgICAgICAgKiBhcGkuY2FsbCgncmVsb2FkJyk7XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsOiBzZW5kTWVzc2FnZVxuICAgIH07XG5cbiAgICByZXR1cm4gbm9saW1pdEFwaTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdEFwaUZhY3Rvcnk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICdodG1sLCBib2R5IHtcXG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcXG4gICAgbWFyZ2luOiAwO1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAxMDAlO1xcbn1cXG5cXG5ib2R5IHtcXG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xcbn1cXG4nOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gcmVxdWlyZSgnLi9ub2xpbWl0LWFwaScpO1xudmFyIGluZm8gPSByZXF1aXJlKCcuL2luZm8nKTtcblxudmFyIENETiA9ICd7UFJPVE9DT0x9Ly97RU5WfSc7XG52YXIgTE9BREVSX1VSTCA9ICd7Q0ROfS9sb2FkZXIvbG9hZGVyLXtERVZJQ0V9Lmh0bWw/b3BlcmF0b3I9e09QRVJBVE9SfSZnYW1lPXtHQU1FfSZsYW5ndWFnZT17TEFOR1VBR0V9JztcbnZhciBSRVBMQUNFX1VSTCA9ICd7Q0ROfS9sb2FkZXIvZ2FtZS1sb2FkZXIuaHRtbD97UVVFUll9JztcbnZhciBHQU1FU19VUkwgPSAne0NETn0vZ2FtZXMnO1xudmFyIEdBTUVfSlNfVVJMID0gJy97R0FNRX17VkVSU0lPTn0vZ2FtZS5qcyc7XG5cbnZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgZGV2aWNlOiAnZGVza3RvcCcsXG4gICAgZW52aXJvbm1lbnQ6ICdwYXJ0bmVyJyxcbiAgICBsYW5ndWFnZTogJ2VuJyxcbiAgICAnbm9saW1pdC5qcyc6ICcxLjIuNydcbn07XG5cbi8qKlxuICogQGV4cG9ydHMgbm9saW1pdFxuICovXG52YXIgbm9saW1pdCA9IHtcblxuICAgIC8qKlxuICAgICAqIEBwcm9wZXJ0eSB7U3RyaW5nfSB2ZXJzaW9uIGN1cnJlbnQgdmVyc2lvbiBvZiBub2xpbWl0LmpzXG4gICAgICovXG4gICAgdmVyc2lvbjogJzEuMi43JyxcblxuICAgIG9wdGlvbnM6IHt9LFxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBsb2FkZXIgd2l0aCBkZWZhdWx0IHBhcmFtZXRlcnMuIENhbiBiZSBza2lwcGVkIGlmIHRoZSBwYXJhbWV0ZXJzIGFyZSBpbmNsdWRlZCBpbiB0aGUgY2FsbCB0byBsb2FkIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIG9wdGlvbnMub3BlcmF0b3IgdGhlIG9wZXJhdG9yIGNvZGUgZm9yIHRoZSBvcGVyYXRvclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMubGFuZ3VhZ2U9XCJlblwiXSB0aGUgbGFuZ3VhZ2UgdG8gdXNlIGZvciB0aGUgZ2FtZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuZGV2aWNlPWRlc2t0b3BdIHR5cGUgb2YgZGV2aWNlOiAnZGVza3RvcCcgb3IgJ21vYmlsZSdcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgJ3Byb2R1Y3Rpb24nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5jdXJyZW5jeT1FVVJdIGN1cnJlbmN5IHRvIHVzZSwgaWYgbm90IHByb3ZpZGVkIGJ5IHNlcnZlclxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBub2xpbWl0LmluaXQoe1xuICAgICAqICAgIG9wZXJhdG9yOiAnU01PT1RIT1BFUkFUT1InLFxuICAgICAqICAgIGxhbmd1YWdlOiAnc3YnLFxuICAgICAqICAgIGRldmljZTogJ21vYmlsZScsXG4gICAgICogICAgZW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgICAgKiAgICBjdXJyZW5jeTogJ1NFSydcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSwgcmVwbGFjaW5nIHRhcmdldCB3aXRoIHRoZSBnYW1lLlxuICAgICAqXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBIVE1MIGVsZW1lbnQsIGl0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBpZnJhbWUsIGtlZXBpbmcgYWxsIHRoZSBhdHRyaWJ1dGVzIG9mIHRoZSBvcmlnaW5hbCBlbGVtZW50LCBzbyB0aG9zZSBjYW4gYmUgdXNlZCB0byBzZXQgaWQsIGNsYXNzZXMsIHN0eWxlcyBhbmQgbW9yZS5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyBhIFdpbmRvdyBlbGVtZW50LCB0aGUgZ2FtZSB3aWxsIGJlIGxvYWRlZCBkaXJlY3RseSBpbiB0aGF0LlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBkZWZhdWx0IHRvIHRoZSBjdXJyZW50IHdpbmRvdy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMuaGlkZUN1cnJlbmN5XSBoaWRlIGN1cnJlbmN5IHN5bWJvbHMvY29kZXMgaW4gdGhlIGdhbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtub2xpbWl0QXBpfSAgICAgICAgVGhlIEFQSSBjb25uZWN0aW9uIHRvIHRoZSBvcGVuZWQgZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ1NwYWNlQXJjYWRlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciB0YXJnZXQgPSBvcHRpb25zLnRhcmdldCB8fCB3aW5kb3c7XG5cbiAgICAgICAgdmFyIGdhbWVPcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuXG4gICAgICAgIGlmKHRhcmdldC5XaW5kb3cgJiYgdGFyZ2V0IGluc3RhbmNlb2YgdGFyZ2V0LldpbmRvdykge1xuICAgICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB0YXJnZXQuc2V0QXR0cmlidXRlKCdzdHlsZScsICdwb3NpdGlvbjogZml4ZWQ7IHRvcDogMDsgbGVmdDogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgb3ZlcmZsb3c6IGhpZGRlbjsnKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGFyZ2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgICAgICB2YXIgaWZyYW1lID0gbWFrZUlmcmFtZSh0YXJnZXQpO1xuXG4gICAgICAgICAgICB2YXIgaWZyYW1lQ29ubmVjdGlvbiA9IG5vbGltaXRBcGlGYWN0b3J5KGlmcmFtZSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaHRtbChpZnJhbWUuY29udGVudFdpbmRvdywgZ2FtZU9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChpZnJhbWUsIHRhcmdldCk7XG4gICAgICAgICAgICByZXR1cm4gaWZyYW1lQ29ubmVjdGlvbjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIG9wdGlvbiB0YXJnZXQ6ICcgKyB0YXJnZXQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBnYW1lIGluIGEgbmV3LCBzZXBhcmF0ZSBwYWdlLiBUaGlzIG9mZmVycyB0aGUgYmVzdCBpc29sYXRpb24sIGJ1dCBubyBjb21tdW5pY2F0aW9uIHdpdGggdGhlIGdhbWUgaXMgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8V2luZG93fSAgW29wdGlvbnMudGFyZ2V0XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMuaGlkZUN1cnJlbmN5XSBoaWRlIGN1cnJlbmN5IHN5bWJvbHMvY29kZXMgaW4gdGhlIGdhbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLmxvYmJ5VXJsPVwiaGlzdG9yeTpiYWNrKClcIl0gVVJMIHRvIHJlZGlyZWN0IGJhY2sgdG8gbG9iYnkgb24gbW9iaWxlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLmRlcG9zaXRVcmxdIFVSTCB0byBkZXBvc2l0IHBhZ2UsIGlmIG5vdCB1c2luZyBhIHRhcmdldCBlbGVtZW50XG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5zdXBwb3J0VXJsXSBVUkwgdG8gc3VwcG9ydCBwYWdlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXQgZWxlbWVudFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXBpID0gbm9saW1pdC5yZXBsYWNlKHtcbiAgICAgKiAgICBnYW1lOiAnU3BhY2VBcmNhZGUnLFxuICAgICAqICAgIHRhcmdldDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKSxcbiAgICAgKiAgICB0b2tlbjogcmVhbE1vbmV5VG9rZW4sXG4gICAgICogICAgbXV0ZTogdHJ1ZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHJlcGxhY2U6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgbG9jYXRpb24uaHJlZiA9IHRoaXMudXJsKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RzIGEgVVJMIGZvciBtYW51YWxseSBsb2FkaW5nIHRoZSBnYW1lIGluIGFuIGlmcmFtZSBvciB2aWEgcmVkaXJlY3QuXG5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBzZWUgcmVwbGFjZSBmb3IgZGV0YWlsc1xuICAgICAqIEBzZWUge0BsaW5rIG5vbGltaXQucmVwbGFjZX0gZm9yIGRldGFpbHMgb24gb3B0aW9uc1xuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1cmw6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdhbWVPcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICByZXR1cm4gUkVQTEFDRV9VUkxcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7Q0ROfScsIGdhbWVPcHRpb25zLmNkbilcbiAgICAgICAgICAgIC5yZXBsYWNlKCd7UVVFUll9JywgbWFrZVF1ZXJ5U3RyaW5nKGdhbWVPcHRpb25zKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGdhbWUsIHN1Y2ggYXM6IGN1cnJlbnQgdmVyc2lvbiwgcHJlZmVycmVkIHdpZHRoL2hlaWdodCBldGMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICBjYWxsYmFjayAgY2FsbGVkIHdpdGggdGhlIGluZm8gb2JqZWN0LCBpZiB0aGVyZSB3YXMgYW4gZXJyb3IsIHRoZSAnZXJyb3InIGZpZWxkIHdpbGwgYmUgc2V0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5mbyh7Z2FtZTogJ1NwYWNlQXJjYWRlJ30sIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgKiAgICAgdmFyIHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyk7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS53aWR0aCA9IGluZm8uc2l6ZS53aWR0aCArICdweCc7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS5oZWlnaHQgPSBpbmZvLnNpemUuaGVpZ2h0ICsgJ3B4JztcbiAgICAgKiAgICAgY29uc29sZS5sb2coaW5mby5uYW1lLCBpbmZvLnZlcnNpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluZm86IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGluZm8ubG9hZChvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbWFrZVF1ZXJ5U3RyaW5nKG9wdGlvbnMpIHtcbiAgICB2YXIgcXVlcnkgPSBbXTtcbiAgICBmb3IodmFyIGtleSBpbiBvcHRpb25zKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IG9wdGlvbnNba2V5XTtcbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdmFsdWUgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcXVlcnkucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gcXVlcnkuam9pbignJicpO1xufVxuXG5mdW5jdGlvbiBtYWtlSWZyYW1lKGVsZW1lbnQpIHtcbiAgICB2YXIgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgY29weUF0dHJpYnV0ZXMoZWxlbWVudCwgaWZyYW1lKTtcblxuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdhbGxvd2Z1bGxzY3JlZW4nLCAnJyk7XG5cbiAgICB2YXIgbmFtZSA9IGdlbmVyYXRlTmFtZShpZnJhbWUuZ2V0QXR0cmlidXRlKCduYW1lJykgfHwgaWZyYW1lLmlkKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCduYW1lJywgbmFtZSk7XG5cbiAgICByZXR1cm4gaWZyYW1lO1xufVxuXG5mdW5jdGlvbiBtZXJnZU9wdGlvbnMoZ2xvYmFsT3B0aW9ucywgZ2FtZU9wdGlvbnMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHt9LCBuYW1lO1xuICAgIGZvcihuYW1lIGluIERFRkFVTFRfT1BUSU9OUykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gREVGQVVMVF9PUFRJT05TW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnbG9iYWxPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBnbG9iYWxPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnYW1lT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2FtZU9wdGlvbnNbbmFtZV07XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBpbnNlcnRDc3MoZG9jdW1lbnQpIHtcbiAgICB2YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gcmVxdWlyZSgnLi9ub2xpbWl0LmNzcycpO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufVxuXG5mdW5jdGlvbiBzZXR1cFZpZXdwb3J0KGhlYWQpIHtcbiAgICB2YXIgdmlld3BvcnQgPSBoZWFkLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT1cInZpZXdwb3J0XCJdJyk7XG4gICAgaWYoIXZpZXdwb3J0KSB7XG4gICAgICAgIGhlYWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCAnPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAsIG1heGltdW0tc2NhbGU9MS4wLCB1c2VyLXNjYWxhYmxlPW5vXCI+Jyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5kZXZpY2UgPSBvcHRpb25zLmRldmljZS50b0xvd2VyQ2FzZSgpO1xuICAgIG9wdGlvbnMubXV0ZSA9IG9wdGlvbnMubXV0ZSB8fCBmYWxzZTtcbiAgICB2YXIgZW52aXJvbm1lbnQgPSBvcHRpb25zLmVudmlyb25tZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgaWYoZW52aXJvbm1lbnQuaW5kZXhPZignLicpID09PSAtMSkge1xuICAgICAgICBlbnZpcm9ubWVudCArPSAnLm5vbGltaXRjZG4uY29tJztcbiAgICB9XG4gICAgb3B0aW9ucy5jZG4gPSBDRE4ucmVwbGFjZSgne1BST1RPQ09MfScsIGxvY2F0aW9uLnByb3RvY29sKS5yZXBsYWNlKCd7RU5WfScsIGVudmlyb25tZW50KTtcbiAgICBvcHRpb25zLnN0YXRpY1Jvb3QgPSBvcHRpb25zLnN0YXRpY1Jvb3QgfHwgR0FNRVNfVVJMLnJlcGxhY2UoJ3tDRE59Jywgb3B0aW9ucy5jZG4pO1xuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBodG1sKHdpbmRvdywgb3B0aW9ucykge1xuICAgIHZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudDtcblxuICAgIHdpbmRvdy5mb2N1cygpO1xuXG4gICAgaW5zZXJ0Q3NzKGRvY3VtZW50KTtcbiAgICBzZXR1cFZpZXdwb3J0KGRvY3VtZW50LmhlYWQpO1xuXG4gICAgdmFyIGxvYWRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBsb2FkZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLndpZHRoID0gJzEwMHZ3JztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmhlaWdodCA9ICcxMDB2aCc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS56SW5kZXggPSAnMjE0NzQ4MzY0Nyc7XG4gICAgbG9hZGVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdsb2FkZXInKTtcblxuICAgIGxvYWRlckVsZW1lbnQuc3JjID0gTE9BREVSX1VSTFxuICAgICAgICAucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbilcbiAgICAgICAgLnJlcGxhY2UoJ3tERVZJQ0V9Jywgb3B0aW9ucy5kZXZpY2UpXG4gICAgICAgIC5yZXBsYWNlKCd7T1BFUkFUT1J9Jywgb3B0aW9ucy5vcGVyYXRvcilcbiAgICAgICAgLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tMQU5HVUFHRX0nLCBvcHRpb25zLmxhbmd1YWdlKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQgJiYgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHsnZXJyb3InOiBlcnJvcn0pLCAnKicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZihvcHRpb25zLndlaW5yZSkge1xuICAgICAgICAgICAgdmFyIHdlaW5yZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgd2VpbnJlLnNyYyA9IG9wdGlvbnMud2VpbnJlO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh3ZWlucmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9saW1pdC5pbmZvKG9wdGlvbnMsIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgICAgICAgIGlmKGluZm8uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cudHJpZ2dlcignZXJyb3InLCBpbmZvLmVycm9yKTtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoaW5mbyksICcqJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdpbmZvJywgaW5mbyk7XG5cbiAgICAgICAgICAgICAgICB2YXIgdmVyc2lvbiA9IC9eXFxkK1xcLlxcZCtcXC5cXGQrJC8udGVzdChpbmZvLnZlcnNpb24pID8gJy8nICsgaW5mby52ZXJzaW9uIDogJyc7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ2FtZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgICAgICBnYW1lRWxlbWVudC5zcmMgPSBvcHRpb25zLnN0YXRpY1Jvb3QgKyBHQU1FX0pTX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpLnJlcGxhY2UoJ3tWRVJTSU9OfScsIHZlcnNpb24pO1xuXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5sb2FkU3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0ID0gd2luZG93Lm5vbGltaXQgfHwge307XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGdhbWVFbGVtZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobG9hZGVyRWxlbWVudCk7XG59XG5cbmZ1bmN0aW9uIGNvcHlBdHRyaWJ1dGVzKGZyb20sIHRvKSB7XG4gICAgdmFyIGF0dHJpYnV0ZXMgPSBmcm9tLmF0dHJpYnV0ZXM7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGF0dHIgPSBhdHRyaWJ1dGVzW2ldO1xuICAgICAgICB0by5zZXRBdHRyaWJ1dGUoYXR0ci5uYW1lLCBhdHRyLnZhbHVlKTtcbiAgICB9XG59XG5cbnZhciBnZW5lcmF0ZU5hbWUgPSAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGdlbmVyYXRlZEluZGV4ID0gMTtcbiAgICByZXR1cm4gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gbmFtZSB8fCAnTm9saW1pdC0nICsgZ2VuZXJhdGVkSW5kZXgrKztcbiAgICB9O1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBub2xpbWl0O1xuIl19
