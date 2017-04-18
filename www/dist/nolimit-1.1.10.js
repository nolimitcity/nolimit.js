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
    version: '1.1.10',

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
    options['nolimit.js'] = '1.1.10';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSU5GT19KU09OX1VSTCA9ICcve0dBTUV9L2luZm8uanNvbic7XG5cbnZhciBjYWNoZSA9IHt9O1xuXG52YXIgaW5mbyA9IHtcbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgdXJsID0gb3B0aW9ucy5zdGF0aWNSb290ICsgSU5GT19KU09OX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgICAgIHZhciBpbmZvID0gY2FjaGVbdXJsXTtcbiAgICAgICAgaWYoaW5mbykge1xuICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgZnVuY3Rpb24gb25GYWlsKCkge1xuICAgICAgICAgICAgdmFyIGVycm9yID0gcmVxdWVzdC5zdGF0dXNUZXh0IHx8ICdObyBlcnJvciBtZXNzYWdlIGF2YWlsYWJsZTsgcHJvYmFibHkgYSBDT1JTIGlzc3VlLic7XG4gICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYocmVxdWVzdC5zdGF0dXMgPj0gMjAwICYmIHJlcXVlc3Quc3RhdHVzIDwgNDAwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZm8gPSBKU09OLnBhcnNlKHJlcXVlc3QucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgaW5mby52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uIHx8IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgaW5mby5zdGF0aWNSb290ID0gW29wdGlvbnMuc3RhdGljUm9vdCwgaW5mby5uYW1lLCBpbmZvLnZlcnNpb25dLmpvaW4oJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGVbdXJsXSA9IGluZm87XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGluZm8pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogZS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb25GYWlsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gb25GYWlsO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW5mbztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0QXBpRmFjdG9yeVxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gZnVuY3Rpb24odGFyZ2V0LCBvbmxvYWQpIHtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkRXZlbnRzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZENhbGxzID0gW107XG4gICAgdmFyIHBvcnQ7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KSB7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZENhbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UodW5oYW5kbGVkQ2FsbHMuc2hpZnQoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRNZXNzYWdlTGlzdGVuZXIoZ2FtZVdpbmRvdykge1xuICAgICAgICBnYW1lV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZihlLnBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gZS5wb3J0c1swXTtcbiAgICAgICAgICAgICAgICBwb3J0Lm9ubWVzc2FnZSA9IG9uTWVzc2FnZTtcbiAgICAgICAgICAgICAgICByZWdpc3RlckV2ZW50cyhPYmplY3Qua2V5cyhsaXN0ZW5lcnMpKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGdhbWVXaW5kb3cudHJpZ2dlciA9IHRyaWdnZXI7XG4gICAgICAgIGdhbWVXaW5kb3cub24gPSBvbjtcbiAgICAgICAgb25sb2FkKCk7XG4gICAgfVxuXG4gICAgaWYodGFyZ2V0Lm5vZGVOYW1lID09PSAnSUZSQU1FJykge1xuICAgICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldC5jb250ZW50V2luZG93KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKGUpIHtcbiAgICAgICAgdHJpZ2dlcihlLmRhdGEubWV0aG9kLCBlLmRhdGEucGFyYW1zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZW5kTWVzc2FnZShtZXRob2QsIGRhdGEpIHtcbiAgICAgICAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYoZGF0YSkge1xuICAgICAgICAgICAgbWVzc2FnZS5wYXJhbXMgPSBkYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYocG9ydCkge1xuICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlckV2ZW50cyhldmVudHMpIHtcbiAgICAgICAgc2VuZE1lc3NhZ2UoJ3JlZ2lzdGVyJywgZXZlbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIGlmKGxpc3RlbmVyc1tldmVudF0pIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc1tldmVudF0uZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0gPSB1bmhhbmRsZWRFdmVudHNbbmFtZV0gfHwgW107XG4gICAgICAgICAgICB1bmhhbmRsZWRFdmVudHNbbmFtZV0ucHVzaChkYXRhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdID0gbGlzdGVuZXJzW2V2ZW50XSB8fCBbXTtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgd2hpbGUodW5oYW5kbGVkRXZlbnRzW2V2ZW50XSAmJiB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyaWdnZXIoZXZlbnQsIHVuaGFuZGxlZEV2ZW50c1tldmVudF0ucG9wKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVnaXN0ZXJFdmVudHMoW2V2ZW50XSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdGlvbiB0byB0aGUgZ2FtZSB1c2luZyBNZXNzYWdlQ2hhbm5lbFxuICAgICAqIEBleHBvcnRzIG5vbGltaXRBcGlcbiAgICAgKi9cbiAgICB2YXIgbm9saW1pdEFwaSA9IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBsaXN0ZW5lciBmb3IgZXZlbnQgZnJvbSB0aGUgc3RhcnRlZCBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBvblxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gICBldmVudCAgICBuYW1lIG9mIHRoZSBldmVudFxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBjYWxsYmFjayBmb3IgdGhlIGV2ZW50LCBzZWUgc3BlY2lmaWMgZXZlbnQgZG9jdW1lbnRhdGlvbiBmb3IgYW55IHBhcmFtZXRlcnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogYXBpLm9uKCdkZXBvc2l0JywgZnVuY3Rpb24gb3BlbkRlcG9zaXQgKCkge1xuICAgICAgICAgKiAgICAgc2hvd0RlcG9zaXQoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgKiAgICAgICAgIC8vIGFzayB0aGUgZ2FtZSB0byByZWZyZXNoIGJhbGFuY2UgZnJvbSBzZXJ2ZXJcbiAgICAgICAgICogICAgICAgICBhcGkuY2FsbCgncmVmcmVzaCcpO1xuICAgICAgICAgKiAgICAgfSk7XG4gICAgICAgICAqIH0pO1xuICAgICAgICAgKi9cbiAgICAgICAgb246IG9uLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIG1ldGhvZCBpbiB0aGUgb3BlbiBnYW1lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBmdW5jdGlvbiBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBtZXRob2QgbmFtZSBvZiB0aGUgbWV0aG9kIHRvIGNhbGxcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtkYXRhXSBvcHRpb25hbCBkYXRhIGZvciB0aGUgbWV0aG9kIGNhbGxlZCwgaWYgYW55XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIHJlbG9hZCB0aGUgZ2FtZVxuICAgICAgICAgKiBhcGkuY2FsbCgncmVsb2FkJyk7XG4gICAgICAgICAqL1xuICAgICAgICBjYWxsOiBzZW5kTWVzc2FnZVxuICAgIH07XG5cbiAgICByZXR1cm4gbm9saW1pdEFwaTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdEFwaUZhY3Rvcnk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9ICdodG1sLCBib2R5IHtcXG4gICAgb3ZlcmZsb3c6IGhpZGRlbjtcXG4gICAgbWFyZ2luOiAwO1xcbiAgICB3aWR0aDogMTAwJTtcXG4gICAgaGVpZ2h0OiAxMDAlO1xcbn1cXG5cXG5ib2R5IHtcXG4gICAgcG9zaXRpb246IHJlbGF0aXZlO1xcbn1cXG4nOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gcmVxdWlyZSgnLi9ub2xpbWl0LWFwaScpO1xudmFyIGluZm8gPSByZXF1aXJlKCcuL2luZm8nKTtcblxudmFyIENETiA9ICdodHRwczovL3tFTlZ9JztcbnZhciBMT0FERVJfVVJMID0gJ3tDRE59L2xvYWRlci9sb2FkZXIte0RFVklDRX0uaHRtbD9vcGVyYXRvcj17T1BFUkFUT1J9JmdhbWU9e0dBTUV9JztcbnZhciBHQU1FU19VUkwgPSAne0NETn0vZ2FtZXMnO1xudmFyIEdBTUVfSlNfVVJMID0gJy97R0FNRX17VkVSU0lPTn0vZ2FtZS5qcyc7XG5cbnZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgZGV2aWNlOiAnZGVza3RvcCcsXG4gICAgZW52aXJvbm1lbnQ6ICdwYXJ0bmVyJyxcbiAgICBsYW5ndWFnZTogJ2VuJyxcbiAgICBsb2FkZXI6ICdub2xpbWl0LmpzJ1xufTtcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0XG4gKi9cbnZhciBub2xpbWl0ID0ge1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHtTdHJpbmd9IHZlcnNpb24gY3VycmVudCB2ZXJzaW9uIG9mIG5vbGltaXQuanNcbiAgICAgKi9cbiAgICB2ZXJzaW9uOiAnMS4xLjEwJyxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgbG9hZGVyIHdpdGggZGVmYXVsdCBwYXJhbWV0ZXJzLiBDYW4gYmUgc2tpcHBlZCBpZiB0aGUgcGFyYW1ldGVycyBhcmUgaW5jbHVkZWQgaW4gdGhlIGNhbGwgdG8gbG9hZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBvcHRpb25zLm9wZXJhdG9yIHRoZSBvcGVyYXRvciBjb2RlIGZvciB0aGUgb3BlcmF0b3JcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmxhbmd1YWdlPVwiZW5cIl0gdGhlIGxhbmd1YWdlIHRvIHVzZSBmb3IgdGhlIGdhbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmRldmljZT1kZXNrdG9wXSB0eXBlIG9mIGRldmljZTogJ2Rlc2t0b3AnIG9yICdtb2JpbGUnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuY3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2UsIGlmIG5vdCBwcm92aWRlZCBieSBzZXJ2ZXJcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbml0KHtcbiAgICAgKiAgICBvcGVyYXRvcjogJ1NNT09USE9QRVJBVE9SJyxcbiAgICAgKiAgICBsYW5ndWFnZTogJ3N2JyxcbiAgICAgKiAgICBkZXZpY2U6ICdtb2JpbGUnLFxuICAgICAqICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICogICAgY3VycmVuY3k6ICdTRUsnXG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSwgcmVwbGFjaW5nIHRhcmdldCB3aXRoIHRoZSBnYW1lLlxuICAgICAqXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBIVE1MIGVsZW1lbnQsIGl0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBpZnJhbWUsIGtlZXBpbmcgYWxsIHRoZSBhdHRyaWJ1dGVzIG9mIHRoZSBvcmlnaW5hbCBlbGVtZW50LCBzbyB0aG9zZSBjYW4gYmUgdXNlZCB0byBzZXQgaWQsIGNsYXNzZXMsIHN0eWxlcyBhbmQgbW9yZS5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyBhIFdpbmRvdyBlbGVtZW50LCB0aGUgZ2FtZSB3aWxsIGJlIGxvYWRlZCBkaXJlY3RseSBpbiB0aGF0LlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBkZWZhdWx0IHRvIHRoZSBjdXJyZW50IHdpbmRvdy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqXG4gICAgICogQHJldHVybnMge25vbGltaXRBcGl9ICAgICAgICBUaGUgQVBJIGNvbm5lY3Rpb24gdG8gdGhlIG9wZW5lZCBnYW1lLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXBpID0gbm9saW1pdC5sb2FkKHtcbiAgICAgKiAgICBnYW1lOiAnU3BhY2VBcmNhZGUnLFxuICAgICAqICAgIHRhcmdldDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKSxcbiAgICAgKiAgICB0b2tlbjogcmVhbE1vbmV5VG9rZW4sXG4gICAgICogICAgbXV0ZTogdHJ1ZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHRhcmdldCA9IG9wdGlvbnMudGFyZ2V0IHx8IHdpbmRvdztcbiAgICAgICAgb3B0aW9ucy5tdXRlID0gb3B0aW9ucy5tdXRlIHx8IGZhbHNlO1xuXG4gICAgICAgIHZhciBnYW1lT3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKG1lcmdlT3B0aW9ucyh0aGlzLm9wdGlvbnMsIG9wdGlvbnMpKTtcblxuICAgICAgICBpZih0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIGlmcmFtZSA9IG1ha2VJZnJhbWUodGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIGlmcmFtZUNvbm5lY3Rpb24gPSBub2xpbWl0QXBpRmFjdG9yeShpZnJhbWUsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGh0bWwoaWZyYW1lLmNvbnRlbnRXaW5kb3csIGdhbWVPcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0YXJnZXQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoaWZyYW1lLCB0YXJnZXQpO1xuICAgICAgICAgICAgcmV0dXJuIGlmcmFtZUNvbm5lY3Rpb247XG5cbiAgICAgICAgfSBlbHNlIGlmKHRhcmdldC5XaW5kb3cgJiYgdGFyZ2V0IGluc3RhbmNlb2YgdGFyZ2V0LldpbmRvdykge1xuICAgICAgICAgICAgdmFyIHdpbmRvd0Nvbm5lY3Rpb24gPSBub2xpbWl0QXBpRmFjdG9yeSh0YXJnZXQsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGh0bWwodGFyZ2V0LCBnYW1lT3B0aW9ucyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHdpbmRvd0Nvbm5lY3Rpb247XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIG9wdGlvbiB0YXJnZXQ6ICcgKyB0YXJnZXQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZ2FtZSwgc3VjaCBhczogY3VycmVudCB2ZXJzaW9uLCBwcmVmZXJyZWQgd2lkdGgvaGVpZ2h0IGV0Yy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdDcmVlcHlDYXJuaXZhbCcgb3IgJ1NwYWNlQXJjYWRlJ1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259ICAgIGNhbGxiYWNrICBjYWxsZWQgd2l0aCB0aGUgaW5mbyBvYmplY3QsIGlmIHRoZXJlIHdhcyBhbiBlcnJvciwgdGhlICdlcnJvcicgZmllbGQgd2lsbCBiZSBzZXRcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbmZvKHtnYW1lOiAnU3BhY2VBcmNhZGUnfSwgZnVuY3Rpb24oaW5mbykge1xuICAgICAqICAgICB2YXIgdGFyZ2V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKTtcbiAgICAgKiAgICAgdGFyZ2V0LnN0eWxlLndpZHRoID0gaW5mby5zaXplLndpZHRoO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaW5mby5zaXplLmhlaWdodDtcbiAgICAgKiAgICAgY29uc29sZS5sb2coaW5mby5uYW1lLCBpbmZvLnZlcnNpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGluZm86IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG4gICAgICAgIGluZm8ubG9hZChvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbWFrZUlmcmFtZShlbGVtZW50KSB7XG4gICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGNvcHlBdHRyaWJ1dGVzKGVsZW1lbnQsIGlmcmFtZSk7XG5cbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgdmFyIG5hbWUgPSBnZW5lcmF0ZU5hbWUoaWZyYW1lLmdldEF0dHJpYnV0ZSgnbmFtZScpIHx8IGlmcmFtZS5pZCk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnbmFtZScsIG5hbWUpO1xuXG4gICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSBnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpLmRpc3BsYXk7XG5cbiAgICByZXR1cm4gaWZyYW1lO1xufVxuXG5mdW5jdGlvbiBtZXJnZU9wdGlvbnMoZ2xvYmFsT3B0aW9ucywgZ2FtZU9wdGlvbnMpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHt9LCBuYW1lO1xuICAgIGZvcihuYW1lIGluIERFRkFVTFRfT1BUSU9OUykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gREVGQVVMVF9PUFRJT05TW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnbG9iYWxPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBnbG9iYWxPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICBmb3IobmFtZSBpbiBnYW1lT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2FtZU9wdGlvbnNbbmFtZV07XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBpbnNlcnRDc3MoZG9jdW1lbnQpIHtcbiAgICB2YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gcmVxdWlyZSgnLi9ub2xpbWl0LmNzcycpO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufVxuXG5mdW5jdGlvbiBzZXR1cFZpZXdwb3J0KGhlYWQpIHtcbiAgICB2YXIgdmlld3BvcnQgPSBoZWFkLnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT1cInZpZXdwb3J0XCJdJyk7XG4gICAgaWYoIXZpZXdwb3J0KSB7XG4gICAgICAgIGhlYWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCAnPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAsIG1heGltdW0tc2NhbGU9MS4wLCB1c2VyLXNjYWxhYmxlPTBcIj4nKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NPcHRpb25zKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zWydub2xpbWl0LmpzJ10gPSAnMS4xLjEwJztcbiAgICBvcHRpb25zLmRldmljZSA9IG9wdGlvbnMuZGV2aWNlLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gQ0ROLnJlcGxhY2UoJ3tFTlZ9JywgZW52aXJvbm1lbnQpO1xuICAgIG9wdGlvbnMuc3RhdGljUm9vdCA9IG9wdGlvbnMuc3RhdGljUm9vdCB8fCBHQU1FU19VUkwucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbik7XG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGh0bWwod2luZG93LCBvcHRpb25zKSB7XG4gICAgdmFyIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50O1xuXG4gICAgd2luZG93LmZvY3VzKCk7XG5cbiAgICBpbnNlcnRDc3MoZG9jdW1lbnQpO1xuICAgIHNldHVwVmlld3BvcnQoZG9jdW1lbnQuaGVhZCk7XG5cbiAgICB2YXIgbG9hZGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGxvYWRlckVsZW1lbnQuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUud2lkdGggPSAnMTAwdncnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gJzEwMHZoJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLnpJbmRleCA9ICcyMTQ3NDgzNjQ3JztcbiAgICBsb2FkZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2xvYWRlcicpO1xuXG4gICAgbG9hZGVyRWxlbWVudC5zcmMgPSBMT0FERVJfVVJMXG4gICAgICAgIC5yZXBsYWNlKCd7Q0ROfScsIG9wdGlvbnMuY2RuKVxuICAgICAgICAucmVwbGFjZSgne0RFVklDRX0nLCBvcHRpb25zLmRldmljZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tPUEVSQVRPUn0nLCBvcHRpb25zLm9wZXJhdG9yKVxuICAgICAgICAucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cuc2VuZE1lc3NhZ2UoJ2Vycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBub2xpbWl0LmluZm8ob3B0aW9ucywgZnVuY3Rpb24oaW5mbykge1xuICAgICAgICAgICAgaWYoaW5mby5lcnJvcikge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdlcnJvcicsIGluZm8uZXJyb3IpO1xuICAgICAgICAgICAgICAgIGxvYWRlckVsZW1lbnQuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShpbmZvKSwgJyonKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2luZm8nLCBpbmZvKTtcblxuICAgICAgICAgICAgICAgIHZhciB2ZXJzaW9uID0gL15cXGQrXFwuXFxkK1xcLlxcZCskLy50ZXN0KGluZm8udmVyc2lvbikgPyAnLycgKyBpbmZvLnZlcnNpb24gOiAnJztcblxuICAgICAgICAgICAgICAgIHZhciBnYW1lRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IG9wdGlvbnMuc3RhdGljUm9vdCArIEdBTUVfSlNfVVJMLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSkucmVwbGFjZSgne1ZFUlNJT059JywgdmVyc2lvbik7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxvYWRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQgPSB3aW5kb3cubm9saW1pdCB8fCB7fTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdC5vcHRpb25zID0gb3B0aW9ucztcblxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsb2FkZXJFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gY29weUF0dHJpYnV0ZXMoZnJvbSwgdG8pIHtcbiAgICB2YXIgYXR0cmlidXRlcyA9IGZyb20uYXR0cmlidXRlcztcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgYXR0ciA9IGF0dHJpYnV0ZXNbaV07XG4gICAgICAgIHRvLnNldEF0dHJpYnV0ZShhdHRyLm5hbWUsIGF0dHIudmFsdWUpO1xuICAgIH1cbn1cblxudmFyIGdlbmVyYXRlTmFtZSA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZ2VuZXJhdGVkSW5kZXggPSAxO1xuICAgIHJldHVybiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiBuYW1lIHx8ICdOb2xpbWl0LScgKyBnZW5lcmF0ZWRJbmRleCsrO1xuICAgIH07XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXQ7XG4iXX0=
