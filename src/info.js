'use strict';

var INFO_JSON_URL = '/{GAME}/info.json';

var info = {
    load: function(options, callback) {
        var url = options.staticRoot + INFO_JSON_URL
            .replace('{GAME}/', options.game + (options.version ? '/' + options.version + '/' : '/'));

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
                var info;
                try {
                    info = JSON.parse(request.responseText);
                    info.version = options.version || info.version;
                    info.staticRoot = [options.staticRoot, info.name, info.version].join('/');
                    info.aspectRatio = info.size.width / info.size.height;
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
