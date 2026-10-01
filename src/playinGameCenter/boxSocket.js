const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const JITTER_MS = 1_000

const CLOSE_BAD_MESSAGE = 4400
const CLOSE_UNAUTHORIZED = 4401
const CLOSE_TOO_MANY = 4429

/**
 * Keeps a player events WebSocket open and hands the summary from each message to the caller.
 * Reconnects with backoff after drops; stops when the token is rejected or stop() is called.
 */
export class BoxSocket {
    /**
     * @param {Object} options
     * @param {string} options.url - Player events endpoint (http(s) or ws(s))
     * @param {string} options.token - playerConnect token, sent in the first message
     * @param {Function} options.onSummary - Called with each summary received
     * @param {Function} options.onUnauthorized - Called on 4401; the socket then stays closed
     */
    constructor({ url, token, onSummary, onUnauthorized }) {
        this._url = toWebSocketUrl(url)
        this._token = token
        this._onSummary = onSummary
        this._onUnauthorized = onUnauthorized
        this._stopped = false
        this._socket = null
        this._timer = null
        this._failures = 0
    }

    start() {
        this._connect()
    }

    stop() {
        this._stopped = true
        clearTimeout(this._timer)
        const socket = this._socket
        this._socket = null // cleared first so the closing socket's handlers are no-ops
        socket?.close(1000)
    }

    /** Call when the game becomes active: reconnects now instead of waiting out the backoff. */
    refresh() {
        if (!this._stopped && !this._socket) {
            this._connect()
        }
    }

    _connect() {
        if (this._stopped || this._socket || typeof WebSocket === "undefined") {
            return
        }
        clearTimeout(this._timer)
        let socket
        try {
            socket = new WebSocket(this._url)
        } catch {
            this._scheduleReconnect()
            return
        }
        this._socket = socket

        socket.onopen = () => {
            if (this._socket === socket) {
                socket.send(JSON.stringify({ type: "auth", token: this._token }))
            }
        }
        socket.onmessage = (event) => {
            if (this._socket !== socket) {
                return
            }
            let message
            try {
                message = JSON.parse(event.data)
            } catch {
                return
            }
            if (message?.type === "ready") {
                this._failures = 0
            }
            // ready, resync and box.awarded all carry the current summary.
            if (message?.summary) {
                this._onSummary(message.summary)
            }
        }
        socket.onclose = (event) => {
            if (this._socket !== socket) {
                return
            }
            this._socket = null
            if (event.code === CLOSE_UNAUTHORIZED) {
                this._stopped = true
                this._onUnauthorized()
            } else if (event.code === CLOSE_BAD_MESSAGE || event.code === CLOSE_TOO_MANY) {
                this._stopped = true
            } else {
                this._scheduleReconnect()
            }
        }
    }

    _scheduleReconnect() {
        // 1s → 2s → 4s … up to 30s; jitter spreads reconnects after a deploy.
        const delay = Math.min(MIN_BACKOFF_MS * 2 ** this._failures, MAX_BACKOFF_MS) + Math.random() * JITTER_MS
        this._failures++
        this._timer = setTimeout(() => this._connect(), delay)
    }
}

function toWebSocketUrl(url) {
    const absolute = new URL(url, window.location.href)
    absolute.protocol = absolute.protocol === "https:" || absolute.protocol === "wss:" ? "wss:" : "ws:"
    return absolute.href
}
