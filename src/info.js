var logHandler = require('./log-handler');

var info = {
    load: function(options, callback) {
        var parts = [options.staticRoot, options.game];
        if(options.version) {
            parts.push(options.version);
        }
        parts.push('info.json');

        var url = parts.join('/');
        var request = new XMLHttpRequest();

        function onFail() {
            var error = request.statusText || 'No error message available; CORS or server missing?';
            callback({
                error: error
            });
        }

        request.open('GET', url, true);

        request.onload = function() {
            if(request.status >= 200 && request.status < 400) {
                var info;
                try {
                    info = JSON.parse(request.responseText);
                    info.staticRoot = [options.staticRoot, info.name, info.version].join('/');
                    info.aspectRatio = info.size.width / info.size.height;
                    info.infoJson = url;

                    logHandler.setExtra('version', info.version);
                } catch(e) {
                    callback({
                        error: e.message
                    });
                    return;
                }
                callback(info);
            } else {
                onFail();
            }
        };

        request.onerror = onFail;

        request.send();
    }
};

module.exports = info;
