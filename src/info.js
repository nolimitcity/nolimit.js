export function loadInfo(options, callback) {
    const parts = [options.staticRoot, options.game.replace(/DX[0-9]+$/, '').replace(/[A-Z]{2}$/, '')];
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
