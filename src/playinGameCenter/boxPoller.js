const POLL_INTERVAL_MS = 2_000
const MAX_BACKOFF_STEPS = 3 // 15s → 30s → 60s → 120s
const JITTER_MS = 3_000
const REQUEST_TIMEOUT_MS = 5_000

/**
 * Polls the player's box summary until the token is rejected or it is stopped, handing every
 * summary to the caller. Only one request is ever in flight; a request counts as live only while it is
 * `this._request`, so cancelled requests neither schedule a retry nor count as failures.
 */
export class BoxPoller {
    /**
     * @param {Object} options
     * @param {string} options.url - Summary endpoint
     * @param {string} options.token - playerConnect bearer token
     * @param {Function} options.isActive - Returns whether the game is active; polling pauses when not
     * @param {Function} options.onSummary - Called with each summary received
     * @param {Function} options.onUnauthorized - Called on 401/403; polling then stops
     */
    constructor({ url, token, isActive, onSummary, onUnauthorized }) {
        this._url = url
        this._token = token
        this._isActive = isActive
        this._onSummary = onSummary
        this._onUnauthorized = onUnauthorized
        this._stopped = false
        this._request = null
        this._timer = null
        this._failures = 0
    }

    start() {
        void this._poll()
    }

    stop() {
        this._stopped = true
        this._cancel()
    }

    /** Call when game activity changes: pauses when inactive, polls immediately when active. */
    refresh() {
        if (this._isActive()) {
            void this._poll()
        } else {
            this._cancel()
        }
    }

    _cancel() {
        clearTimeout(this._timer)
        const pending = this._request
        this._request = null // cleared first so the aborted request's handlers are no-ops
        pending?.abort()
    }

    async _poll() {
        if (this._stopped || this._request || !this._isActive()) {
            return
        }
        clearTimeout(this._timer)
        const request = new AbortController()
        this._request = request
        const timeout = setTimeout(() => request.abort(), REQUEST_TIMEOUT_MS)

        try {
            const response = await fetch(this._url, {
                headers: { Authorization: `Bearer ${this._token}` },
                credentials: "omit",
                cache: "no-store",
                signal: request.signal,
            })
            if (this._request !== request) {
                return
            }
            if (response.status === 401 || response.status === 403) {
                this.stop()
                this._onUnauthorized()
                return
            }
            if (!response.ok) {
                throw new Error(`Box poll failed: ${response.status}`)
            }

            const summary = await response.json()
            if (this._request !== request) {
                return
            }
            this._failures = 0
            this._onSummary(summary)
        } catch {
            // Keep existing box state and retry silently with backoff.
            if (this._request === request) {
                this._failures = Math.min(this._failures + 1, MAX_BACKOFF_STEPS)
            }
        } finally {
            clearTimeout(timeout)
            if (this._request === request) {
                this._request = null
                this._scheduleNext()
            }
        }
    }

    _scheduleNext() {
        // Jitter spreads requests across players.
        const delay = POLL_INTERVAL_MS * 2 ** this._failures + Math.random() * JITTER_MS
        this._timer = setTimeout(() => this._poll(), delay)
    }
}
