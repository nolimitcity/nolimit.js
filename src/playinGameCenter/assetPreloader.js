import { devLog } from "./log"

export const PreloadState = Object.freeze({
    IDLE: "idle",
    WARMING: "warming",
    LOADING: "loading",
    READY: "ready",
    ERROR: "error",
})

/**
 * Loads the PlayinGameCenter bundle with native browser primitives:
 *  - warm(doc): a <link rel="preload" as="script"> on the game's `loaded` event, so the
 *               bundle is cached before first open without competing with game boot.
 *  - load(doc): a <script src> whose `onload` is the readiness signal that triggers init.
 *
 * No fetch().text(), no inline-script injection, and no polling. Plain cross-origin
 * scripts execute without CORS, and a no-cors preload is reused by the no-cors script.
 */
export class AssetPreloader {
    constructor(scriptUrl, integrity, onStateChange) {
        this._url = scriptUrl
        this._integrity = integrity || null
        this._onStateChange = onStateChange
        this.state = PreloadState.IDLE
    }

    _setState(state) {
        this.state = state
        this._onStateChange?.(state)
    }

    /**
     * Warm the bundle into the browser cache via <link rel="preload">.
     * @param {Document} doc - the document whose cache partition the bundle will load in
     */
    warm(doc) {
        if (!this._url || !doc || this.state !== PreloadState.IDLE) {
            return
        }
        try {
            const link = doc.createElement("link")
            link.rel = "preload"
            link.as = "script"
            link.href = this._url
            // SRI requires CORS; matching crossorigin on the <link> keeps the warm reusable.
            if (this._integrity) {
                link.integrity = this._integrity
                link.crossOrigin = "anonymous"
            }
            doc.head.appendChild(link)
            this._setState(PreloadState.WARMING)
            devLog("[PlayinGameCenter] Warming bundle:", this._url)
        } catch (error) {
            console.warn("[PlayinGameCenter] Preload warm failed:", error)
        }
    }

    /**
     * Inject <script src> into the document and resolve once it has executed.
     * Rejects if the script errors or fails to load within `timeoutMs`.
     * @param {Document} doc
     * @param {{ timeoutMs?: number }} [opts]
     * @returns {Promise<void>}
     */
    load(doc, { timeoutMs = 10000 } = {}) {
        // A fresh <script> each open: re-executing the bundle resets its module scope so
        // a re-opened overlay mounts again. The warmed HTTP cache keeps this near-instant.
        this._setState(PreloadState.LOADING)
        return new Promise((resolve, reject) => {
            let settled = false
            const finish = (ok, payload) => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                this._setState(ok ? PreloadState.READY : PreloadState.ERROR)
                if (ok) {
                    resolve()
                } else {
                    reject(payload)
                }
            }
            const timer = setTimeout(
                () => finish(false, new Error("bundle load timeout")),
                timeoutMs,
            )

            const script = doc.createElement("script")
            script.src = this._url
            if (this._integrity) {
                script.integrity = this._integrity
                script.crossOrigin = "anonymous"
            }
            script.onload = () => finish(true)
            script.onerror = (event) => finish(false, event)
            doc.body.appendChild(script)
        })
    }
}
