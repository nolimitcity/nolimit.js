(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nolimit = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const info = {
    load: (options, callback) => {
        const parts = [options.staticRoot, options.game.replace(/DX[0-9]+$/, '')];
        if (options.version) {
            parts.push(options.version);
        }
        parts.push('info.json');

        const url = parts.join('/');
        const request = new XMLHttpRequest();

        function onFail() {
            const error = request.statusText || 'No error message available; CORS or server missing?';
            callback({
                error: error
            });
        }

        request.open('GET', url, true);

        request.onload = () => {
            if (request.status >= 200 && request.status < 400) {
                try {
                    const info = JSON.parse(request.responseText);
                    info.staticRoot = [options.staticRoot, info.name, info.version].join('/');
                    info.aspectRatio = info.size.width / info.size.height;
                    info.infoJson = url;
                    callback(info);
                } catch (e) {
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
                handleUnhandledCalls(port);
            }
        });
        gameWindow.trigger = trigger;
        gameWindow.on = on;
        onload();
    }

    if(target.nodeName === 'IFRAME') {
        if (target.contentWindow && target.contentWindow.document && target.contentWindow.document.readyState === 'complete') {
            addMessageListener(target.contentWindow);
        } else {
            target.addEventListener('load', function() {
                addMessageListener(target.contentWindow);
            });
        }
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
        call: sendMessage,

        /**
         * Triggers a named event
         *
         * @function trigger
         * @param {String} event  name of the event
         * @param {Object} [data] optional data for the event, if any
         */
        trigger: trigger
    };

    return nolimitApi;
};

module.exports = nolimitApiFactory;

},{}],3:[function(require,module,exports){
module.exports = 'html, body {\n    overflow: hidden;\n    margin: 0;\n    width: 100%;\n    height: 100%;\n}\n\nbody {\n    position: relative;\n}\n';
},{}],4:[function(require,module,exports){
var nolimitApiFactory = require('./nolimit-api');
var info = require('./info');

var CDN = 'https://{ENV}';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html?operator={OPERATOR}&game={GAME}&language={LANGUAGE}';
var REPLACE_URL = '{CDN}/loader/game-loader.html?{QUERY}';
var GAMES_URL = '{CDN}/games';

var DEFAULT_OPTIONS = {
    device: 'desktop',
    environment: 'partner',
    language: 'en',
    'nolimit.js': '1.2.81'
};

/**
 * @exports nolimit
 */
var nolimit = {

    /**
     * @property {String} version current version of nolimit.js
     */
    version: '1.2.81',

    options: {},

    /**
     * Initialize loader with default parameters. Can be skipped if the parameters are included in the call to load instead.
     *
     * @param {Object}  options
     * @param {String}  options.operator the operator code for the operator
     * @param {String}  [options.language="en"] the language to use for the game
     * @param {String}  [options.device=desktop] type of device: 'desktop' or 'mobile'. Recommended to always set this to make sure the correct device is used.
     * @param {String}  [options.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
     * @param {Boolean} [options.fullscreen=true] set to false to disable automatic fullscreen on mobile (Android only)
     * @param {Boolean} [options.clock=true] set to false to disable in-game clock
     * @param {String}  [options.quality] force asset quality. Possible values are 'high', 'medium', 'low'. Defaults to smart loading in each game.
     * @param {Object}  [options.jurisdiction] force a specific jurisdiction to enforce specific license requirements and set specific options and overrides. See README for jurisdiction-specific details.
     * @param {Object}  [options.jurisdiction.name] the name of the jurisdiction, for example "MT", "DK", "LV", "RO", "UKGC", "PT", "ES", "IT" or "SE".
     * @param {Object}  [options.realityCheck] set options for reality check. See README for more details.
     * @param {Object}  [options.realityCheck.enabled=true] set to false to disable reality-check dialog.
     * @param {Number}  [options.realityCheck.interval=60] Interval in minutes between showing reality-check dialog.
     * @param {Number}  [options.realityCheck.sessionStart=Date.now()] override session start, default is Date.now().
     * @param {Number}  [options.realityCheck.nextTime] next time to show dialog, defaults to Date.now() + interval.
     * @param {Number}  [options.realityCheck.bets=0] set initial bets if player already has bets in the session.
     * @param {Number}  [options.realityCheck.winnings=0] set initial winnings if player already has winnings in the session.
     * @param {Number}  [options.realityCheck.message] Message to display when dialog is opened. A generic default is provided.
     * @param {String}  [options.playForFunCurrency=EUR] currency to use when in playing for fun mode. Uses EUR if not specified.
     * @param {Boolean} [options.autoplay=true] set to false to disable and remove the auto play button.
     * @param {Boolean} [options.hideExitButton=false] set to true to control closing of mobile games from outside of game area.
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
     * @param {String}              options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
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
     *    game: 'DragonTribe',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    load: function(options) {
        options = processOptions(mergeOptions(this.options, options));

        var target = options.target || window;

        if(target.Window && target instanceof target.Window) {
            target = document.createElement('div');
            target.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden;');
            document.body.appendChild(target);
        }

        if(target.ownerDocument && target instanceof target.ownerDocument.defaultView.HTMLElement) {
            var iframe = makeIframe(target);
            target.parentNode.replaceChild(iframe, target);

            var nolimitApi = nolimitApiFactory(iframe, function() {
                html(iframe.contentWindow, options);
            });

            return nolimitApi;
        } else {
            throw 'Invalid option target: ' + target;
        }
    },

    /**
     * Load game in a new, separate page. This offers the best isolation, but no communication with the game is possible.
     *
     * @param {Object}              options
     * @param {String}              options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     * @param {Boolean}             [options.hideCurrency] hide currency symbols/codes in the game
     * @param {String}              [options.lobbyUrl="history:back()"] URL to redirect back to lobby on mobile, if not using a target
     * @param {String}              [options.depositUrl] URL to deposit page, if not using a target element
     * @param {String}              [options.supportUrl] URL to support page, if not using a target element
     * @param {Boolean}             [options.depositEvent] instead of using URL, emit "deposit" event (see event documentation)
     * @param {Boolean}             [options.lobbyEvent] instead of using URL, emit "lobby" event (see event documentation) (mobile only)
     * @param {String}              [options.accountHistoryUrl] URL to support page, if not using a target element
     *
     * @example
     * var api = nolimit.replace({
     *    game: 'DragonTribe',
     *    target: document.getElementById('game'),
     *    token: realMoneyToken,
     *    mute: true
     * });
     */
    replace: function(options) {
        location.href = this.url(options);

        function noop() {
        }

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
        var gameUrl = REPLACE_URL
            .replace('{CDN}', gameOptions.cdn)
            .replace('{QUERY}', makeQueryString(gameOptions));
        return gameUrl;
    },

    /**
     * Load information about the game, such as: current version, preferred width/height etc.
     *
     * @param {Object}      options
     * @param {String}      [options.environment=partner] which environment to use; usually 'partner' or the name of a production environment. This overrides the environment part of the hostname.
     * @param {String}      options.game case sensitive game code, for example 'DragonTribe' or 'Wixx'
     * @param {String}      [options.version] force specific version of game to load.
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
    info: function(options, callback) {
        options = processOptions(mergeOptions(this.options, options));
        info.load(options, callback);
    }
};

function makeQueryString(options) {
    var query = [];
    for(var key in options) {
        var value = options[key];
        if(typeof value === 'undefined') {
            continue;
        }
        if(value instanceof HTMLElement) {
            continue;
        }
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
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups');

    var name = generateName(iframe.getAttribute('name') || iframe.id);
    iframe.setAttribute('name', name);

    return iframe;
}

function mergeOptions(globalOptions, gameOptions) {
    delete globalOptions.version;
    delete globalOptions.replay;
    delete globalOptions.token;
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
    document.head.appendChild(style);
    style.appendChild(document.createTextNode(require('./nolimit.css')));
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
    options.cdn = options.cdn || CDN.replace('{ENV}', environment);
    options.staticRoot = options.staticRoot || GAMES_URL.replace('{CDN}', options.cdn);
    options.playForFunCurrency = options.playForFunCurrency || options.currency;
    if (options.language === 'pe' || options.language === 'cl') {
        options.language = 'es';
    }
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

        nolimit.info(options, function(info) {
            if(info.error) {
                window.trigger('error', info.error);
                loaderElement.contentWindow.postMessage(JSON.stringify(info), '*');
            } else {
                window.trigger('info', info);

                var gameElement = document.createElement('script');
                gameElement.src = info.staticRoot + '/game.js';

                options.loadStart = Date.now();
                window.nolimit = nolimit;
                window.nolimit.options = options;
                window.nolimit.options.version = info.version;

                document.body.appendChild(gameElement);
            }
        });

        loaderElement.onload = function() {
        };
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUlBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJjb25zdCBpbmZvID0ge1xuICAgIGxvYWQ6IChvcHRpb25zLCBjYWxsYmFjaykgPT4ge1xuICAgICAgICBjb25zdCBwYXJ0cyA9IFtvcHRpb25zLnN0YXRpY1Jvb3QsIG9wdGlvbnMuZ2FtZS5yZXBsYWNlKC9EWFswLTldKyQvLCAnJyldO1xuICAgICAgICBpZiAob3B0aW9ucy52ZXJzaW9uKSB7XG4gICAgICAgICAgICBwYXJ0cy5wdXNoKG9wdGlvbnMudmVyc2lvbik7XG4gICAgICAgIH1cbiAgICAgICAgcGFydHMucHVzaCgnaW5mby5qc29uJyk7XG5cbiAgICAgICAgY29uc3QgdXJsID0gcGFydHMuam9pbignLycpO1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgZnVuY3Rpb24gb25GYWlsKCkge1xuICAgICAgICAgICAgY29uc3QgZXJyb3IgPSByZXF1ZXN0LnN0YXR1c1RleHQgfHwgJ05vIGVycm9yIG1lc3NhZ2UgYXZhaWxhYmxlOyBDT1JTIG9yIHNlcnZlciBtaXNzaW5nPyc7XG4gICAgICAgICAgICBjYWxsYmFjayh7XG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgdXJsLCB0cnVlKTtcblxuICAgICAgICByZXF1ZXN0Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA+PSAyMDAgJiYgcmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gSlNPTi5wYXJzZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uc3RhdGljUm9vdCA9IFtvcHRpb25zLnN0YXRpY1Jvb3QsIGluZm8ubmFtZSwgaW5mby52ZXJzaW9uXS5qb2luKCcvJyk7XG4gICAgICAgICAgICAgICAgICAgIGluZm8uYXNwZWN0UmF0aW8gPSBpbmZvLnNpemUud2lkdGggLyBpbmZvLnNpemUuaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBpbmZvLmluZm9Kc29uID0gdXJsO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvbkZhaWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBvbkZhaWw7XG5cbiAgICAgICAgcmVxdWVzdC5zZW5kKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBpbmZvO1xuIiwiLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0QXBpRmFjdG9yeVxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gZnVuY3Rpb24odGFyZ2V0LCBvbmxvYWQpIHtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSB7fTtcbiAgICB2YXIgdW5oYW5kbGVkRXZlbnRzID0ge307XG4gICAgdmFyIHVuaGFuZGxlZENhbGxzID0gW107XG4gICAgdmFyIHBvcnQ7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVVbmhhbmRsZWRDYWxscyhwb3J0KSB7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZENhbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UodW5oYW5kbGVkQ2FsbHMuc2hpZnQoKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRNZXNzYWdlTGlzdGVuZXIoZ2FtZVdpbmRvdykge1xuICAgICAgICBnYW1lV2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICBpZihlLnBvcnRzICYmIGUucG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBlLnBvcnRzWzBdO1xuICAgICAgICAgICAgICAgIHBvcnQub25tZXNzYWdlID0gb25NZXNzYWdlO1xuICAgICAgICAgICAgICAgIGhhbmRsZVVuaGFuZGxlZENhbGxzKHBvcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZ2FtZVdpbmRvdy50cmlnZ2VyID0gdHJpZ2dlcjtcbiAgICAgICAgZ2FtZVdpbmRvdy5vbiA9IG9uO1xuICAgICAgICBvbmxvYWQoKTtcbiAgICB9XG5cbiAgICBpZih0YXJnZXQubm9kZU5hbWUgPT09ICdJRlJBTUUnKSB7XG4gICAgICAgIGlmICh0YXJnZXQuY29udGVudFdpbmRvdyAmJiB0YXJnZXQuY29udGVudFdpbmRvdy5kb2N1bWVudCAmJiB0YXJnZXQuY29udGVudFdpbmRvdy5kb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0LmNvbnRlbnRXaW5kb3cpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0LmNvbnRlbnRXaW5kb3cpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhZGRNZXNzYWdlTGlzdGVuZXIodGFyZ2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbk1lc3NhZ2UoZSkge1xuICAgICAgICB0cmlnZ2VyKGUuZGF0YS5tZXRob2QsIGUuZGF0YS5wYXJhbXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlKG1ldGhvZCwgZGF0YSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICAgICAgfTtcblxuICAgICAgICBpZihkYXRhKSB7XG4gICAgICAgICAgICBtZXNzYWdlLnBhcmFtcyA9IGRhdGE7XG4gICAgICAgIH1cblxuICAgICAgICBpZihwb3J0KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBvcnQucG9zdE1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoKGlnbm9yZWQpIHtcbiAgICAgICAgICAgICAgICBwb3J0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIHVuaGFuZGxlZENhbGxzLnB1c2gobWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmhhbmRsZWRDYWxscy5wdXNoKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXJFdmVudHMoZXZlbnRzKSB7XG4gICAgICAgIHNlbmRNZXNzYWdlKCdyZWdpc3RlcicsIGV2ZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJpZ2dlcihldmVudCwgZGF0YSkge1xuICAgICAgICBpZihsaXN0ZW5lcnNbZXZlbnRdKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLmZvckVhY2goZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdID0gdW5oYW5kbGVkRXZlbnRzW25hbWVdIHx8IFtdO1xuICAgICAgICAgICAgdW5oYW5kbGVkRXZlbnRzW25hbWVdLnB1c2goZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgbGlzdGVuZXJzW2V2ZW50XSA9IGxpc3RlbmVyc1tldmVudF0gfHwgW107XG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0ucHVzaChjYWxsYmFjayk7XG4gICAgICAgIHdoaWxlKHVuaGFuZGxlZEV2ZW50c1tldmVudF0gJiYgdW5oYW5kbGVkRXZlbnRzW2V2ZW50XS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0cmlnZ2VyKGV2ZW50LCB1bmhhbmRsZWRFdmVudHNbZXZlbnRdLnBvcCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlZ2lzdGVyRXZlbnRzKFtldmVudF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3Rpb24gdG8gdGhlIGdhbWUgdXNpbmcgTWVzc2FnZUNoYW5uZWxcbiAgICAgKiBAZXhwb3J0cyBub2xpbWl0QXBpXG4gICAgICovXG4gICAgdmFyIG5vbGltaXRBcGkgPSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgZm9yIGV2ZW50IGZyb20gdGhlIHN0YXJ0ZWQgZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gb25cbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9ICAgZXZlbnQgICAgbmFtZSBvZiB0aGUgZXZlbnRcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgY2FsbGJhY2sgZm9yIHRoZSBldmVudCwgc2VlIHNwZWNpZmljIGV2ZW50IGRvY3VtZW50YXRpb24gZm9yIGFueSBwYXJhbWV0ZXJzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIGFwaS5vbignZGVwb3NpdCcsIGZ1bmN0aW9uIG9wZW5EZXBvc2l0ICgpIHtcbiAgICAgICAgICogICAgIHNob3dEZXBvc2l0KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICogICAgICAgICAvLyBhc2sgdGhlIGdhbWUgdG8gcmVmcmVzaCBiYWxhbmNlIGZyb20gc2VydmVyXG4gICAgICAgICAqICAgICAgICAgYXBpLmNhbGwoJ3JlZnJlc2gnKTtcbiAgICAgICAgICogICAgIH0pO1xuICAgICAgICAgKiB9KTtcbiAgICAgICAgICovXG4gICAgICAgIG9uOiBvbixcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbCBtZXRob2QgaW4gdGhlIG9wZW4gZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZnVuY3Rpb24gY2FsbFxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbWV0aG9kIG5hbWUgb2YgdGhlIG1ldGhvZCB0byBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV0gb3B0aW9uYWwgZGF0YSBmb3IgdGhlIG1ldGhvZCBjYWxsZWQsIGlmIGFueVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyByZWxvYWQgdGhlIGdhbWVcbiAgICAgICAgICogYXBpLmNhbGwoJ3JlbG9hZCcpO1xuICAgICAgICAgKi9cbiAgICAgICAgY2FsbDogc2VuZE1lc3NhZ2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRyaWdnZXJzIGEgbmFtZWQgZXZlbnRcbiAgICAgICAgICpcbiAgICAgICAgICogQGZ1bmN0aW9uIHRyaWdnZXJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50ICBuYW1lIG9mIHRoZSBldmVudFxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2RhdGFdIG9wdGlvbmFsIGRhdGEgZm9yIHRoZSBldmVudCwgaWYgYW55XG4gICAgICAgICAqL1xuICAgICAgICB0cmlnZ2VyOiB0cmlnZ2VyXG4gICAgfTtcblxuICAgIHJldHVybiBub2xpbWl0QXBpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBub2xpbWl0QXBpRmFjdG9yeTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJ2h0bWwsIGJvZHkge1xcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xcbiAgICBtYXJnaW46IDA7XFxuICAgIHdpZHRoOiAxMDAlO1xcbiAgICBoZWlnaHQ6IDEwMCU7XFxufVxcblxcbmJvZHkge1xcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XFxufVxcbic7IiwidmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gcmVxdWlyZSgnLi9ub2xpbWl0LWFwaScpO1xudmFyIGluZm8gPSByZXF1aXJlKCcuL2luZm8nKTtcblxudmFyIENETiA9ICdodHRwczovL3tFTlZ9JztcbnZhciBMT0FERVJfVVJMID0gJ3tDRE59L2xvYWRlci9sb2FkZXIte0RFVklDRX0uaHRtbD9vcGVyYXRvcj17T1BFUkFUT1J9JmdhbWU9e0dBTUV9Jmxhbmd1YWdlPXtMQU5HVUFHRX0nO1xudmFyIFJFUExBQ0VfVVJMID0gJ3tDRE59L2xvYWRlci9nYW1lLWxvYWRlci5odG1sP3tRVUVSWX0nO1xudmFyIEdBTUVTX1VSTCA9ICd7Q0ROfS9nYW1lcyc7XG5cbnZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgZGV2aWNlOiAnZGVza3RvcCcsXG4gICAgZW52aXJvbm1lbnQ6ICdwYXJ0bmVyJyxcbiAgICBsYW5ndWFnZTogJ2VuJyxcbiAgICAnbm9saW1pdC5qcyc6ICcxLjIuODEnXG59O1xuXG4vKipcbiAqIEBleHBvcnRzIG5vbGltaXRcbiAqL1xudmFyIG5vbGltaXQgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge1N0cmluZ30gdmVyc2lvbiBjdXJyZW50IHZlcnNpb24gb2Ygbm9saW1pdC5qc1xuICAgICAqL1xuICAgIHZlcnNpb246ICcxLjIuODEnLFxuXG4gICAgb3B0aW9uczoge30sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGxvYWRlciB3aXRoIGRlZmF1bHQgcGFyYW1ldGVycy4gQ2FuIGJlIHNraXBwZWQgaWYgdGhlIHBhcmFtZXRlcnMgYXJlIGluY2x1ZGVkIGluIHRoZSBjYWxsIHRvIGxvYWQgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgb3B0aW9ucy5vcGVyYXRvciB0aGUgb3BlcmF0b3IgY29kZSBmb3IgdGhlIG9wZXJhdG9yXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5sYW5ndWFnZT1cImVuXCJdIHRoZSBsYW5ndWFnZSB0byB1c2UgZm9yIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5kZXZpY2U9ZGVza3RvcF0gdHlwZSBvZiBkZXZpY2U6ICdkZXNrdG9wJyBvciAnbW9iaWxlJy4gUmVjb21tZW5kZWQgdG8gYWx3YXlzIHNldCB0aGlzIHRvIG1ha2Ugc3VyZSB0aGUgY29ycmVjdCBkZXZpY2UgaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmVudmlyb25tZW50PXBhcnRuZXJdIHdoaWNoIGVudmlyb25tZW50IHRvIHVzZTsgdXN1YWxseSAncGFydG5lcicgb3IgdGhlIG5hbWUgb2YgYSBwcm9kdWN0aW9uIGVudmlyb25tZW50LiBUaGlzIG92ZXJyaWRlcyB0aGUgZW52aXJvbm1lbnQgcGFydCBvZiB0aGUgaG9zdG5hbWUuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5mdWxsc2NyZWVuPXRydWVdIHNldCB0byBmYWxzZSB0byBkaXNhYmxlIGF1dG9tYXRpYyBmdWxsc2NyZWVuIG9uIG1vYmlsZSAoQW5kcm9pZCBvbmx5KVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gW29wdGlvbnMuY2xvY2s9dHJ1ZV0gc2V0IHRvIGZhbHNlIHRvIGRpc2FibGUgaW4tZ2FtZSBjbG9ja1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMucXVhbGl0eV0gZm9yY2UgYXNzZXQgcXVhbGl0eS4gUG9zc2libGUgdmFsdWVzIGFyZSAnaGlnaCcsICdtZWRpdW0nLCAnbG93Jy4gRGVmYXVsdHMgdG8gc21hcnQgbG9hZGluZyBpbiBlYWNoIGdhbWUuXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBbb3B0aW9ucy5qdXJpc2RpY3Rpb25dIGZvcmNlIGEgc3BlY2lmaWMganVyaXNkaWN0aW9uIHRvIGVuZm9yY2Ugc3BlY2lmaWMgbGljZW5zZSByZXF1aXJlbWVudHMgYW5kIHNldCBzcGVjaWZpYyBvcHRpb25zIGFuZCBvdmVycmlkZXMuIFNlZSBSRUFETUUgZm9yIGp1cmlzZGljdGlvbi1zcGVjaWZpYyBkZXRhaWxzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMuanVyaXNkaWN0aW9uLm5hbWVdIHRoZSBuYW1lIG9mIHRoZSBqdXJpc2RpY3Rpb24sIGZvciBleGFtcGxlIFwiTVRcIiwgXCJES1wiLCBcIkxWXCIsIFwiUk9cIiwgXCJVS0dDXCIsIFwiUFRcIiwgXCJFU1wiLCBcIklUXCIgb3IgXCJTRVwiLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMucmVhbGl0eUNoZWNrXSBzZXQgb3B0aW9ucyBmb3IgcmVhbGl0eSBjaGVjay4gU2VlIFJFQURNRSBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLmVuYWJsZWQ9dHJ1ZV0gc2V0IHRvIGZhbHNlIHRvIGRpc2FibGUgcmVhbGl0eS1jaGVjayBkaWFsb2cuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2suaW50ZXJ2YWw9NjBdIEludGVydmFsIGluIG1pbnV0ZXMgYmV0d2VlbiBzaG93aW5nIHJlYWxpdHktY2hlY2sgZGlhbG9nLlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLnNlc3Npb25TdGFydD1EYXRlLm5vdygpXSBvdmVycmlkZSBzZXNzaW9uIHN0YXJ0LCBkZWZhdWx0IGlzIERhdGUubm93KCkuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2submV4dFRpbWVdIG5leHQgdGltZSB0byBzaG93IGRpYWxvZywgZGVmYXVsdHMgdG8gRGF0ZS5ub3coKSArIGludGVydmFsLlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSAgW29wdGlvbnMucmVhbGl0eUNoZWNrLmJldHM9MF0gc2V0IGluaXRpYWwgYmV0cyBpZiBwbGF5ZXIgYWxyZWFkeSBoYXMgYmV0cyBpbiB0aGUgc2Vzc2lvbi5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gIFtvcHRpb25zLnJlYWxpdHlDaGVjay53aW5uaW5ncz0wXSBzZXQgaW5pdGlhbCB3aW5uaW5ncyBpZiBwbGF5ZXIgYWxyZWFkeSBoYXMgd2lubmluZ3MgaW4gdGhlIHNlc3Npb24uXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9ICBbb3B0aW9ucy5yZWFsaXR5Q2hlY2subWVzc2FnZV0gTWVzc2FnZSB0byBkaXNwbGF5IHdoZW4gZGlhbG9nIGlzIG9wZW5lZC4gQSBnZW5lcmljIGRlZmF1bHQgaXMgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5wbGF5Rm9yRnVuQ3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2Ugd2hlbiBpbiBwbGF5aW5nIGZvciBmdW4gbW9kZS4gVXNlcyBFVVIgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLmF1dG9wbGF5PXRydWVdIHNldCB0byBmYWxzZSB0byBkaXNhYmxlIGFuZCByZW1vdmUgdGhlIGF1dG8gcGxheSBidXR0b24uXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5oaWRlRXhpdEJ1dHRvbj1mYWxzZV0gc2V0IHRvIHRydWUgdG8gY29udHJvbCBjbG9zaW5nIG9mIG1vYmlsZSBnYW1lcyBmcm9tIG91dHNpZGUgb2YgZ2FtZSBhcmVhLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBub2xpbWl0LmluaXQoe1xuICAgICAqICAgIG9wZXJhdG9yOiAnU01PT1RIT1BFUkFUT1InLFxuICAgICAqICAgIGxhbmd1YWdlOiAnc3YnLFxuICAgICAqICAgIGRldmljZTogJ21vYmlsZScsXG4gICAgICogICAgZW52aXJvbm1lbnQ6ICdwYXJ0bmVyJyxcbiAgICAgKiAgICBjdXJyZW5jeTogJ1NFSycsXG4gICAgICogICAganVyaXNkaWN0aW9uOiB7XG4gICAgICogICAgICAgIG5hbWU6ICdTRSdcbiAgICAgKiAgICB9LFxuICAgICAqICAgIHJlYWxpdHlDaGVjazoge1xuICAgICAqICAgICAgICBpbnRlcnZhbDogMzBcbiAgICAgKiAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGdhbWUsIHJlcGxhY2luZyB0YXJnZXQgd2l0aCB0aGUgZ2FtZS5cbiAgICAgKlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIGEgSFRNTCBlbGVtZW50LCBpdCB3aWxsIGJlIHJlcGxhY2VkIHdpdGggYW4gaWZyYW1lLCBrZWVwaW5nIGFsbCB0aGUgYXR0cmlidXRlcyBvZiB0aGUgb3JpZ2luYWwgZWxlbWVudCwgc28gdGhvc2UgY2FuIGJlIHVzZWQgdG8gc2V0IGlkLCBjbGFzc2VzLCBzdHlsZXMgYW5kIG1vcmUuXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBXaW5kb3cgZWxlbWVudCwgdGhlIGdhbWUgd2lsbCBiZSBsb2FkZWQgZGlyZWN0bHkgaW4gdGhhdC5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyB1bmRlZmluZWQsIGl0IHdpbGwgZGVmYXVsdCB0byB0aGUgY3VycmVudCB3aW5kb3cuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdEcmFnb25UcmliZScgb3IgJ1dpeHgnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMuaGlkZUN1cnJlbmN5XSBoaWRlIGN1cnJlbmN5IHN5bWJvbHMvY29kZXMgaW4gdGhlIGdhbWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtub2xpbWl0QXBpfSAgICAgICAgVGhlIEFQSSBjb25uZWN0aW9uIHRvIHRoZSBvcGVuZWQgZ2FtZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwaSA9IG5vbGltaXQubG9hZCh7XG4gICAgICogICAgZ2FtZTogJ0RyYWdvblRyaWJlJyxcbiAgICAgKiAgICB0YXJnZXQ6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJyksXG4gICAgICogICAgdG9rZW46IHJlYWxNb25leVRva2VuLFxuICAgICAqICAgIG11dGU6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyhtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKSk7XG5cbiAgICAgICAgdmFyIHRhcmdldCA9IG9wdGlvbnMudGFyZ2V0IHx8IHdpbmRvdztcblxuICAgICAgICBpZih0YXJnZXQuV2luZG93ICYmIHRhcmdldCBpbnN0YW5jZW9mIHRhcmdldC5XaW5kb3cpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgdGFyZ2V0LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCAncG9zaXRpb246IGZpeGVkOyB0b3A6IDA7IGxlZnQ6IDA7IHdpZHRoOiAxMDAlOyBoZWlnaHQ6IDEwMCU7IG92ZXJmbG93OiBoaWRkZW47Jyk7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZih0YXJnZXQub3duZXJEb2N1bWVudCAmJiB0YXJnZXQgaW5zdGFuY2VvZiB0YXJnZXQub3duZXJEb2N1bWVudC5kZWZhdWx0Vmlldy5IVE1MRWxlbWVudCkge1xuICAgICAgICAgICAgdmFyIGlmcmFtZSA9IG1ha2VJZnJhbWUodGFyZ2V0KTtcbiAgICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChpZnJhbWUsIHRhcmdldCk7XG5cbiAgICAgICAgICAgIHZhciBub2xpbWl0QXBpID0gbm9saW1pdEFwaUZhY3RvcnkoaWZyYW1lLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBodG1sKGlmcmFtZS5jb250ZW50V2luZG93LCBvcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbm9saW1pdEFwaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIG9wdGlvbiB0YXJnZXQ6ICcgKyB0YXJnZXQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBnYW1lIGluIGEgbmV3LCBzZXBhcmF0ZSBwYWdlLiBUaGlzIG9mZmVycyB0aGUgYmVzdCBpc29sYXRpb24sIGJ1dCBubyBjb21tdW5pY2F0aW9uIHdpdGggdGhlIGdhbWUgaXMgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdEcmFnb25UcmliZScgb3IgJ1dpeHgnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy50b2tlbl0gdGhlIHRva2VuIHRvIHVzZSBmb3IgcmVhbCBtb25leSBwbGF5XG4gICAgICogQHBhcmFtIHtCb29sZWFufSAgICAgICAgICAgICBbb3B0aW9ucy5tdXRlPWZhbHNlXSBzdGFydCB0aGUgZ2FtZSB3aXRob3V0IHNvdW5kXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy52ZXJzaW9uXSBmb3JjZSBzcGVjaWZpYyBnYW1lIHZlcnNpb24gc3VjaCBhcyAnMS4yLjMnLCBvciAnZGV2ZWxvcG1lbnQnIHRvIGRpc2FibGUgY2FjaGVcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmhpZGVDdXJyZW5jeV0gaGlkZSBjdXJyZW5jeSBzeW1ib2xzL2NvZGVzIGluIHRoZSBnYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5sb2JieVVybD1cImhpc3Rvcnk6YmFjaygpXCJdIFVSTCB0byByZWRpcmVjdCBiYWNrIHRvIGxvYmJ5IG9uIG1vYmlsZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0XG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgICAgICAgICBbb3B0aW9ucy5kZXBvc2l0VXJsXSBVUkwgdG8gZGVwb3NpdCBwYWdlLCBpZiBub3QgdXNpbmcgYSB0YXJnZXQgZWxlbWVudFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuc3VwcG9ydFVybF0gVVJMIHRvIHN1cHBvcnQgcGFnZSwgaWYgbm90IHVzaW5nIGEgdGFyZ2V0IGVsZW1lbnRcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLmRlcG9zaXRFdmVudF0gaW5zdGVhZCBvZiB1c2luZyBVUkwsIGVtaXQgXCJkZXBvc2l0XCIgZXZlbnQgKHNlZSBldmVudCBkb2N1bWVudGF0aW9uKVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gICAgICAgICAgICAgW29wdGlvbnMubG9iYnlFdmVudF0gaW5zdGVhZCBvZiB1c2luZyBVUkwsIGVtaXQgXCJsb2JieVwiIGV2ZW50IChzZWUgZXZlbnQgZG9jdW1lbnRhdGlvbikgKG1vYmlsZSBvbmx5KVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgW29wdGlvbnMuYWNjb3VudEhpc3RvcnlVcmxdIFVSTCB0byBzdXBwb3J0IHBhZ2UsIGlmIG5vdCB1c2luZyBhIHRhcmdldCBlbGVtZW50XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcGkgPSBub2xpbWl0LnJlcGxhY2Uoe1xuICAgICAqICAgIGdhbWU6ICdEcmFnb25UcmliZScsXG4gICAgICogICAgdGFyZ2V0OiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpLFxuICAgICAqICAgIHRva2VuOiByZWFsTW9uZXlUb2tlbixcbiAgICAgKiAgICBtdXRlOiB0cnVlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgcmVwbGFjZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBsb2NhdGlvbi5ocmVmID0gdGhpcy51cmwob3B0aW9ucyk7XG5cbiAgICAgICAgZnVuY3Rpb24gbm9vcCgpIHtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7b246IG5vb3AsIGNhbGw6IG5vb3B9O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RzIGEgVVJMIGZvciBtYW51YWxseSBsb2FkaW5nIHRoZSBnYW1lIGluIGFuIGlmcmFtZSBvciB2aWEgcmVkaXJlY3QuXG5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBzZWUgcmVwbGFjZSBmb3IgZGV0YWlsc1xuICAgICAqIEBzZWUge0BsaW5rIG5vbGltaXQucmVwbGFjZX0gZm9yIGRldGFpbHMgb24gb3B0aW9uc1xuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1cmw6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdhbWVPcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICB2YXIgZ2FtZVVybCA9IFJFUExBQ0VfVVJMXG4gICAgICAgICAgICAucmVwbGFjZSgne0NETn0nLCBnYW1lT3B0aW9ucy5jZG4pXG4gICAgICAgICAgICAucmVwbGFjZSgne1FVRVJZfScsIG1ha2VRdWVyeVN0cmluZyhnYW1lT3B0aW9ucykpO1xuICAgICAgICByZXR1cm4gZ2FtZVVybDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTG9hZCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZ2FtZSwgc3VjaCBhczogY3VycmVudCB2ZXJzaW9uLCBwcmVmZXJyZWQgd2lkdGgvaGVpZ2h0IGV0Yy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIG9wdGlvbnNcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yIHRoZSBuYW1lIG9mIGEgcHJvZHVjdGlvbiBlbnZpcm9ubWVudC4gVGhpcyBvdmVycmlkZXMgdGhlIGVudmlyb25tZW50IHBhcnQgb2YgdGhlIGhvc3RuYW1lLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgIG9wdGlvbnMuZ2FtZSBjYXNlIHNlbnNpdGl2ZSBnYW1lIGNvZGUsIGZvciBleGFtcGxlICdEcmFnb25UcmliZScgb3IgJ1dpeHgnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICAgICAgW29wdGlvbnMudmVyc2lvbl0gZm9yY2Ugc3BlY2lmaWMgdmVyc2lvbiBvZiBnYW1lIHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gICAgY2FsbGJhY2sgIGNhbGxlZCB3aXRoIHRoZSBpbmZvIG9iamVjdCwgaWYgdGhlcmUgd2FzIGFuIGVycm9yLCB0aGUgJ2Vycm9yJyBmaWVsZCB3aWxsIGJlIHNldFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBub2xpbWl0LmluZm8oe2dhbWU6ICdEcmFnb25UcmliZSd9LCBmdW5jdGlvbihpbmZvKSB7XG4gICAgICogICAgIHZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2FtZScpO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUud2lkdGggPSBpbmZvLnNpemUud2lkdGggKyAncHgnO1xuICAgICAqICAgICB0YXJnZXQuc3R5bGUuaGVpZ2h0ID0gaW5mby5zaXplLmhlaWdodCArICdweCc7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGluZm8ubmFtZSwgaW5mby52ZXJzaW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBpbmZvOiBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBvcHRpb25zID0gcHJvY2Vzc09wdGlvbnMobWVyZ2VPcHRpb25zKHRoaXMub3B0aW9ucywgb3B0aW9ucykpO1xuICAgICAgICBpbmZvLmxvYWQob3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG1ha2VRdWVyeVN0cmluZyhvcHRpb25zKSB7XG4gICAgdmFyIHF1ZXJ5ID0gW107XG4gICAgZm9yKHZhciBrZXkgaW4gb3B0aW9ucykge1xuICAgICAgICB2YXIgdmFsdWUgPSBvcHRpb25zW2tleV07XG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHZhbHVlID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHF1ZXJ5LnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5LmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gbWFrZUlmcmFtZShlbGVtZW50KSB7XG4gICAgdmFyIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGNvcHlBdHRyaWJ1dGVzKGVsZW1lbnQsIGlmcmFtZSk7XG5cbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnYWxsb3dmdWxsc2NyZWVuJywgJycpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2FsbG93JywgJ2F1dG9wbGF5OyBmdWxsc2NyZWVuJyk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnc2FuZGJveCcsICdhbGxvdy1mb3JtcyBhbGxvdy1zY3JpcHRzIGFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXRvcC1uYXZpZ2F0aW9uIGFsbG93LXBvcHVwcycpO1xuXG4gICAgdmFyIG5hbWUgPSBnZW5lcmF0ZU5hbWUoaWZyYW1lLmdldEF0dHJpYnV0ZSgnbmFtZScpIHx8IGlmcmFtZS5pZCk7XG4gICAgaWZyYW1lLnNldEF0dHJpYnV0ZSgnbmFtZScsIG5hbWUpO1xuXG4gICAgcmV0dXJuIGlmcmFtZTtcbn1cblxuZnVuY3Rpb24gbWVyZ2VPcHRpb25zKGdsb2JhbE9wdGlvbnMsIGdhbWVPcHRpb25zKSB7XG4gICAgZGVsZXRlIGdsb2JhbE9wdGlvbnMudmVyc2lvbjtcbiAgICBkZWxldGUgZ2xvYmFsT3B0aW9ucy5yZXBsYXk7XG4gICAgZGVsZXRlIGdsb2JhbE9wdGlvbnMudG9rZW47XG4gICAgdmFyIG9wdGlvbnMgPSB7fSwgbmFtZTtcbiAgICBmb3IobmFtZSBpbiBERUZBVUxUX09QVElPTlMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IERFRkFVTFRfT1BUSU9OU1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yKG5hbWUgaW4gZ2FtZU9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uc1tuYW1lXSA9IGdhbWVPcHRpb25zW25hbWVdO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucztcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q3NzKGRvY3VtZW50KSB7XG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShyZXF1aXJlKCcuL25vbGltaXQuY3NzJykpKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBWaWV3cG9ydChoZWFkKSB7XG4gICAgdmFyIHZpZXdwb3J0ID0gaGVhZC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9XCJ2aWV3cG9ydFwiXScpO1xuICAgIGlmKCF2aWV3cG9ydCkge1xuICAgICAgICBoZWFkLmluc2VydEFkamFjZW50SFRNTCgnYmVmb3JlZW5kJywgJzxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MS4wLCBtYXhpbXVtLXNjYWxlPTEuMCwgdXNlci1zY2FsYWJsZT1ub1wiPicpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZGV2aWNlID0gb3B0aW9ucy5kZXZpY2UudG9Mb3dlckNhc2UoKTtcbiAgICBvcHRpb25zLm11dGUgPSBvcHRpb25zLm11dGUgfHwgZmFsc2U7XG4gICAgdmFyIGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnZpcm9ubWVudC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmKGVudmlyb25tZW50LmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICAgICAgZW52aXJvbm1lbnQgKz0gJy5ub2xpbWl0Y2RuLmNvbSc7XG4gICAgfVxuICAgIG9wdGlvbnMuY2RuID0gb3B0aW9ucy5jZG4gfHwgQ0ROLnJlcGxhY2UoJ3tFTlZ9JywgZW52aXJvbm1lbnQpO1xuICAgIG9wdGlvbnMuc3RhdGljUm9vdCA9IG9wdGlvbnMuc3RhdGljUm9vdCB8fCBHQU1FU19VUkwucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbik7XG4gICAgb3B0aW9ucy5wbGF5Rm9yRnVuQ3VycmVuY3kgPSBvcHRpb25zLnBsYXlGb3JGdW5DdXJyZW5jeSB8fCBvcHRpb25zLmN1cnJlbmN5O1xuICAgIGlmIChvcHRpb25zLmxhbmd1YWdlID09PSAncGUnIHx8IG9wdGlvbnMubGFuZ3VhZ2UgPT09ICdjbCcpIHtcbiAgICAgICAgb3B0aW9ucy5sYW5ndWFnZSA9ICdlcyc7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiBodG1sKHdpbmRvdywgb3B0aW9ucykge1xuICAgIHZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudDtcblxuICAgIHdpbmRvdy5mb2N1cygpO1xuXG4gICAgaW5zZXJ0Q3NzKGRvY3VtZW50KTtcbiAgICBzZXR1cFZpZXdwb3J0KGRvY3VtZW50LmhlYWQpO1xuXG4gICAgdmFyIGxvYWRlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICBsb2FkZXJFbGVtZW50LnNldEF0dHJpYnV0ZSgnZnJhbWVCb3JkZXInLCAnMCcpO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJ2JsYWNrJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLndpZHRoID0gJzEwMHZ3JztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLmhlaWdodCA9ICcxMDB2aCc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS56SW5kZXggPSAnMjE0NzQ4MzY0Nyc7XG4gICAgbG9hZGVyRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdsb2FkZXInKTtcblxuICAgIGxvYWRlckVsZW1lbnQuc3JjID0gTE9BREVSX1VSTFxuICAgICAgICAucmVwbGFjZSgne0NETn0nLCBvcHRpb25zLmNkbilcbiAgICAgICAgLnJlcGxhY2UoJ3tERVZJQ0V9Jywgb3B0aW9ucy5kZXZpY2UpXG4gICAgICAgIC5yZXBsYWNlKCd7T1BFUkFUT1J9Jywgb3B0aW9ucy5vcGVyYXRvcilcbiAgICAgICAgLnJlcGxhY2UoJ3tHQU1FfScsIG9wdGlvbnMuZ2FtZSlcbiAgICAgICAgLnJlcGxhY2UoJ3tMQU5HVUFHRX0nLCBvcHRpb25zLmxhbmd1YWdlKTtcblxuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gJyc7XG5cbiAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgIGlmKGxvYWRlckVsZW1lbnQgJiYgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyRWxlbWVudC5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHsnZXJyb3InOiBlcnJvcn0pLCAnKicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBub2xpbWl0LmluZm8ob3B0aW9ucywgZnVuY3Rpb24oaW5mbykge1xuICAgICAgICAgICAgaWYoaW5mby5lcnJvcikge1xuICAgICAgICAgICAgICAgIHdpbmRvdy50cmlnZ2VyKCdlcnJvcicsIGluZm8uZXJyb3IpO1xuICAgICAgICAgICAgICAgIGxvYWRlckVsZW1lbnQuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShpbmZvKSwgJyonKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnRyaWdnZXIoJ2luZm8nLCBpbmZvKTtcblxuICAgICAgICAgICAgICAgIHZhciBnYW1lRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IGluZm8uc3RhdGljUm9vdCArICcvZ2FtZS5qcyc7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmxvYWRTdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgd2luZG93Lm5vbGltaXQgPSBub2xpbWl0O1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5ub2xpbWl0Lm9wdGlvbnMudmVyc2lvbiA9IGluZm8udmVyc2lvbjtcblxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBsb2FkZXJFbGVtZW50Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxvYWRlckVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBjb3B5QXR0cmlidXRlcyhmcm9tLCB0bykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gZnJvbS5hdHRyaWJ1dGVzO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhdHRyaWJ1dGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlc1tpXTtcbiAgICAgICAgdG8uc2V0QXR0cmlidXRlKGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7XG4gICAgfVxufVxuXG52YXIgZ2VuZXJhdGVOYW1lID0gKGZ1bmN0aW9uKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIG5hbWUgfHwgJ05vbGltaXQtJyArIGdlbmVyYXRlZEluZGV4Kys7XG4gICAgfTtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gbm9saW1pdDtcbiJdfQ==
