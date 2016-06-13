(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nolimit = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var info = {
    load: function (url, version, callback) {

        var request = new XMLHttpRequest();

        function onFail() {
            callback({
                version: version,
                error: request.statusText
            });
        }

        request.open('GET', url, true);

        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                try {
                    var info = JSON.parse(request.responseText);
                    if (version) {
                        info.latest = info.version;
                        if (/^\d/.test(version)) {
                            info.version = version;
                        } else {
                            info.version = 'development';
                        }
                    }

                    callback(info);
                } catch (e) {
                    callback({
                        version: version,
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
var nolimitApiFactory = function (target) {

    var listeners = {};
    var unHandled = {};
    var port;

    function addMessageListener(gameWindow) {
        gameWindow.addEventListener('message', function (e) {
            if (e.ports.length > 0) {
                port = e.ports[0];
                port.onmessage = onMessage;
                registerEvents(Object.keys(listeners));
            }
        });
    }

    if (target.nodeName === 'IFRAME') {
        target.addEventListener('load', function () {
            addMessageListener(target.contentWindow);
        });
    } else {
        addMessageListener(target);
    }

    function onMessage(e) {
        trigger(e.data.method, e.data.params);
    }

    function registerEvents(events) {
        if (port) {
            var message = {
                method: 'register',
                params: events
            };

            port.postMessage(message);
        }
    }

    function trigger(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(function (callback) {
                callback(data);
            });
        } else {
            unHandled[name] = unHandled[name] || [];
            unHandled[name].push(data);
        }
    }

    /**
     * Connection to the game using MessageChannel
     * @exports nolimitApi
     */
    var nolimitApi = {
        /**
         * Add listener for event from the opened game
         *
         * @param {String}   event    name of the event
         * @param {Function} callback callback for the event, see documentation for the specific events to
         */

        on: function (event, callback) {
            listeners[event] = listeners[event] || [];
            listeners[event].push(callback);
            while (unHandled[event] && unHandled[event].length > 0) {
                trigger(event, unHandled[event].pop());
            }

            registerEvents([event]);
        }
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

var CDN = 'https://{ENV}.nolimitcdn.com';
var LOADER_URL = '{CDN}/loader/loader-{DEVICE}.html';
var GAMES_URL = '{CDN}/games';
var INFO_JSON_URL = '/{GAME}/info.json';
var GAME_JS_URL = '/{GAME}{VERSION}/game.js';

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
     * @param {String}              [options.token] the token to use for real money play
     * @param {Boolean}             [options.mute=false] start the game without sound
     * @param {String}              [options.version] force specific game version such as '1.2.3', or 'development' to disable cache
     */
    load: function (options) {
        var target = options.target || window;
        options.mute = options.mute || false;

        var gameOptions = mergeOptions(this.options, options);

        if (target instanceof HTMLElement) {
            var iframe = makeIframe(target);

            iframe.addEventListener('load', function () {
                html(iframe.contentWindow, gameOptions);
            });

            var iframeConnection = nolimitApiFactory(iframe);

            target.parentNode.replaceChild(iframe, target);
            return iframeConnection;

        } else if (target.Window && target instanceof target.Window) {

            var windowConnection = nolimitApiFactory(target);
            html(target, gameOptions);
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

    document.body.innerHTML = '';

    loaderElement.onload = function () {
        var staticRoot = options.staticRoot || GAMES_URL.replace('{CDN}', cdn);
        var game = options.game;
        var url = staticRoot + INFO_JSON_URL.replace('{GAME}', game);

        info.load(url, options.version, function (info) {
            window.nolimit.info = info;
            var version = info.version === 'development' ? '' : '/' + info.version;

            var gameElement = document.createElement('script');
            gameElement.src = staticRoot + GAME_JS_URL.replace('{GAME}', game).replace('{VERSION}', version);
            document.body.appendChild(gameElement);
        });
    };

    document.body.appendChild(loaderElement);
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

console.log('nolimit.js', '1.0.1');

module.exports = nolimit;

},{"./info":1,"./nolimit-api":2,"./nolimit.css":3}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5mby5qcyIsInNyYy9ub2xpbWl0LWFwaS5qcyIsInNyYy9ub2xpbWl0LmNzcyIsInNyYy9ub2xpbWl0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGluZm8gPSB7XG4gICAgbG9hZDogZnVuY3Rpb24gKHVybCwgdmVyc2lvbiwgY2FsbGJhY2spIHtcblxuICAgICAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uRmFpbCgpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiB2ZXJzaW9uLFxuICAgICAgICAgICAgICAgIGVycm9yOiByZXF1ZXN0LnN0YXR1c1RleHRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuXG4gICAgICAgIHJlcXVlc3Qub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID49IDIwMCAmJiByZXF1ZXN0LnN0YXR1cyA8IDQwMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmZvID0gSlNPTi5wYXJzZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvLmxhdGVzdCA9IGluZm8udmVyc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgvXlxcZC8udGVzdCh2ZXJzaW9uKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8udmVyc2lvbiA9IHZlcnNpb247XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8udmVyc2lvbiA9ICdkZXZlbG9wbWVudCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhpbmZvKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb246IHZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogZS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb25GYWlsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gb25GYWlsO1xuXG4gICAgICAgIHJlcXVlc3Quc2VuZCgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW5mbztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAZXhwb3J0cyBub2xpbWl0QXBpRmFjdG9yeVxuICogQHByaXZhdGVcbiAqL1xudmFyIG5vbGltaXRBcGlGYWN0b3J5ID0gZnVuY3Rpb24gKHRhcmdldCkge1xuXG4gICAgdmFyIGxpc3RlbmVycyA9IHt9O1xuICAgIHZhciB1bkhhbmRsZWQgPSB7fTtcbiAgICB2YXIgcG9ydDtcblxuICAgIGZ1bmN0aW9uIGFkZE1lc3NhZ2VMaXN0ZW5lcihnYW1lV2luZG93KSB7XG4gICAgICAgIGdhbWVXaW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBpZiAoZS5wb3J0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcG9ydCA9IGUucG9ydHNbMF07XG4gICAgICAgICAgICAgICAgcG9ydC5vbm1lc3NhZ2UgPSBvbk1lc3NhZ2U7XG4gICAgICAgICAgICAgICAgcmVnaXN0ZXJFdmVudHMoT2JqZWN0LmtleXMobGlzdGVuZXJzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQubm9kZU5hbWUgPT09ICdJRlJBTUUnKSB7XG4gICAgICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldC5jb250ZW50V2luZG93KTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYWRkTWVzc2FnZUxpc3RlbmVyKHRhcmdldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25NZXNzYWdlKGUpIHtcbiAgICAgICAgdHJpZ2dlcihlLmRhdGEubWV0aG9kLCBlLmRhdGEucGFyYW1zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlckV2ZW50cyhldmVudHMpIHtcbiAgICAgICAgaWYgKHBvcnQpIHtcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ3JlZ2lzdGVyJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IGV2ZW50c1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcG9ydC5wb3N0TWVzc2FnZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgaWYgKGxpc3RlbmVyc1tldmVudF0pIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc1tldmVudF0uZm9yRWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5IYW5kbGVkW25hbWVdID0gdW5IYW5kbGVkW25hbWVdIHx8IFtdO1xuICAgICAgICAgICAgdW5IYW5kbGVkW25hbWVdLnB1c2goZGF0YSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0aW9uIHRvIHRoZSBnYW1lIHVzaW5nIE1lc3NhZ2VDaGFubmVsXG4gICAgICogQGV4cG9ydHMgbm9saW1pdEFwaVxuICAgICAqL1xuICAgIHZhciBub2xpbWl0QXBpID0ge1xuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGxpc3RlbmVyIGZvciBldmVudCBmcm9tIHRoZSBvcGVuZWQgZ2FtZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gICBldmVudCAgICBuYW1lIG9mIHRoZSBldmVudFxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBjYWxsYmFjayBmb3IgdGhlIGV2ZW50LCBzZWUgZG9jdW1lbnRhdGlvbiBmb3IgdGhlIHNwZWNpZmljIGV2ZW50cyB0b1xuICAgICAgICAgKi9cblxuICAgICAgICBvbjogZnVuY3Rpb24gKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgbGlzdGVuZXJzW2V2ZW50XSA9IGxpc3RlbmVyc1tldmVudF0gfHwgW107XG4gICAgICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgd2hpbGUgKHVuSGFuZGxlZFtldmVudF0gJiYgdW5IYW5kbGVkW2V2ZW50XS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdHJpZ2dlcihldmVudCwgdW5IYW5kbGVkW2V2ZW50XS5wb3AoKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlZ2lzdGVyRXZlbnRzKFtldmVudF0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBub2xpbWl0QXBpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBub2xpbWl0QXBpRmFjdG9yeTtcbiIsIm1vZHVsZS5leHBvcnRzID0gJ2h0bWwsIGJvZHkge1xcbiAgICBvdmVyZmxvdzogaGlkZGVuO1xcbiAgICBtYXJnaW46IDA7XFxuICAgIHdpZHRoOiAxMDAlO1xcbiAgICBoZWlnaHQ6IDEwMCU7XFxufVxcblxcbmJvZHkge1xcbiAgICBwb3NpdGlvbjogcmVsYXRpdmU7XFxufVxcbic7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbm9saW1pdEFwaUZhY3RvcnkgPSByZXF1aXJlKCcuL25vbGltaXQtYXBpJyk7XG52YXIgaW5mbyA9IHJlcXVpcmUoJy4vaW5mbycpO1xuXG52YXIgQ0ROID0gJ2h0dHBzOi8ve0VOVn0ubm9saW1pdGNkbi5jb20nO1xudmFyIExPQURFUl9VUkwgPSAne0NETn0vbG9hZGVyL2xvYWRlci17REVWSUNFfS5odG1sJztcbnZhciBHQU1FU19VUkwgPSAne0NETn0vZ2FtZXMnO1xudmFyIElORk9fSlNPTl9VUkwgPSAnL3tHQU1FfS9pbmZvLmpzb24nO1xudmFyIEdBTUVfSlNfVVJMID0gJy97R0FNRX17VkVSU0lPTn0vZ2FtZS5qcyc7XG5cbnZhciBERUZBVUxUX09QVElPTlMgPSB7XG4gICAgY3VycmVuY3k6ICdFVVInLFxuICAgIGRldmljZTogJ2Rlc2t0b3AnLFxuICAgIGVudmlyb25tZW50OiAncGFydG5lcicsXG4gICAgbGFuZ3VhZ2U6ICdlbicsXG4gICAgbG9hZGVyOiAnbm9saW1pdC5qcydcbn07XG5cbi8qKlxuICogQGV4cG9ydHMgbm9saW1pdFxuICovXG52YXIgbm9saW1pdCA9IHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgbG9hZGVyIHdpdGggZGVmYXVsdCBwYXJhbWV0ZXJzLiBDYW4gYmUgc2tpcHBlZCBpZiB0aGUgcGFyYW1ldGVycyBhcmUgaW5jbHVkZWQgaW4gdGhlIGNhbGwgdG8gbG9hZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9ICBvcHRpb25zXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBvcHRpb25zLm9wZXJhdG9yIHRoZSBvcGVyYXRvciBjb2RlIGZvciB0aGUgb3BlcmF0b3JcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmxhbmd1YWdlPVwiZW5cIl0gdGhlIGxhbmd1YWdlIHRvIHVzZSBmb3IgdGhlIGdhbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gIFtvcHRpb25zLmRldmljZT1kZXNrdG9wXSB0eXBlIG9mIGRldmljZTogJ2Rlc2t0b3AnIG9yICdtb2JpbGUnXG4gICAgICogQHBhcmFtIHtTdHJpbmd9ICBbb3B0aW9ucy5lbnZpcm9ubWVudD1wYXJ0bmVyXSB3aGljaCBlbnZpcm9ubWVudCB0byB1c2U7IHVzdWFsbHkgJ3BhcnRuZXInIG9yICdwcm9kdWN0aW9uJ1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgW29wdGlvbnMuY3VycmVuY3k9RVVSXSBjdXJyZW5jeSB0byB1c2UsIGlmIG5vdCBwcm92aWRlZCBieSBzZXJ2ZXJcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIExvYWQgZ2FtZSwgcmVwbGFjaW5nIHRhcmdldCB3aXRoIHRoZSBnYW1lLlxuICAgICAqXG4gICAgICogPGxpPiBJZiB0YXJnZXQgaXMgYSBIVE1MIGVsZW1lbnQsIGl0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhbiBpZnJhbWUsIGtlZXBpbmcgYWxsIHRoZSBhdHRyaWJ1dGVzIG9mIHRoZSBvcmlnaW5hbCBlbGVtZW50LCBzbyB0aG9zZSBjYW4gYmUgdXNlZCB0byBzZXQgaWQsIGNsYXNzZXMsIHN0eWxlcyBhbmQgbW9yZS5cbiAgICAgKiA8bGk+IElmIHRhcmdldCBpcyBhIFdpbmRvdyBlbGVtZW50LCB0aGUgZ2FtZSB3aWxsIGJlIGxvYWRlZCBkaXJlY3RseSBpbiB0aGF0LlxuICAgICAqIDxsaT4gSWYgdGFyZ2V0IGlzIHVuZGVmaW5lZCwgaXQgd2lsbCBkZWZhdWx0IHRvIHRoZSBjdXJyZW50IHdpbmRvdy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICAgICAgb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7U3RyaW5nfSAgICAgICAgICAgICAgb3B0aW9ucy5nYW1lIGNhc2Ugc2Vuc2l0aXZlIGdhbWUgY29kZSwgZm9yIGV4YW1wbGUgJ0NyZWVweUNhcm5pdmFsJyBvciAnU3BhY2VBcmNhZGUnXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudHxXaW5kb3d9ICBbb3B0aW9ucy50YXJnZXQ9d2luZG93XSB0aGUgSFRNTEVsZW1lbnQgb3IgV2luZG93IHRvIGxvYWQgdGhlIGdhbWUgaW5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnRva2VuXSB0aGUgdG9rZW4gdG8gdXNlIGZvciByZWFsIG1vbmV5IHBsYXlcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59ICAgICAgICAgICAgIFtvcHRpb25zLm11dGU9ZmFsc2VdIHN0YXJ0IHRoZSBnYW1lIHdpdGhvdXQgc291bmRcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgICAgICAgIFtvcHRpb25zLnZlcnNpb25dIGZvcmNlIHNwZWNpZmljIGdhbWUgdmVyc2lvbiBzdWNoIGFzICcxLjIuMycsIG9yICdkZXZlbG9wbWVudCcgdG8gZGlzYWJsZSBjYWNoZVxuICAgICAqL1xuICAgIGxvYWQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciB0YXJnZXQgPSBvcHRpb25zLnRhcmdldCB8fCB3aW5kb3c7XG4gICAgICAgIG9wdGlvbnMubXV0ZSA9IG9wdGlvbnMubXV0ZSB8fCBmYWxzZTtcblxuICAgICAgICB2YXIgZ2FtZU9wdGlvbnMgPSBtZXJnZU9wdGlvbnModGhpcy5vcHRpb25zLCBvcHRpb25zKTtcblxuICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBpZnJhbWUgPSBtYWtlSWZyYW1lKHRhcmdldCk7XG5cbiAgICAgICAgICAgIGlmcmFtZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGh0bWwoaWZyYW1lLmNvbnRlbnRXaW5kb3csIGdhbWVPcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgaWZyYW1lQ29ubmVjdGlvbiA9IG5vbGltaXRBcGlGYWN0b3J5KGlmcmFtZSk7XG5cbiAgICAgICAgICAgIHRhcmdldC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChpZnJhbWUsIHRhcmdldCk7XG4gICAgICAgICAgICByZXR1cm4gaWZyYW1lQ29ubmVjdGlvbjtcblxuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldC5XaW5kb3cgJiYgdGFyZ2V0IGluc3RhbmNlb2YgdGFyZ2V0LldpbmRvdykge1xuXG4gICAgICAgICAgICB2YXIgd2luZG93Q29ubmVjdGlvbiA9IG5vbGltaXRBcGlGYWN0b3J5KHRhcmdldCk7XG4gICAgICAgICAgICBodG1sKHRhcmdldCwgZ2FtZU9wdGlvbnMpO1xuICAgICAgICAgICAgcmV0dXJuIHdpbmRvd0Nvbm5lY3Rpb247XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93ICdJbnZhbGlkIG9wdGlvbiB0YXJnZXQ6ICcgKyB0YXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5mdW5jdGlvbiBtYWtlSWZyYW1lKGVsZW1lbnQpIHtcbiAgICB2YXIgaWZyYW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgY29weUF0dHJpYnV0ZXMoZWxlbWVudCwgaWZyYW1lKTtcblxuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ2ZyYW1lQm9yZGVyJywgJzAnKTtcbiAgICB2YXIgbmFtZSA9IGdlbmVyYXRlTmFtZShpZnJhbWUuZ2V0QXR0cmlidXRlKCduYW1lJykgfHwgaWZyYW1lLmlkKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCduYW1lJywgbmFtZSk7XG5cbiAgICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkuZGlzcGxheTtcblxuICAgIHJldHVybiBpZnJhbWU7XG59XG5cbmZ1bmN0aW9uIG1lcmdlT3B0aW9ucyhnbG9iYWxPcHRpb25zLCBnYW1lT3B0aW9ucykge1xuICAgIHZhciBvcHRpb25zID0ge30sIG5hbWU7XG4gICAgZm9yIChuYW1lIGluIERFRkFVTFRfT1BUSU9OUykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gREVGQVVMVF9PUFRJT05TW25hbWVdO1xuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4gZ2xvYmFsT3B0aW9ucykge1xuICAgICAgICBvcHRpb25zW25hbWVdID0gZ2xvYmFsT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgZm9yIChuYW1lIGluIGdhbWVPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnNbbmFtZV0gPSBnYW1lT3B0aW9uc1tuYW1lXTtcbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbmZ1bmN0aW9uIGluc2VydENzcyhkb2N1bWVudCkge1xuICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudGV4dENvbnRlbnQgPSByZXF1aXJlKCcuL25vbGltaXQuY3NzJyk7XG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG5cbmZ1bmN0aW9uIHNldHVwVmlld3BvcnQoaGVhZCkge1xuICAgIHZhciB2aWV3cG9ydCA9IGhlYWQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPVwidmlld3BvcnRcIl0nKTtcbiAgICBpZiAoIXZpZXdwb3J0KSB7XG4gICAgICAgIGhlYWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCAnPG1ldGEgbmFtZT1cInZpZXdwb3J0XCIgY29udGVudD1cIndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xXCI+Jyk7XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGh0bWwod2luZG93LCBvcHRpb25zKSB7XG5cbiAgICB2YXIgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQ7XG5cbiAgICBpbnNlcnRDc3MoZG9jdW1lbnQpO1xuICAgIHNldHVwVmlld3BvcnQoZG9jdW1lbnQuaGVhZCk7XG5cbiAgICB2YXIgbG9hZGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGxvYWRlckVsZW1lbnQuc2V0QXR0cmlidXRlKCdmcmFtZUJvcmRlcicsICcwJyk7XG4gICAgbG9hZGVyRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnYmxhY2snO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUud2lkdGggPSAnMTAwdncnO1xuICAgIGxvYWRlckVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gJzEwMHZoJztcbiAgICBsb2FkZXJFbGVtZW50LnN0eWxlLnpJbmRleCA9ICcyMTQ3NDgzNjQ3JztcblxuICAgIHZhciBjZG4gPSBDRE4ucmVwbGFjZSgne0VOVn0nLCBvcHRpb25zLmVudmlyb25tZW50LnRvTG93ZXJDYXNlKCkpO1xuICAgIGxvYWRlckVsZW1lbnQuc3JjID0gTE9BREVSX1VSTC5yZXBsYWNlKCd7Q0ROfScsIGNkbikucmVwbGFjZSgne0RFVklDRX0nLCBvcHRpb25zLmRldmljZS50b0xvd2VyQ2FzZSgpKTtcblxuICAgIHdpbmRvdy5ub2xpbWl0ID0gd2luZG93Lm5vbGltaXQgfHwge307XG4gICAgd2luZG93Lm5vbGltaXQub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICBkb2N1bWVudC5ib2R5LmlubmVySFRNTCA9ICcnO1xuXG4gICAgbG9hZGVyRWxlbWVudC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdGF0aWNSb290ID0gb3B0aW9ucy5zdGF0aWNSb290IHx8IEdBTUVTX1VSTC5yZXBsYWNlKCd7Q0ROfScsIGNkbik7XG4gICAgICAgIHZhciBnYW1lID0gb3B0aW9ucy5nYW1lO1xuICAgICAgICB2YXIgdXJsID0gc3RhdGljUm9vdCArIElORk9fSlNPTl9VUkwucmVwbGFjZSgne0dBTUV9JywgZ2FtZSk7XG5cbiAgICAgICAgaW5mby5sb2FkKHVybCwgb3B0aW9ucy52ZXJzaW9uLCBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgd2luZG93Lm5vbGltaXQuaW5mbyA9IGluZm87XG4gICAgICAgICAgICB2YXIgdmVyc2lvbiA9IGluZm8udmVyc2lvbiA9PT0gJ2RldmVsb3BtZW50JyA/ICcnIDogJy8nICsgaW5mby52ZXJzaW9uO1xuXG4gICAgICAgICAgICB2YXIgZ2FtZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICAgICAgICAgIGdhbWVFbGVtZW50LnNyYyA9IHN0YXRpY1Jvb3QgKyBHQU1FX0pTX1VSTC5yZXBsYWNlKCd7R0FNRX0nLCBnYW1lKS5yZXBsYWNlKCd7VkVSU0lPTn0nLCB2ZXJzaW9uKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ2FtZUVsZW1lbnQpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChsb2FkZXJFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gY29weUF0dHJpYnV0ZXMoZnJvbSwgdG8pIHtcbiAgICB2YXIgYXR0cmlidXRlcyA9IGZyb20uYXR0cmlidXRlcztcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGF0dHIgPSBhdHRyaWJ1dGVzW2ldO1xuICAgICAgICB0by5zZXRBdHRyaWJ1dGUoYXR0ci5uYW1lLCBhdHRyLnZhbHVlKTtcbiAgICB9XG59XG5cbnZhciBnZW5lcmF0ZU5hbWUgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBnZW5lcmF0ZWRJbmRleCA9IDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHJldHVybiBuYW1lIHx8ICdOb2xpbWl0LScgKyBnZW5lcmF0ZWRJbmRleCsrO1xuICAgIH07XG59KSgpO1xuXG5jb25zb2xlLmxvZygnbm9saW1pdC5qcycsICcxLjAuMScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vbGltaXQ7XG4iXX0=
