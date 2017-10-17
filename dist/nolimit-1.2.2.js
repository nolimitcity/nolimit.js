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
    'nolimit.js': '1.2.2'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.2',

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
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(options[key]));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBJTkZPX0pTT05fVVJMID0gJy97R0FNRX0vaW5mby5qc29uJztcblxudmFyIGNhY2hlID0ge307XG5cbnZhciBpbmZvID0ge1xuICAgIGxvYWQ6IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciB1cmwgPSBvcHRpb25zLnN0YXRpY1Jvb3QgKyBJTkZPX0pTT05fVVJMLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSk7XG5cbiAgICAgICAgdmFyIGluZm8gPSBjYWNoZVt1cmxdO1xuICAgICAgICBpZihpbmZvKSB7XG4gICAgICAgICAgICBpbmZvLnZlcnNpb24gPSBvcHRpb25zLnZlcnNpb24gfHwgaW5mby52ZXJzaW9uO1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGluZm8pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICBmdW5jdGlvbiBvbkZhaWwoKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSByZXF1ZXN0LnN0YXR1c1RleHQgfHwgJ05vIGVycm9yIG1lc3NhZ2UgYXZhaWxhYmxlOyBwcm9iYWJseSBhIENPUlMgaXNzdWUuJztcbiAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZihyZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5mbyA9IEpTT04ucGFyc2UocmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLnZlcnNpb24gPSBvcHRpb25zLnZlcnNpb24gfHwgaW5mby52ZXJzaW9uO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLnN0YXRpY1Jvb3QgPSBbb3B0aW9ucy5zdGF0aWNSb290LCBpbmZvLm5hbWUsIGluZm8udmVyc2lvbl0uam9pbignLycpO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLmFzcGVjdFJhdGlvID0gaW5mby5zaXplLndpZHRoIC8gaW5mby5zaXplLmhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGVbdXJsXSA9IGluZm87XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGluZm8pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogZS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb25GYWlsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gb25GYWlsO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW5mbztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0QXBpRmFjdG9yeVxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gZnVuY3Rpb24odGFyZ2V0LCBvbmxvYWQpIHtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkRXZlbnRzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZENhbGxzID0gW107XG4gICAgdmFyIHBvcnQ7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KSB7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZENhbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UodW5oYW5kbGVkQ2FsbHMuc2hpZnQoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRNZXNzYWdlTGlzdGVuZXIoZ2FtZVdpbmRvdykge1xuICAgICAgICBnYW1lV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZihlLnBvcnRzICYmIGUucG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBlLnBvcnRzWzBdO1xuICAgICAgICAgICAgICAgIHBvcnQub25tZXNzYWdlID0gb25NZXNzYWdlO1xuICAgICAgICAgICAgICAgIHJlZ2lzdGVyRXZlbnRzKE9iamVjdC5rZXlzKGxpc3RlbmVycykpO1xuICAgICAgICAgICAgICAgIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZ2FtZVdpbmRvdy50cmlnZ2VyID0gdHJpZ2dlcjtcbiAgICAgICAgZ2FtZVdpbmRvdy5vbiA9IG9uO1xuICAgICAgICBvbmxvYWQoKTtcbiAgICB9XG5cbiAgICBpZih0YXJnZXQubm9kZU5hbWUgPT09ICdJRlJBTUUnKSB7XG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0LmNvbnRlbnRXaW5kb3cpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UoZSkge1xuICAgICAgICB0cmlnZ2VyKGUuZGF0YS5tZXRob2QsIGUuZGF0YS5wYXJhbXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlKG1ldGhvZCwgZGF0YSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICAgICAgfTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgICBtZXNzYWdlLnBhcmFtcyA9IGRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwb3J0KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoKGlnbm9yZWQpIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRDYWxscy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXJFdmVudHMoZXZlbnRzKSB7XG4gICAgICAgIHNlbmRNZXNzYWdlKCdyZWdpc3RlcicsIGV2ZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgZGF0YSkge1xuICAgICAgICBpZihsaXN0ZW5lcnNbZXZlbnRdKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLmZvckVhY2goZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdID0gdW5oYW5kbGVkRXZlbnRzW25hbWVdIHx8IFtdO1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdLnB1c2goZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XSA9IGxpc3RlbmVyc1tldmVudF0gfHwgW107XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0ucHVzaChjYWxsYmFjayk7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZEV2ZW50c1tldmVudF0gJiYgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKGV2ZW50LCB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLnBvcCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZ2lzdGVyRXZlbnRzKFtldmVudF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3Rpb24gdG8gdGhlIGdhbWUgdXNpbmcgTWVzc2FnZUNoYW5uZWxcbiAgICAgKiBAZXhwb3J0cyBub2xpbWl0QXBpXG4gICAgICovXG4gICAgdmFyIG5vbGltaXRBcGkgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgZm9yIGV2ZW50IGZyb20gdGhlIHN0YXJ0ZWQgZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gb25cbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9ICAgZXZlbnQgICAgbmFtZSBvZiB0aGUgZXZlbnRcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgY2FsbGJhY2sgZm9yIHRoZSBldmVudCwgc2VlIHNwZWNpZmljIGV2ZW50IGRvY3VtZW50YXRpb24gZm9yIGFueSBwYXJhbWV0ZXJzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIGFwaS5vbignZGVwb3NpdCcsIGZ1bmN0aW9uIG9wZW5EZXBvc2l0ICgpIHtcbiAgICAgICAgICogICAgIHNob3dEZXBvc2l0KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICogICAgICAgICAvLyBhc2sgdGhlIGdhbWUgdG8gcmVmcmVzaCBiYWxhbmNlIGZyb20gc2VydmVyXG4gICAgICAgICAqICAgICAgICAgYXBpLmNhbGwoJ3JlZnJlc2gnKTtcbiAgICAgICAgICogICAgIH0pO1xuICAgICAgICAgKiB9KTtcbiAgICAgICAgICovXG4gICAgICAgIG9uOiBvbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbCBtZXRob2QgaW4gdGhlIG9wZW4gZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kIG5hbWUgb2YgdGhlIG1ldGhvZCB0byBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV0gb3B0aW9uYWwgZGF0YSBmb3IgdGhlIG1ldGhvZCBjYWxsZWQsIGlmIGFueVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyByZWxvYWQgdGhlIGdhbWVcbiAgICAgICAgICogYXBpLmNhbGwoJ3JlbG9hZCcpO1xuICAgICAgICAgKi9cbiAgICAgICAgY2FsbDogc2VuZE1lc3NhZ2VcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5vbGltaXRBcGk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXRBcGlGYWN0b3J5O1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnaHRtbCwgYm9keSB7XFxuICAgIG92ZXJmbG93OiBoaWRkZW47XFxuICAgIG1hcmdpbjogMDtcXG4gICAgd2lkdGg6IDEwMCU7XFxuICAgIGhlaWdodDogMTAwJTtcXG59XFxuXFxuYm9keSB7XFxuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcXG59XFxuJzsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBub2xpbWl0QXBpRmFjdG9yeSA9IHJlcXVpcmUoJy4vbm9saW1pdC1hcGknKTtcbnZhciBpbmZvID0gcmVxdWlyZSgnLi9pbmZvJyk7XG5cbnZhciBDRE4gPSAne1BST1RPQ09MfS8ve0VOVn0nO1xudmFyIExPQURFUl9VUkwgPSAne0NETn0vbG9hZGVyL2xvYWRlci17REVWSUNFfS5odG1sP29wZXJhdG9yPXtPUEVSQVRPUn0mZ2FtZT17R0FNRX0nO1xudmFyIFJFUExBQ0VfVVJMID0gJ3tDRE59L2xvYWRlci9nYW1lLWxvYWRlci5odG1sP3tRVUVSWX0nO1xudmFyIEdBTUVTX1VSTCA9ICd7Q0ROfS9nYW1lcyc7XG52YXIgR0FNRV9KU19VUkwgPSAnL3tHQU1FfXtWRVJTSU9OfS9nYW1lLmpzJztcblxudmFyIERFRkFVTFRfT1BUSU9OUyA9IHtcbiAgICBkZXZpY2U6ICdkZXNrdG9wJyxcbiAgICBlbnZpcm9ubWVudDogJ3BhcnRuZXInLFxuICAgIGxhbmd1YWdlOiAnZW4nLFxuICAgICdub2xpbWl0LmpzJzogJzEuMi4yJ1xufTtcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0XG4gKi9cbnZhciBub2xpbWl0ID0ge1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHtTdHJpbmd9IHZlcnNpb24gY3VycmVudCB2ZXJzaW9uIG9mIG5vbGltaXQuanNcbiAgICAgKi9cbiAgICB2ZXJzaW9uOiAnMS4yLjInLFxuXG4gICAgb3B0aW9uczoge30sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGxvYWRlciB3aXRoIGRlZmF1bHQgcGFyYW1ldGVycy4gQ2FuIGJlIHNraXBwZWQgaWYgdGhlIHBhcmFtZXRlcnMgYXJlIGluY2x1ZGVkIGluIHRoZSBjYWxsIHRvIGxvYWQgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgb3B0aW9ucy5vcGVyYXRvciB0aGUgb3BlcmF0b3IgY29kZSBmb3IgdGhlIG9wZXJhdG9yXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5sYW5ndWFnZT1cImVuXCJdIHRoZSBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5kZXZpY2U9ZGVza3RvcF0gdHlwZSBvZiBkZXZpY2U6ICdkZXNrdG9wJyBvciAnbW9iaWxlJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmN1cnJlbmN5PUVVUl0gY3VycmVuY3kgdG8gdXNlLCBpZiBub3QgcHJvdmlkZWQgYnkgc2VydmVyXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5pdCh7XG4gICAgICogICAgb3BlcmF0b3I6ICdTTU9PVEhPUEVSQVRPUicsXG4gICAgICogICAgbGFuZ3VhZ2U6ICdzdicsXG4gICAgICogICAgZGV2aWNlOiAnbW9iaWxlJyxcbiAgICAgKiAgICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgICAqICAgIGN1cnJlbmN5OiAnU0VLJ1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBnYW1lLCByZXBsYWNpbmcgdGFyZ2V0IHdpdGggdGhlIGdhbWUuXG4gICAgICpcbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyBhIEhUTUwgZWxlbWVudCwgaXQgd2lsbCBiZSByZXBsYWNlZCB3aXRoIGFuIGlmcmFtZSwga2VlcGluZyBhbGwgdGhlIGF0dHJpYnV0ZXMgb2YgdGhlIG9yaWdpbmFsIGVsZW1lbnQsIHNvIHRob3NlIGNhbiBiZSB1c2VkIHRvIHNldCBpZCwgY2xhc3Nlcywgc3R5bGVzIGFuZCBtb3JlLlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgV2luZG93IGVsZW1lbnQsIHRoZSBnYW1lIHdpbGwgYmUgbG9hZGVkIGRpcmVjdGx5IGluIHRoYXQuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgdW5kZWZpbmVkLCBpdCB3aWxsIGRlZmF1bHQgdG8gdGhlIGN1cnJlbnQgd2luZG93LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgICAgICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fFdpbmRvd30gIFtvcHRpb25zLnRhcmdldD13aW5kb3ddIHRoZSBIVE1MRWxlbWVudCBvciBXaW5kb3cgdG8gbG9hZCB0aGUgZ2FtZSBpblxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudG9rZW5dIHRoZSB0b2tlbiB0byB1c2UgZm9yIHJlYWwgbW9uZXkgcGxheVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMubXV0ZT1mYWxzZV0gc3RhcnQgdGhlIGdhbWUgd2l0aG91dCBzb3VuZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudmVyc2lvbl0gZm9yY2Ugc3BlY2lmaWMgZ2FtZSB2ZXJzaW9uIHN1Y2ggYXMgJzEuMi4zJywgb3IgJ2RldmVsb3BtZW50JyB0byBkaXNhYmxlIGNhY2hlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5oaWRlQ3VycmVuY3ldIGhpZGUgY3VycmVuY3kgc3ltYm9scy9jb2RlcyBpbiB0aGUgZ2FtZVxuICAgICAqXG4gICAgICogQHJldHVybnMge25vbGltaXRBcGl9ICAgICAgICBUaGUgQVBJIGNvbm5lY3Rpb24gdG8gdGhlIG9wZW5lZCBnYW1lLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXBpID0gbm9saW1pdC5sb2FkKHtcbiAgICAgKiAgICBnYW1lOiAnU3BhY2VBcmNhZGUnLFxuICAgICAqICAgIHRhcmdldDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKSxcbiAgICAgKiAgICB0b2tlbjogcmVhbE1vbmV5VG9rZW4sXG4gICAgICogICAgbXV0ZTogdHJ1ZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHRhcmdldCA9IG9wdGlvbnMudGFyZ2V0IHx8IHdpbmRvdztcblxuICAgICAgICB2YXIgZ2FtZU9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG5cbiAgICAgICAgaWYodGFyZ2V0LldpbmRvdyAmJiB0YXJnZXQgaW5zdGFuY2VvZiB0YXJnZXQuV2luZG93KSB7XG4gICAgICAgICAgICB0YXJnZXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgJ3Bvc2l0aW9uOiBmaXhlZDsgdG9wOiAwOyBsZWZ0OiAwOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvdmVyZmxvdzogaGlkZGVuOycpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBpZnJhbWUgPSBtYWtlSWZyYW1lKHRhcmdldCk7XG5cbiAgICAgICAgICAgIHZhciBpZnJhbWVDb25uZWN0aW9uID0gbm9saW1pdEFwaUZhY3RvcnkoaWZyYW1lLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBodG1sKGlmcmFtZS5jb250ZW50V2luZG93LCBnYW1lT3B0aW9ucyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGlmcmFtZSwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHJldHVybiBpZnJhbWVDb25uZWN0aW9uO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgb3B0aW9uIHRhcmdldDogJyArIHRhcmdldDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUgaW4gYSBuZXcsIHNlcGFyYXRlIHBhZ2UuIFRoaXMgb2ZmZXJzIHRoZSBiZXN0IGlzb2xhdGlvbiwgYnV0IG5vIGNvbW11bmljYXRpb24gd2l0aCB0aGUgZ2FtZSBpcyBwb3NzaWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXRdIHRoZSBIVE1MRWxlbWVudCBvciBXaW5kb3cgdG8gbG9hZCB0aGUgZ2FtZSBpblxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudG9rZW5dIHRoZSB0b2tlbiB0byB1c2UgZm9yIHJlYWwgbW9uZXkgcGxheVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMubXV0ZT1mYWxzZV0gc3RhcnQgdGhlIGdhbWUgd2l0aG91dCBzb3VuZFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMudmVyc2lvbl0gZm9yY2Ugc3BlY2lmaWMgZ2FtZSB2ZXJzaW9uIHN1Y2ggYXMgJzEuMi4zJywgb3IgJ2RldmVsb3BtZW50JyB0byBkaXNhYmxlIGNhY2hlXG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5oaWRlQ3VycmVuY3ldIGhpZGUgY3VycmVuY3kgc3ltYm9scy9jb2RlcyBpbiB0aGUgZ2FtZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMubG9iYnlVcmw9XCJoaXN0b3J5OmJhY2soKVwiXSBVUkwgdG8gcmVkaXJlY3QgYmFjayB0byBsb2JieSBvbiBtb2JpbGUsIGlmIG5vdCB1c2luZyBhIHRhcmdldFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuZGVwb3NpdFVybF0gVVJMIHRvIGRlcG9zaXQgcGFnZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0IGVsZW1lbnRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnN1cHBvcnRVcmxdIFVSTCB0byBzdXBwb3J0IHBhZ2UsIGlmIG5vdCB1c2luZyBhIHRhcmdldCBlbGVtZW50XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcGkgPSBub2xpbWl0LmxvYWQoe1xuICAgICAqICAgIGdhbWU6ICdTcGFjZUFyY2FkZScsXG4gICAgICogICAgdGFyZ2V0OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpLFxuICAgICAqICAgIHRva2VuOiByZWFsTW9uZXlUb2tlbixcbiAgICAgKiAgICBtdXRlOiB0cnVlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgcmVwbGFjZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgZ2FtZU9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGxvY2F0aW9uLmhyZWYgPSBSRVBMQUNFX1VSTFxuICAgICAgICAgICAgLnJlcGxhY2UoJ3tDRE59JywgZ2FtZU9wdGlvbnMuY2RuKVxuICAgICAgICAgICAgLnJlcGxhY2UoJ3tRVUVSWX0nLCBtYWtlUXVlcnlTdHJpbmcoZ2FtZU9wdGlvbnMpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZ2FtZSwgc3VjaCBhczogY3VycmVudCB2ZXJzaW9uLCBwcmVmZXJyZWQgd2lkdGgvaGVpZ2h0IGV0Yy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259ICAgIGNhbGxiYWNrICBjYWxsZWQgd2l0aCB0aGUgaW5mbyBvYmplY3QsIGlmIHRoZXJlIHdhcyBhbiBlcnJvciwgdGhlICdlcnJvcicgZmllbGQgd2lsbCBiZSBzZXRcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbmZvKHtnYW1lOiAnU3BhY2VBcmNhZGUnfSwgZnVuY3Rpb24oaW5mbykge1xuICAgICAqICAgICB2YXIgdGFyZ2V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKTtcbiAgICAgKiAgICAgdGFyZ2V0LnN0eWxlLndpZHRoID0gaW5mby5zaXplLndpZHRoICsgJ3B4JztcbiAgICAgKiAgICAgdGFyZ2V0LnN0eWxlLmhlaWdodCA9IGluZm8uc2l6ZS5oZWlnaHQgKyAncHgnO1xuICAgICAqICAgICBjb25zb2xlLmxvZyhpbmZvLm5hbWUsIGluZm8udmVyc2lvbik7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5mbzogZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgb3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKG1lcmdlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpKTtcbiAgICAgICAgaW5mby5sb2FkKG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBtYWtlUXVlcnlTdHJpbmcob3B0aW9ucykge1xuICAgIHZhciBxdWVyeSA9IFtdO1xuICAgIGZvcih2YXIga2V5IGluIG9wdGlvbnMpIHtcbiAgICAgICAgcXVlcnkucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChvcHRpb25zW2tleV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5LmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gbWFrZUlmcmFtZShlbGVtZW50KSB7XG4gICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGNvcHlBdHRyaWJ1dGVzKGVsZW1lbnQsIGlmcmFtZSk7XG5cbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnYWxsb3dmdWxsc2NyZWVuJywgJycpO1xuXG4gICAgdmFyIG5hbWUgPSBnZW5lcmF0ZU5hbWUoaWZyYW1lLmdldEF0dHJpYnV0ZSgnbmFtZScpIHx8IGlmcmFtZS5pZCk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnbmFtZScsIG5hbWUpO1xuXG4gICAgcmV0dXJuIGlmcmFtZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKGdsb2JhbE9wdGlvbnMsIGdhbWVPcHRpb25zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgbmFtZTtcbiAgICBmb3IobmFtZSBpbiBERUZBVUxUX09QVElPTlMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IERFRkFVTFRfT1BUSU9OU1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2FtZU9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdhbWVPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IHJlcXVpcmUoJy4vbm9saW1pdC5jc3MnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBWaWV3cG9ydChoZWFkKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gaGVhZC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ2aWV3cG9ydFwiXScpO1xuICAgIGlmKCF2aWV3cG9ydCkge1xuICAgICAgICBoZWFkLmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgJzxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wLCBtYXhpbXVtLXNjYWxlPTEuMCwgdXNlci1zY2FsYWJsZT1ub1wiPicpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZGV2aWNlID0gb3B0aW9ucy5kZXZpY2UudG9Mb3dlckNhc2UoKTtcbiAgICBvcHRpb25zLm11dGUgPSBvcHRpb25zLm11dGUgfHwgZmFsc2U7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gQ0ROLnJlcGxhY2UoJ3tQUk9UT0NPTH0nLCBsb2NhdGlvbi5wcm90b2NvbCkucmVwbGFjZSgne0VOVn0nLCBlbnZpcm9ubWVudCk7XG4gICAgb3B0aW9ucy5zdGF0aWNSb290ID0gb3B0aW9ucy5zdGF0aWNSb290IHx8IEdBTUVTX1VSTC5yZXBsYWNlKCd7Q0ROfScsIG9wdGlvbnMuY2RuKTtcbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaHRtbCh3aW5kb3csIG9wdGlvbnMpIHtcbiAgICB2YXIgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQ7XG5cbiAgICB3aW5kb3cuZm9jdXMoKTtcblxuICAgIGluc2VydENzcyhkb2N1bWVudCk7XG4gICAgc2V0dXBWaWV3cG9ydChkb2N1bWVudC5oZWFkKTtcblxuICAgIHZhciBsb2FkZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS53aWR0aCA9ICcxMDB2dyc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMTAwdmgnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzIxNDc0ODM2NDcnO1xuICAgIGxvYWRlckVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbG9hZGVyJyk7XG5cbiAgICBsb2FkZXJFbGVtZW50LnNyYyA9IExPQURFUl9VUkxcbiAgICAgICAgLnJlcGxhY2UoJ3tDRE59Jywgb3B0aW9ucy5jZG4pXG4gICAgICAgIC5yZXBsYWNlKCd7REVWSUNFfScsIG9wdGlvbnMuZGV2aWNlKVxuICAgICAgICAucmVwbGFjZSgne09QRVJBVE9SfScsIG9wdGlvbnMub3BlcmF0b3IpXG4gICAgICAgIC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSAnJztcblxuICAgIGxvYWRlckVsZW1lbnQub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5vbignZXJyb3InLCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgaWYobG9hZGVyRWxlbWVudCAmJiBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoeydlcnJvcic6IGVycm9yfSksICcqJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5vbGltaXQuaW5mbyhvcHRpb25zLCBmdW5jdGlvbihpbmZvKSB7XG4gICAgICAgICAgICBpZihpbmZvLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2Vycm9yJywgaW5mby5lcnJvcik7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KGluZm8pLCAnKicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cudHJpZ2dlcignaW5mbycsIGluZm8pO1xuXG4gICAgICAgICAgICAgICAgdmFyIHZlcnNpb24gPSAvXlxcZCtcXC5cXGQrXFwuXFxkKyQvLnRlc3QoaW5mby52ZXJzaW9uKSA/ICcvJyArIGluZm8udmVyc2lvbiA6ICcnO1xuXG4gICAgICAgICAgICAgICAgdmFyIGdhbWVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgZ2FtZUVsZW1lbnQuc3JjID0gb3B0aW9ucy5zdGF0aWNSb290ICsgR0FNRV9KU19VUkwucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKS5yZXBsYWNlKCd7VkVSU0lPTn0nLCB2ZXJzaW9uKTtcblxuICAgICAgICAgICAgICAgIG9wdGlvbnMubG9hZFN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdCA9IHdpbmRvdy5ub2xpbWl0IHx8IHt9O1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChnYW1lRWxlbWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxvYWRlckVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBjb3B5QXR0cmlidXRlcyhmcm9tLCB0bykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZnJvbS5hdHRyaWJ1dGVzO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXTtcbiAgICAgICAgdG8uc2V0QXR0cmlidXRlKGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgfVxufVxuXG52YXIgZ2VuZXJhdGVOYW1lID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5hbWUgfHwgJ05vbGltaXQtJyArIGdlbmVyYXRlZEluZGV4Kys7XG4gICAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdDtcbiJdfQ==
