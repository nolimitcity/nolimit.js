import { fetchRetry } from "../utils/fetchRetry"

export const PreloadState = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    ERROR: "error",
})

export class AssetPreloader {
    constructor(config, onStateChange) {
        this._config = config
        this._onStateChange = onStateChange
        this.state = PreloadState.IDLE
        this.script = null
        this.css = null
    }

    _setState(state) {
        this.state = state
        this._onStateChange?.(state)
    }

    async preload() {
        if (
            this.state === PreloadState.READY ||
            this.state === PreloadState.LOADING
        ) {
            return
        }

        const { css: cssUrl, script: scriptUrl } = this._config
        if (!scriptUrl) {
            console.error("[Flobby] Missing script URL in config")
            this._setState(PreloadState.ERROR)
            return
        }

        this._setState(PreloadState.LOADING)
        console.log("[Flobby] Preloading assets...")

        try {
            const response = await fetchRetry(scriptUrl)
            if (!response.ok) {
                throw new Error("Failed to fetch a script")
            }
            this.script = await response.text()

            if (cssUrl) {
                const cssResponse = await fetchRetry(cssUrl)
                if (cssResponse.ok) {
                    this.css = await cssResponse.text()
                }
                console.log("[Flobby] Loaded CSS...")
            }

            if (!this.css) {
                this.css = ""
            }

            this._setState(PreloadState.READY)
            console.log("[Flobby] Assets preloaded successfully")
        } catch (error) {
            console.error("[Flobby] Preload failed:", error)
            this._setState(PreloadState.ERROR)
        }
    }
}
