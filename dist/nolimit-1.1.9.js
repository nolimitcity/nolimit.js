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
                    info.staticRoot = options.staticRoot;
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
            if(e.ports.length > 0) {
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
            port.postMessage(message);
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

var CDN = 'https://{ENV}';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}';
var GAMES_URL = '{CDN}/games';
var GAME_JS_URL = '/{GAME}{VERSION}/game.js';

var DEFAULT_OPTIONS = {
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
     * @property {String} version current version of nolimit.js
     */
    version: '1.1.9',

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
        options.mute = options.mute || false;

        var gameOptions = processOptions(mergeOptions(this.options, options));

        if(target instanceof HTMLElement) {
            var iframe = makeIframe(target);

            var iframeConnection = nolimitApiFactory(iframe, function() {
                html(iframe.contentWindow, gameOptions);
            });

            target.parentNode.replaceChild(iframe, target);
            return iframeConnection;

        } else if(target.Window && target instanceof target.Window) {
            var windowConnection = nolimitApiFactory(target, function() {
                html(target, gameOptions);
            });

            return windowConnection;

        } else {
            throw 'Invalid option target: ' + target;
        }
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
     *     target.style.width = info.size.width;
     *     target.style.height = info.size.height;
     *     console.log(info.name, info.version);
     * });
     */
    info: function(options, callback) {
        options = processOptions(mergeOptions(this.options, options));
        info.load(options, callback);
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
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">');
    }
}

function processOptions(options) {
    options['nolimit.js'] = '1.1.9';
    options.device = options.device.toLowerCase();
    var environment = options.environment.toLowerCase();
    if(environment.indexOf('.') === -1) {
        environment += '.nolimitcdn.com';
    }
    options.cdn = CDN.replace('{ENV}', environment);
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
            if(loaderElement) {
                loaderElement.contentWindow.sendMessage('error', error);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSU5GT19KU09OX1VSTCA9ICcve0dBTUV9L2luZm8uanNvbic7XG5cbnZhciBjYWNoZSA9IHt9O1xuXG52YXIgaW5mbyA9IHtcbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgdXJsID0gb3B0aW9ucy5zdGF0aWNSb290ICsgSU5GT19KU09OX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgICAgIHZhciBpbmZvID0gY2FjaGVbdXJsXTtcbiAgICAgICAgaWYoaW5mbykge1xuICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgZnVuY3Rpb24gb25GYWlsKCkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gcmVxdWVzdC5zdGF0dXNUZXh0IHx8ICdObyBlcnJvciBtZXNzYWdlIGF2YWlsYWJsZTsgcHJvYmFibHkgYSBDT1JTIGlzc3VlLic7XG4gICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYocmVxdWVzdC5zdGF0dXMgPj0gMjAwICYmIHJlcXVlc3Quc3RhdHVzIDwgNDAwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZm8gPSBKU09OLnBhcnNlKHJlcXVlc3QucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgaW5mby5zdGF0aWNSb290ID0gb3B0aW9ucy5zdGF0aWNSb290O1xuICAgICAgICAgICAgICAgICAgICBjYWNoZVt1cmxdID0gaW5mbztcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soaW5mbyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvbkZhaWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBvbkZhaWw7XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbmZvO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRBcGlGYWN0b3J5XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSBmdW5jdGlvbih0YXJnZXQsIG9ubG9hZCkge1xuXG4gICAgdmFyIGxpc3RlbmVycyA9IHt9O1xuICAgIHZhciB1bmhhbmRsZWRFdmVudHMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkQ2FsbHMgPSBbXTtcbiAgICB2YXIgcG9ydDtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpIHtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkQ2FsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZSh1bmhhbmRsZWRDYWxscy5zaGlmdCgpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZE1lc3NhZ2VMaXN0ZW5lcihnYW1lV2luZG93KSB7XG4gICAgICAgIGdhbWVXaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIGlmKGUucG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBlLnBvcnRzWzBdO1xuICAgICAgICAgICAgICAgIHBvcnQub25tZXNzYWdlID0gb25NZXNzYWdlO1xuICAgICAgICAgICAgICAgIHJlZ2lzdGVyRXZlbnRzKE9iamVjdC5rZXlzKGxpc3RlbmVycykpO1xuICAgICAgICAgICAgICAgIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZ2FtZVdpbmRvdy50cmlnZ2VyID0gdHJpZ2dlcjtcbiAgICAgICAgZ2FtZVdpbmRvdy5vbiA9IG9uO1xuICAgICAgICBvbmxvYWQoKTtcbiAgICB9XG5cbiAgICBpZih0YXJnZXQubm9kZU5hbWUgPT09ICdJRlJBTUUnKSB7XG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0LmNvbnRlbnRXaW5kb3cpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UoZSkge1xuICAgICAgICB0cmlnZ2VyKGUuZGF0YS5tZXRob2QsIGUuZGF0YS5wYXJhbXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlKG1ldGhvZCwgZGF0YSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICAgICAgfTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgICBtZXNzYWdlLnBhcmFtcyA9IGRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwb3J0KSB7XG4gICAgICAgICAgICBwb3J0LnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkQ2FsbHMucHVzaChtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyRXZlbnRzKGV2ZW50cykge1xuICAgICAgICBzZW5kTWVzc2FnZSgncmVnaXN0ZXInLCBldmVudHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgaWYobGlzdGVuZXJzW2V2ZW50XSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXSA9IHVuaGFuZGxlZEV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICAgICAgICAgIHVuaGFuZGxlZEV2ZW50c1tuYW1lXS5wdXNoKGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0gPSBsaXN0ZW5lcnNbZXZlbnRdIHx8IFtdO1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgICAgICB3aGlsZSh1bmhhbmRsZWRFdmVudHNbZXZlbnRdICYmIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJpZ2dlcihldmVudCwgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5wb3AoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZWdpc3RlckV2ZW50cyhbZXZlbnRdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0aW9uIHRvIHRoZSBnYW1lIHVzaW5nIE1lc3NhZ2VDaGFubmVsXG4gICAgICogQGV4cG9ydHMgbm9saW1pdEFwaVxuICAgICAqL1xuICAgIHZhciBub2xpbWl0QXBpID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGxpc3RlbmVyIGZvciBldmVudCBmcm9tIHRoZSBzdGFydGVkIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIG9uXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgIGV2ZW50ICAgIG5hbWUgb2YgdGhlIGV2ZW50XG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIGNhbGxiYWNrIGZvciB0aGUgZXZlbnQsIHNlZSBzcGVjaWZpYyBldmVudCBkb2N1bWVudGF0aW9uIGZvciBhbnkgcGFyYW1ldGVyc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiBhcGkub24oJ2RlcG9zaXQnLCBmdW5jdGlvbiBvcGVuRGVwb3NpdCAoKSB7XG4gICAgICAgICAqICAgICBzaG93RGVwb3NpdCgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAqICAgICAgICAgLy8gYXNrIHRoZSBnYW1lIHRvIHJlZnJlc2ggYmFsYW5jZSBmcm9tIHNlcnZlclxuICAgICAgICAgKiAgICAgICAgIGFwaS5jYWxsKCdyZWZyZXNoJyk7XG4gICAgICAgICAqICAgICB9KTtcbiAgICAgICAgICogfSk7XG4gICAgICAgICAqL1xuICAgICAgICBvbjogb24sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGwgbWV0aG9kIGluIHRoZSBvcGVuIGdhbWVcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG1ldGhvZCBuYW1lIG9mIHRoZSBtZXRob2QgdG8gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIG9wdGlvbmFsIGRhdGEgZm9yIHRoZSBtZXRob2QgY2FsbGVkLCBpZiBhbnlcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gcmVsb2FkIHRoZSBnYW1lXG4gICAgICAgICAqIGFwaS5jYWxsKCdyZWxvYWQnKTtcbiAgICAgICAgICovXG4gICAgICAgIGNhbGw6IHNlbmRNZXNzYWdlXG4gICAgfTtcblxuICAgIHJldHVybiBub2xpbWl0QXBpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBub2xpbWl0QXBpRmFjdG9yeTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJ2h0bWwsIGJvZHkge1xcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xcbiAgICBtYXJnaW46IDA7XFxuICAgIHdpZHRoOiAxMDAlO1xcbiAgICBoZWlnaHQ6IDEwMCU7XFxufVxcblxcbmJvZHkge1xcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XFxufVxcbic7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSByZXF1aXJlKCcuL25vbGltaXQtYXBpJyk7XG52YXIgaW5mbyA9IHJlcXVpcmUoJy4vaW5mbycpO1xuXG52YXIgQ0ROID0gJ2h0dHBzOi8ve0VOVn0nO1xudmFyIExPQURFUl9VUkwgPSAne0NETn0vbG9hZGVyL2xvYWRlci17REVWSUNFfS5odG1sP29wZXJhdG9yPXtPUEVSQVRPUn0mZ2FtZT17R0FNRX0nO1xudmFyIEdBTUVTX1VSTCA9ICd7Q0ROfS9nYW1lcyc7XG52YXIgR0FNRV9KU19VUkwgPSAnL3tHQU1FfXtWRVJTSU9OfS9nYW1lLmpzJztcblxudmFyIERFRkFVTFRfT1BUSU9OUyA9IHtcbiAgICBkZXZpY2U6ICdkZXNrdG9wJyxcbiAgICBlbnZpcm9ubWVudDogJ3BhcnRuZXInLFxuICAgIGxhbmd1YWdlOiAnZW4nLFxuICAgIGxvYWRlcjogJ25vbGltaXQuanMnXG59O1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRcbiAqL1xudmFyIG5vbGltaXQgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge1N0cmluZ30gdmVyc2lvbiBjdXJyZW50IHZlcnNpb24gb2Ygbm9saW1pdC5qc1xuICAgICAqL1xuICAgIHZlcnNpb246ICcxLjEuOScsXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGxvYWRlciB3aXRoIGRlZmF1bHQgcGFyYW1ldGVycy4gQ2FuIGJlIHNraXBwZWQgaWYgdGhlIHBhcmFtZXRlcnMgYXJlIGluY2x1ZGVkIGluIHRoZSBjYWxsIHRvIGxvYWQgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgb3B0aW9ucy5vcGVyYXRvciB0aGUgb3BlcmF0b3IgY29kZSBmb3IgdGhlIG9wZXJhdG9yXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5sYW5ndWFnZT1cImVuXCJdIHRoZSBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5kZXZpY2U9ZGVza3RvcF0gdHlwZSBvZiBkZXZpY2U6ICdkZXNrdG9wJyBvciAnbW9iaWxlJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmN1cnJlbmN5PUVVUl0gY3VycmVuY3kgdG8gdXNlLCBpZiBub3QgcHJvdmlkZWQgYnkgc2VydmVyXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5pdCh7XG4gICAgICogICAgb3BlcmF0b3I6ICdTTU9PVEhPUEVSQVRPUicsXG4gICAgICogICAgbGFuZ3VhZ2U6ICdzdicsXG4gICAgICogICAgZGV2aWNlOiAnbW9iaWxlJyxcbiAgICAgKiAgICBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgICAqICAgIGN1cnJlbmN5OiAnU0VLJ1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUsIHJlcGxhY2luZyB0YXJnZXQgd2l0aCB0aGUgZ2FtZS5cbiAgICAgKlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgSFRNTCBlbGVtZW50LCBpdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gaWZyYW1lLCBrZWVwaW5nIGFsbCB0aGUgYXR0cmlidXRlcyBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCwgc28gdGhvc2UgY2FuIGJlIHVzZWQgdG8gc2V0IGlkLCBjbGFzc2VzLCBzdHlsZXMgYW5kIG1vcmUuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBXaW5kb3cgZWxlbWVudCwgdGhlIGdhbWUgd2lsbCBiZSBsb2FkZWQgZGlyZWN0bHkgaW4gdGhhdC5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgZGVmYXVsdCB0byB0aGUgY3VycmVudCB3aW5kb3cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8V2luZG93fSAgW29wdGlvbnMudGFyZ2V0PXdpbmRvd10gdGhlIEhUTUxFbGVtZW50IG9yIFdpbmRvdyB0byBsb2FkIHRoZSBnYW1lIGluXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtub2xpbWl0QXBpfSAgICAgICAgVGhlIEFQSSBjb25uZWN0aW9uIHRvIHRoZSBvcGVuZWQgZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ1NwYWNlQXJjYWRlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciB0YXJnZXQgPSBvcHRpb25zLnRhcmdldCB8fCB3aW5kb3c7XG4gICAgICAgIG9wdGlvbnMubXV0ZSA9IG9wdGlvbnMubXV0ZSB8fCBmYWxzZTtcblxuICAgICAgICB2YXIgZ2FtZU9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG5cbiAgICAgICAgaWYodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBpZnJhbWUgPSBtYWtlSWZyYW1lKHRhcmdldCk7XG5cbiAgICAgICAgICAgIHZhciBpZnJhbWVDb25uZWN0aW9uID0gbm9saW1pdEFwaUZhY3RvcnkoaWZyYW1lLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBodG1sKGlmcmFtZS5jb250ZW50V2luZG93LCBnYW1lT3B0aW9ucyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGlmcmFtZSwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHJldHVybiBpZnJhbWVDb25uZWN0aW9uO1xuXG4gICAgICAgIH0gZWxzZSBpZih0YXJnZXQuV2luZG93ICYmIHRhcmdldCBpbnN0YW5jZW9mIHRhcmdldC5XaW5kb3cpIHtcbiAgICAgICAgICAgIHZhciB3aW5kb3dDb25uZWN0aW9uID0gbm9saW1pdEFwaUZhY3RvcnkodGFyZ2V0LCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBodG1sKHRhcmdldCwgZ2FtZU9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB3aW5kb3dDb25uZWN0aW9uO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyAnSW52YWxpZCBvcHRpb24gdGFyZ2V0OiAnICsgdGFyZ2V0O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIExvYWQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGdhbWUsIHN1Y2ggYXM6IGN1cnJlbnQgdmVyc2lvbiwgcHJlZmVycmVkIHdpZHRoL2hlaWdodCBldGMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgW29wdGlvbnMuZW52aXJvbm1lbnQ9cGFydG5lcl0gd2hpY2ggZW52aXJvbm1lbnQgdG8gdXNlOyB1c3VhbGx5ICdwYXJ0bmVyJyBvciAncHJvZHVjdGlvbidcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBvcHRpb25zLmdhbWUgY2FzZSBzZW5zaXRpdmUgZ2FtZSBjb2RlLCBmb3IgZXhhbXBsZSAnQ3JlZXB5Q2Fybml2YWwnIG9yICdTcGFjZUFyY2FkZSdcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSAgICBjYWxsYmFjayAgY2FsbGVkIHdpdGggdGhlIGluZm8gb2JqZWN0LCBpZiB0aGVyZSB3YXMgYW4gZXJyb3IsIHRoZSAnZXJyb3InIGZpZWxkIHdpbGwgYmUgc2V0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG5vbGltaXQuaW5mbyh7Z2FtZTogJ1NwYWNlQXJjYWRlJ30sIGZ1bmN0aW9uKGluZm8pIHtcbiAgICAgKiAgICAgdmFyIHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyk7XG4gICAgICogICAgIHRhcmdldC5zdHlsZS53aWR0aCA9IGluZm8uc2l6ZS53aWR0aDtcbiAgICAgKiAgICAgdGFyZ2V0LnN0eWxlLmhlaWdodCA9IGluZm8uc2l6ZS5oZWlnaHQ7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGluZm8ubmFtZSwgaW5mby52ZXJzaW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbmZvOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBvcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICBpbmZvLmxvYWQob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG1ha2VJZnJhbWUoZWxlbWVudCkge1xuICAgIHZhciBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBjb3B5QXR0cmlidXRlcyhlbGVtZW50LCBpZnJhbWUpO1xuXG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIHZhciBuYW1lID0gZ2VuZXJhdGVOYW1lKGlmcmFtZS5nZXRBdHRyaWJ1dGUoJ25hbWUnKSB8fCBpZnJhbWUuaWQpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ25hbWUnLCBuYW1lKTtcblxuICAgIGlmcmFtZS5zdHlsZS5kaXNwbGF5ID0gZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5kaXNwbGF5O1xuXG4gICAgcmV0dXJuIGlmcmFtZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKGdsb2JhbE9wdGlvbnMsIGdhbWVPcHRpb25zKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgbmFtZTtcbiAgICBmb3IobmFtZSBpbiBERUZBVUxUX09QVElPTlMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IERFRkFVTFRfT1BUSU9OU1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2FtZU9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdhbWVPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IHJlcXVpcmUoJy4vbm9saW1pdC5jc3MnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBWaWV3cG9ydChoZWFkKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gaGVhZC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ2aWV3cG9ydFwiXScpO1xuICAgIGlmKCF2aWV3cG9ydCkge1xuICAgICAgICBoZWFkLmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgJzxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wLCBtYXhpbXVtLXNjYWxlPTEuMCwgdXNlci1zY2FsYWJsZT0wXCI+Jyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzT3B0aW9ucyhvcHRpb25zKSB7XG4gICAgb3B0aW9uc1snbm9saW1pdC5qcyddID0gJzEuMS45JztcbiAgICBvcHRpb25zLmRldmljZSA9IG9wdGlvbnMuZGV2aWNlLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gQ0ROLnJlcGxhY2UoJ3tFTlZ9JywgZW52aXJvbm1lbnQpO1xuICAgIG9wdGlvbnMuc3RhdGljUm9vdCA9IG9wdGlvbnMuc3RhdGljUm9vdCB8fCBHQU1FU19VUkwucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbik7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGh0bWwod2luZG93LCBvcHRpb25zKSB7XG4gICAgdmFyIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50O1xuXG4gICAgd2luZG93LmZvY3VzKCk7XG5cbiAgICBpbnNlcnRDc3MoZG9jdW1lbnQpO1xuICAgIHNldHVwVmlld3BvcnQoZG9jdW1lbnQuaGVhZCk7XG5cbiAgICB2YXIgbG9hZGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGxvYWRlckVsZW1lbnQuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUud2lkdGggPSAnMTAwdncnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gJzEwMHZoJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLnpJbmRleCA9ICcyMTQ3NDgzNjQ3JztcbiAgICBsb2FkZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2xvYWRlcicpO1xuXG4gICAgbG9hZGVyRWxlbWVudC5zcmMgPSBMT0FERVJfVVJMXG4gICAgICAgIC5yZXBsYWNlKCd7Q0ROfScsIG9wdGlvbnMuY2RuKVxuICAgICAgICAucmVwbGFjZSgne0RFVklDRX0nLCBvcHRpb25zLmRldmljZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tPUEVSQVRPUn0nLCBvcHRpb25zLm9wZXJhdG9yKVxuICAgICAgICAucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cuc2VuZE1lc3NhZ2UoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBub2xpbWl0LmluZm8ob3B0aW9ucywgZnVuY3Rpb24oaW5mbykge1xuICAgICAgICAgICAgaWYoaW5mby5lcnJvcikge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdlcnJvcicsIGluZm8uZXJyb3IpO1xuICAgICAgICAgICAgICAgIGxvYWRlckVsZW1lbnQuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShpbmZvKSwgJyonKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2luZm8nLCBpbmZvKTtcblxuICAgICAgICAgICAgICAgIHZhciB2ZXJzaW9uID0gL15cXGQrXFwuXFxkK1xcLlxcZCskLy50ZXN0KGluZm8udmVyc2lvbikgPyAnLycgKyBpbmZvLnZlcnNpb24gOiAnJztcblxuICAgICAgICAgICAgICAgIHZhciBnYW1lRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IG9wdGlvbnMuc3RhdGljUm9vdCArIEdBTUVfSlNfVVJMLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSkucmVwbGFjZSgne1ZFUlNJT059JywgdmVyc2lvbik7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxvYWRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQgPSB3aW5kb3cubm9saW1pdCB8fCB7fTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdC5vcHRpb25zID0gb3B0aW9ucztcblxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsb2FkZXJFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gY29weUF0dHJpYnV0ZXMoZnJvbSwgdG8pIHtcbiAgICB2YXIgYXR0cmlidXRlcyA9IGZyb20uYXR0cmlidXRlcztcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXR0ciA9IGF0dHJpYnV0ZXNbaV07XG4gICAgICAgIHRvLnNldEF0dHJpYnV0ZShhdHRyLm5hbWUsIGF0dHIudmFsdWUpO1xuICAgIH1cbn1cblxudmFyIGdlbmVyYXRlTmFtZSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZ2VuZXJhdGVkSW5kZXggPSAxO1xuICAgIHJldHVybiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBuYW1lIHx8ICdOb2xpbWl0LScgKyBnZW5lcmF0ZWRJbmRleCsrO1xuICAgIH07XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXQ7XG4iXX0=
