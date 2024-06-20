export function nolimitApiFactory(target, onload) {

    const listeners = {};
    const unhandledEvents = {};
    const unhandledCalls = [];
    let port;

    function handleUnhandledCalls(port) {
        while (unhandledCalls.length > 0) {
            port.postMessage(unhandledCalls.shift());
        }
    }

    function addMessageListener(contentWindow) {
        contentWindow.addEventListener('message', function (e) {
            if (e.ports && e.ports.length > 0) {
                port = e.ports[0];
                port.onmessage = onMessage;
                handleUnhandledCalls(port);
            }
        });
        contentWindow.trigger = trigger;
        contentWindow.on = on;
        onload();
    }

    if (target.nodeName === 'IFRAME') {
        if (target.contentWindow && target.contentWindow.document && target.contentWindow.document.readyState === 'complete') {
            addMessageListener(target.contentWindow);
        } else {
            target.addEventListener('load', function () {
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
        const message = {
            jsonrpc: '2.0',
            method: method
        };

        if (data) {
            message.params = data;
        }

        if (port) {
            try {
                port.postMessage(message);
            } catch (ignored) {
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
        if (listeners[event]) {
            listeners[event].forEach(function (callback) {
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
        while (unhandledEvents[event] && unhandledEvents[event].length > 0) {
            trigger(event, unhandledEvents[event].pop());
        }

        registerEvents([event]);
    }

    /**
     * The api object returned when loading a game with methods for interacting with the loaded game
     *
     * @module nolimitApi
     */
    return {
        /**
         * Add listener for event from the started game
         *
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
         * @param {String} event  name of the event
         * @param {Object} [data] optional data for the event, if any
         */
        trigger: trigger
    };
}
