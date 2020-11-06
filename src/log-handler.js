var UAParser = require('ua-parser-js');
var uaParser = new UAParser();
var ua = uaParser.getResult();

var SESSION_KEY = 'nolimit.js.log.session';
var URL = 'https://gamelog.nolimitcity.com/';
var LATEST = 'nolimit-latest';
var CURRENT_SCRIPT = currentScript();

var session = handleSession();

var extras = {};
var storedEvents = [];

function currentScript() {
    try {
        var scripts = document.getElementsByTagName('script');
        var index = scripts.length - 1;
        var tag = scripts[index];

        return tag.src;
    } catch (e) {
        return '';
    }
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function handleSession() {
    var fromStorage = null;
    try {
        fromStorage = sessionStorage.getItem(SESSION_KEY);
    } catch (e) {
        console.error('Could not read session', e);
    }
    var toSave = fromStorage || uuidv4();
    try {
        sessionStorage.setItem(SESSION_KEY, toSave);
    } catch (e) {
        console.error('Could not save session', e);
    }
    return toSave;
}

function sendLog(event, data) {
    // eslint-disable-next-line no-warning-comments
    // TODO: temp safety measure
    if(CURRENT_SCRIPT.indexOf(LATEST) === -1) {
        return;
    }

    if(extras.environment === 'test') {
        return;
    }

    data = data || {};
    var request = new XMLHttpRequest();
    request.open('POST', URL, true);
    request.setRequestHeader('Content-Type', 'application/json');

    request.onload = function() {
        if(request.status >= 200 && request.status < 400) {
            try {
                var response = JSON.parse(request.responseText);
                console.log('Logger response:', response);
            } catch(e) {
                console.warn('Failed to send log:', e.message, event, data, e);
            }
        } else {
            console.warn('Error from server:', request.status, request.statusText, event, data);
        }
    };

    request.onerror = function() {
        console.warn('Logger error:', request.status, request.statusText, event, data);
    };

    var device = uaParser.getDevice();
    var body = {
        event: event,
        session: session,
        browser: ua.browser.name + ' ' + ua.browser.version,
        os: ua.os.name + ' ' + ua.os.version,
        vendor: device.vendor,
        model: device.model,
        history: storedEvents.slice(-10),
        deltaTime: Date.now() - extras.startTime
    };

    for(var name in extras) {
        body[name] = extras[name];
    }

    var key = uuidv4();
    body.data = data;

    var payload = {key: key, body: body};

    console.log('Logging payload:', payload);

    request.send(JSON.stringify(payload));
}

var errorAlreadySent = false;
var logHandler = {
    sendError: function(e) {
        if(errorAlreadySent) {
            console.log('Already sent errors, but was', e);
            return;
        }

        errorAlreadySent = true;

        var message = e.message || e;

        if(message === 'Script error.') {
            return;
        }

        if(e.code) {
            message = message + ' (' + e.code + ')';
        }

        if(e.filename && e.lineno) {
            message = message + ' @ ' + e.filename + ' line:' + e.lineno;
        }

        var data = {
            message: message
        };

        this.sendLog('ERROR', data);
    },

    sendLog: sendLog,

    setExtra: function(name, extra) {
        extras[name] = extra;
    },

    setExtras: function(extras) {
        for(var name in extras) {
            this.setExtra(name, extras[name]);
        }
    },

    storeEvent: function(name, data) {
        var event = {
            name: data,
            timestamp: Date.now()
        };
        storedEvents.push(event);
    },

    getEvents: function(filter) {
        if(filter) {
            return storedEvents.filter(function(event) {
                return event.name === filter;
            });
        }
        return storedEvents;
    }
};

window.addEventListener('error', onWindowError);

function onWindowError(e) {
    window.removeEventListener('error', onWindowError);
    console.warn(e.message, e);
    logHandler.sendError(e);
}

module.exports = logHandler;
