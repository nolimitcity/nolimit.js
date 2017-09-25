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

var CDN = 'https://{ENV}';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}';
var GAMES_URL = '{CDN}/games';
var GAME_JS_URL = '/{GAME}{VERSION}/game.js';

var DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': '1.1.19'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.1.19',

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
        options.mute = options.mute || false;

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
        head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">');
    }
}

function processOptions(options) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBJTkZPX0pTT05fVVJMID0gJy97R0FNRX0vaW5mby5qc29uJztcblxudmFyIGNhY2hlID0ge307XG5cbnZhciBpbmZvID0ge1xuICAgIGxvYWQ6IGZ1bmN0aW9uKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciB1cmwgPSBvcHRpb25zLnN0YXRpY1Jvb3QgKyBJTkZPX0pTT05fVVJMLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSk7XG5cbiAgICAgICAgdmFyIGluZm8gPSBjYWNoZVt1cmxdO1xuICAgICAgICBpZihpbmZvKSB7XG4gICAgICAgICAgICBpbmZvLnZlcnNpb24gPSBvcHRpb25zLnZlcnNpb24gfHwgaW5mby52ZXJzaW9uO1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGluZm8pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICBmdW5jdGlvbiBvbkZhaWwoKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSByZXF1ZXN0LnN0YXR1c1RleHQgfHwgJ05vIGVycm9yIG1lc3NhZ2UgYXZhaWxhYmxlOyBwcm9iYWJseSBhIENPUlMgaXNzdWUuJztcbiAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBpZihyZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgaW5mbyA9IEpTT04ucGFyc2UocmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLnZlcnNpb24gPSBvcHRpb25zLnZlcnNpb24gfHwgaW5mby52ZXJzaW9uO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLnN0YXRpY1Jvb3QgPSBbb3B0aW9ucy5zdGF0aWNSb290LCBpbmZvLm5hbWUsIGluZm8udmVyc2lvbl0uam9pbignLycpO1xuICAgICAgICAgICAgICAgICAgICBpbmZvLmFzcGVjdFJhdGlvID0gaW5mby5zaXplLndpZHRoIC8gaW5mby5zaXplLmhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgY2FjaGVbdXJsXSA9IGluZm87XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGluZm8pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogZS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb25GYWlsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gb25GYWlsO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW5mbztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0QXBpRmFjdG9yeVxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gZnVuY3Rpb24odGFyZ2V0LCBvbmxvYWQpIHtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkRXZlbnRzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZENhbGxzID0gW107XG4gICAgdmFyIHBvcnQ7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KSB7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZENhbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UodW5oYW5kbGVkQ2FsbHMuc2hpZnQoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRNZXNzYWdlTGlzdGVuZXIoZ2FtZVdpbmRvdykge1xuICAgICAgICBnYW1lV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZihlLnBvcnRzICYmIGUucG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBlLnBvcnRzWzBdO1xuICAgICAgICAgICAgICAgIHBvcnQub25tZXNzYWdlID0gb25NZXNzYWdlO1xuICAgICAgICAgICAgICAgIHJlZ2lzdGVyRXZlbnRzKE9iamVjdC5rZXlzKGxpc3RlbmVycykpO1xuICAgICAgICAgICAgICAgIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZ2FtZVdpbmRvdy50cmlnZ2VyID0gdHJpZ2dlcjtcbiAgICAgICAgZ2FtZVdpbmRvdy5vbiA9IG9uO1xuICAgICAgICBvbmxvYWQoKTtcbiAgICB9XG5cbiAgICBpZih0YXJnZXQubm9kZU5hbWUgPT09ICdJRlJBTUUnKSB7XG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0LmNvbnRlbnRXaW5kb3cpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UoZSkge1xuICAgICAgICB0cmlnZ2VyKGUuZGF0YS5tZXRob2QsIGUuZGF0YS5wYXJhbXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlKG1ldGhvZCwgZGF0YSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICAgICAgfTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgICBtZXNzYWdlLnBhcmFtcyA9IGRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwb3J0KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoKGlnbm9yZWQpIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRDYWxscy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXJFdmVudHMoZXZlbnRzKSB7XG4gICAgICAgIHNlbmRNZXNzYWdlKCdyZWdpc3RlcicsIGV2ZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgZGF0YSkge1xuICAgICAgICBpZihsaXN0ZW5lcnNbZXZlbnRdKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLmZvckVhY2goZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdID0gdW5oYW5kbGVkRXZlbnRzW25hbWVdIHx8IFtdO1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdLnB1c2goZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XSA9IGxpc3RlbmVyc1tldmVudF0gfHwgW107XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0ucHVzaChjYWxsYmFjayk7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZEV2ZW50c1tldmVudF0gJiYgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKGV2ZW50LCB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLnBvcCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZ2lzdGVyRXZlbnRzKFtldmVudF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3Rpb24gdG8gdGhlIGdhbWUgdXNpbmcgTWVzc2FnZUNoYW5uZWxcbiAgICAgKiBAZXhwb3J0cyBub2xpbWl0QXBpXG4gICAgICovXG4gICAgdmFyIG5vbGltaXRBcGkgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgZm9yIGV2ZW50IGZyb20gdGhlIHN0YXJ0ZWQgZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gb25cbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9ICAgZXZlbnQgICAgbmFtZSBvZiB0aGUgZXZlbnRcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgY2FsbGJhY2sgZm9yIHRoZSBldmVudCwgc2VlIHNwZWNpZmljIGV2ZW50IGRvY3VtZW50YXRpb24gZm9yIGFueSBwYXJhbWV0ZXJzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIGFwaS5vbignZGVwb3NpdCcsIGZ1bmN0aW9uIG9wZW5EZXBvc2l0ICgpIHtcbiAgICAgICAgICogICAgIHNob3dEZXBvc2l0KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICogICAgICAgICAvLyBhc2sgdGhlIGdhbWUgdG8gcmVmcmVzaCBiYWxhbmNlIGZyb20gc2VydmVyXG4gICAgICAgICAqICAgICAgICAgYXBpLmNhbGwoJ3JlZnJlc2gnKTtcbiAgICAgICAgICogICAgIH0pO1xuICAgICAgICAgKiB9KTtcbiAgICAgICAgICovXG4gICAgICAgIG9uOiBvbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbCBtZXRob2QgaW4gdGhlIG9wZW4gZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kIG5hbWUgb2YgdGhlIG1ldGhvZCB0byBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV0gb3B0aW9uYWwgZGF0YSBmb3IgdGhlIG1ldGhvZCBjYWxsZWQsIGlmIGFueVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyByZWxvYWQgdGhlIGdhbWVcbiAgICAgICAgICogYXBpLmNhbGwoJ3JlbG9hZCcpO1xuICAgICAgICAgKi9cbiAgICAgICAgY2FsbDogc2VuZE1lc3NhZ2VcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5vbGltaXRBcGk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXRBcGlGYWN0b3J5O1xuIiwibW9kdWxlLmV4cG9ydHMgPSAnaHRtbCwgYm9keSB7XFxuICAgIG92ZXJmbG93OiBoaWRkZW47XFxuICAgIG1hcmdpbjogMDtcXG4gICAgd2lkdGg6IDEwMCU7XFxuICAgIGhlaWdodDogMTAwJTtcXG59XFxuXFxuYm9keSB7XFxuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcXG59XFxuJzsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBub2xpbWl0QXBpRmFjdG9yeSA9IHJlcXVpcmUoJy4vbm9saW1pdC1hcGknKTtcbnZhciBpbmZvID0gcmVxdWlyZSgnLi9pbmZvJyk7XG5cbnZhciBDRE4gPSAnaHR0cHM6Ly97RU5WfSc7XG52YXIgTE9BREVSX1VSTCA9ICd7Q0ROfS9sb2FkZXIvbG9hZGVyLXtERVZJQ0V9Lmh0bWw/b3BlcmF0b3I9e09QRVJBVE9SfSZnYW1lPXtHQU1FfSc7XG52YXIgR0FNRVNfVVJMID0gJ3tDRE59L2dhbWVzJztcbnZhciBHQU1FX0pTX1VSTCA9ICcve0dBTUV9e1ZFUlNJT059L2dhbWUuanMnO1xuXG52YXIgREVGQVVMVF9PUFRJT05TID0ge1xuICAgIGRldmljZTogJ2Rlc2t0b3AnLFxuICAgIGVudmlyb25tZW50OiAncGFydG5lcicsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgJ25vbGltaXQuanMnOiAnMS4xLjE5J1xufTtcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0XG4gKi9cbnZhciBub2xpbWl0ID0ge1xuXG4gICAgLyoqXG4gICAgICogQHByb3BlcnR5IHtTdHJpbmd9IHZlcnNpb24gY3VycmVudCB2ZXJzaW9uIG9mIG5vbGltaXQuanNcbiAgICAgKi9cbiAgICB2ZXJzaW9uOiAnMS4xLjE5JyxcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgbG9hZGVyIHdpdGggZGVmYXVsdCBwYXJhbWV0ZXJzLiBDYW4gYmUgc2tpcHBlZCBpZiB0aGUgcGFyYW1ldGVycyBhcmUgaW5jbHVkZWQgaW4gdGhlIGNhbGwgdG8gbG9hZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBvcHRpb25zLm9wZXJhdG9yIHRoZSBvcGVyYXRvciBjb2RlIGZvciB0aGUgb3BlcmF0b3JcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmxhbmd1YWdlPVwiZW5cIl0gdGhlIGxhbmd1YWdlIHRvIHVzZSBmb3IgdGhlIGdhbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmRldmljZT1kZXNrdG9wXSB0eXBlIG9mIGRldmljZTogJ2Rlc2t0b3AnIG9yICdtb2JpbGUnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuY3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2UsIGlmIG5vdCBwcm92aWRlZCBieSBzZXJ2ZXJcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbm9saW1pdC5pbml0KHtcbiAgICAgKiAgICBvcGVyYXRvcjogJ1NNT09USE9QRVJBVE9SJyxcbiAgICAgKiAgICBsYW5ndWFnZTogJ3N2JyxcbiAgICAgKiAgICBkZXZpY2U6ICdtb2JpbGUnLFxuICAgICAqICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICogICAgY3VycmVuY3k6ICdTRUsnXG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSwgcmVwbGFjaW5nIHRhcmdldCB3aXRoIHRoZSBnYW1lLlxuICAgICAqXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBIVE1MIGVsZW1lbnQsIGl0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBpZnJhbWUsIGtlZXBpbmcgYWxsIHRoZSBhdHRyaWJ1dGVzIG9mIHRoZSBvcmlnaW5hbCBlbGVtZW50LCBzbyB0aG9zZSBjYW4gYmUgdXNlZCB0byBzZXQgaWQsIGNsYXNzZXMsIHN0eWxlcyBhbmQgbW9yZS5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyBhIFdpbmRvdyBlbGVtZW50LCB0aGUgZ2FtZSB3aWxsIGJlIGxvYWRlZCBkaXJlY3RseSBpbiB0aGF0LlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBkZWZhdWx0IHRvIHRoZSBjdXJyZW50IHdpbmRvdy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMuaGlkZUN1cnJlbmN5XSBoaWRlIGN1cnJlbmN5IHN5bWJvbHMvY29kZXMgaW4gdGhlIGdhbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtub2xpbWl0QXBpfSAgICAgICAgVGhlIEFQSSBjb25uZWN0aW9uIHRvIHRoZSBvcGVuZWQgZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ1NwYWNlQXJjYWRlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciB0YXJnZXQgPSBvcHRpb25zLnRhcmdldCB8fCB3aW5kb3c7XG4gICAgICAgIG9wdGlvbnMubXV0ZSA9IG9wdGlvbnMubXV0ZSB8fCBmYWxzZTtcblxuICAgICAgICB2YXIgZ2FtZU9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG5cbiAgICAgICAgaWYodGFyZ2V0LldpbmRvdyAmJiB0YXJnZXQgaW5zdGFuY2VvZiB0YXJnZXQuV2luZG93KSB7XG4gICAgICAgICAgICB0YXJnZXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIHRhcmdldC5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgJ3Bvc2l0aW9uOiBmaXhlZDsgdG9wOiAwOyBsZWZ0OiAwOyB3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDAlOyBvdmVyZmxvdzogaGlkZGVuOycpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBpZnJhbWUgPSBtYWtlSWZyYW1lKHRhcmdldCk7XG5cbiAgICAgICAgICAgIHZhciBpZnJhbWVDb25uZWN0aW9uID0gbm9saW1pdEFwaUZhY3RvcnkoaWZyYW1lLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBodG1sKGlmcmFtZS5jb250ZW50V2luZG93LCBnYW1lT3B0aW9ucyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGlmcmFtZSwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHJldHVybiBpZnJhbWVDb25uZWN0aW9uO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgJ0ludmFsaWQgb3B0aW9uIHRhcmdldDogJyArIHRhcmdldDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGluZm9ybWF0aW9uIGFib3V0IHRoZSBnYW1lLCBzdWNoIGFzOiBjdXJyZW50IHZlcnNpb24sIHByZWZlcnJlZCB3aWR0aC9oZWlnaHQgZXRjLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgJ3Byb2R1Y3Rpb24nXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gICAgY2FsbGJhY2sgIGNhbGxlZCB3aXRoIHRoZSBpbmZvIG9iamVjdCwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLCB0aGUgJ2Vycm9yJyBmaWVsZCB3aWxsIGJlIHNldFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBub2xpbWl0LmluZm8oe2dhbWU6ICdTcGFjZUFyY2FkZSd9LCBmdW5jdGlvbihpbmZvKSB7XG4gICAgICogICAgIHZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUud2lkdGggPSBpbmZvLnNpemUud2lkdGggKyAncHgnO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaW5mby5zaXplLmhlaWdodCArICdweCc7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGluZm8ubmFtZSwgaW5mby52ZXJzaW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbmZvOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBvcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICBpbmZvLmxvYWQob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG1ha2VJZnJhbWUoZWxlbWVudCkge1xuICAgIHZhciBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBjb3B5QXR0cmlidXRlcyhlbGVtZW50LCBpZnJhbWUpO1xuXG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2FsbG93ZnVsbHNjcmVlbicsICcnKTtcblxuICAgIHZhciBuYW1lID0gZ2VuZXJhdGVOYW1lKGlmcmFtZS5nZXRBdHRyaWJ1dGUoJ25hbWUnKSB8fCBpZnJhbWUuaWQpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ25hbWUnLCBuYW1lKTtcblxuICAgIHJldHVybiBpZnJhbWU7XG59XG5cbmZ1bmN0aW9uIG1lcmdlT3B0aW9ucyhnbG9iYWxPcHRpb25zLCBnYW1lT3B0aW9ucykge1xuICAgIHZhciBvcHRpb25zID0ge30sIG5hbWU7XG4gICAgZm9yKG5hbWUgaW4gREVGQVVMVF9PUFRJT05TKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBERUZBVUxUX09QVElPTlNbbmFtZV07XG4gICAgfVxuICAgIGZvcihuYW1lIGluIGdsb2JhbE9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdsb2JhbE9wdGlvbnNbbmFtZV07XG4gICAgfVxuICAgIGZvcihuYW1lIGluIGdhbWVPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBnYW1lT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGluc2VydENzcyhkb2N1bWVudCkge1xuICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudGV4dENvbnRlbnQgPSByZXF1aXJlKCcuL25vbGltaXQuY3NzJyk7XG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG5cbmZ1bmN0aW9uIHNldHVwVmlld3BvcnQoaGVhZCkge1xuICAgIHZhciB2aWV3cG9ydCA9IGhlYWQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwidmlld3BvcnRcIl0nKTtcbiAgICBpZighdmlld3BvcnQpIHtcbiAgICAgICAgaGVhZC5pbnNlcnRBZGphY2VudEhUTUwoJ2JlZm9yZWVuZCcsICc8bWV0YSBuYW1lPVwidmlld3BvcnRcIiBjb250ZW50PVwid2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMCwgbWF4aW11bS1zY2FsZT0xLjAsIHVzZXItc2NhbGFibGU9MFwiPicpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZGV2aWNlID0gb3B0aW9ucy5kZXZpY2UudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgZW52aXJvbm1lbnQgPSBvcHRpb25zLmVudmlyb25tZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgaWYoZW52aXJvbm1lbnQuaW5kZXhPZignLicpID09PSAtMSkge1xuICAgICAgICBlbnZpcm9ubWVudCArPSAnLm5vbGltaXRjZG4uY29tJztcbiAgICB9XG4gICAgb3B0aW9ucy5jZG4gPSBDRE4ucmVwbGFjZSgne0VOVn0nLCBlbnZpcm9ubWVudCk7XG4gICAgb3B0aW9ucy5zdGF0aWNSb290ID0gb3B0aW9ucy5zdGF0aWNSb290IHx8IEdBTUVTX1VSTC5yZXBsYWNlKCd7Q0ROfScsIG9wdGlvbnMuY2RuKTtcbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaHRtbCh3aW5kb3csIG9wdGlvbnMpIHtcbiAgICB2YXIgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQ7XG5cbiAgICB3aW5kb3cuZm9jdXMoKTtcblxuICAgIGluc2VydENzcyhkb2N1bWVudCk7XG4gICAgc2V0dXBWaWV3cG9ydChkb2N1bWVudC5oZWFkKTtcblxuICAgIHZhciBsb2FkZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICdibGFjayc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS53aWR0aCA9ICcxMDB2dyc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMTAwdmgnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzIxNDc0ODM2NDcnO1xuICAgIGxvYWRlckVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbG9hZGVyJyk7XG5cbiAgICBsb2FkZXJFbGVtZW50LnNyYyA9IExPQURFUl9VUkxcbiAgICAgICAgLnJlcGxhY2UoJ3tDRE59Jywgb3B0aW9ucy5jZG4pXG4gICAgICAgIC5yZXBsYWNlKCd7REVWSUNFfScsIG9wdGlvbnMuZGV2aWNlKVxuICAgICAgICAucmVwbGFjZSgne09QRVJBVE9SfScsIG9wdGlvbnMub3BlcmF0b3IpXG4gICAgICAgIC5yZXBsYWNlKCd7R0FNRX0nLCBvcHRpb25zLmdhbWUpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5pbm5lckhUTUwgPSAnJztcblxuICAgIGxvYWRlckVsZW1lbnQub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5vbignZXJyb3InLCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgaWYobG9hZGVyRWxlbWVudCAmJiBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXJFbGVtZW50LmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkoeydlcnJvcic6IGVycm9yfSksICcqJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5vbGltaXQuaW5mbyhvcHRpb25zLCBmdW5jdGlvbihpbmZvKSB7XG4gICAgICAgICAgICBpZihpbmZvLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2Vycm9yJywgaW5mby5lcnJvcik7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KGluZm8pLCAnKicpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cudHJpZ2dlcignaW5mbycsIGluZm8pO1xuXG4gICAgICAgICAgICAgICAgdmFyIHZlcnNpb24gPSAvXlxcZCtcXC5cXGQrXFwuXFxkKyQvLnRlc3QoaW5mby52ZXJzaW9uKSA/ICcvJyArIGluZm8udmVyc2lvbiA6ICcnO1xuXG4gICAgICAgICAgICAgICAgdmFyIGdhbWVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICAgICAgZ2FtZUVsZW1lbnQuc3JjID0gb3B0aW9ucy5zdGF0aWNSb290ICsgR0FNRV9KU19VUkwucmVwbGFjZSgne0dBTUV9Jywgb3B0aW9ucy5nYW1lKS5yZXBsYWNlKCd7VkVSU0lPTn0nLCB2ZXJzaW9uKTtcblxuICAgICAgICAgICAgICAgIG9wdGlvbnMubG9hZFN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cubm9saW1pdCA9IHdpbmRvdy5ub2xpbWl0IHx8IHt9O1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChnYW1lRWxlbWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxvYWRlckVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBjb3B5QXR0cmlidXRlcyhmcm9tLCB0bykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZnJvbS5hdHRyaWJ1dGVzO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXTtcbiAgICAgICAgdG8uc2V0QXR0cmlidXRlKGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgfVxufVxuXG52YXIgZ2VuZXJhdGVOYW1lID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5hbWUgfHwgJ05vbGltaXQtJyArIGdlbmVyYXRlZEluZGV4Kys7XG4gICAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdDtcbiJdfQ==
