export function loadOverlay(options, callback) {
    console.log("Loading overlay");
    const parts = [options.staticRoot, 'overlay'];
    if (options.version) {
        parts.push(options.version);
    }
    parts.push('overlay.json');

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
                const resp = JSON.parse(request.responseText);
                resp.staticRoot = [options.staticRoot, resp.name, resp.version].join('/');
                resp.aspectRatio = resp.size.width / resp.size.height;
                resp.infoJson = url;
                callback(resp);
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
