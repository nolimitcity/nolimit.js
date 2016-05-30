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
