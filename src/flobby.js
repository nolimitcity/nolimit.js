import localFlobbyConfig from "./flobby-config.json"
import {
    getAppWrapperDocString,
    getLaunchButtonDocString,
} from "./flobbyDocStrings"
import { isDev } from "./utils/constants"
import { fetchRetry } from "./utils/fetchRetry"
import { styleElement } from "./utils/styleElement"
import { waitForBody } from "./utils/waitForElement"

const FLOBBY_CONFIG_URL_TEMPLATE =
    "{FLOBBY_CDN}/storage/v1/object/public/flobby/config/{FLOBBY_VERSION}/{FLOBBY_ENV}/flobby-config-{FLOBBY_VERSION}.json"

const PreloadState = Object.freeze({
    IDLE: "idle",
    LOADING: "loading",
    READY: "ready",
    ERROR: "error",
})

const FlobbyContext = {
    instance: null,

    setInstance(manager) {
        this.instance = manager
        if (typeof window !== "undefined") {
            window.FlobbyManager = manager
        }
    },

    getInstance() {
        return this.instance
    },

    hasInstance() {
        return this.instance !== null
    },
}

export function getFlobbyInstance() {
    return FlobbyContext.getInstance()
}

export function isFlobbyMounted() {
    const instance = FlobbyContext.getInstance()
    return instance ? instance.isAppMounted : false
}

export function preloadFlobby() {
    const instance = FlobbyContext.getInstance()
    if (instance) {
        instance.preload()
    }
}

class FlobbyManager {
    constructor(flobbyIframe, flobbyConfig, gameWindow) {
        this.iframe = flobbyIframe
        this.config = flobbyConfig
        this.gameWindow = gameWindow // The game iframe's window (parent of flobby iframe)
        this.isAppMounted = false
        this.isAppVisible = false
        this.doc = null
        this.window = null
        this.gameInfo = null
        this.messageQueue = []
        this.isFlobbyReady = false

        // Game state tracking for round assembly
        this._currentRoundId = null
        this._currency = null
        this._lastBalance = null
        this._currentBet = 0
        this._lastGameWin = 0
        this._roundInProgress = false
        this._rounds = [] // stored rounds (max 100), replayed on Flobby open

        // MessageChannel for private communication with flobby
        this.messageChannel = null
        this.messagePort = null

        // JSON-RPC id counter
        this._rpcId = 0

        // Preload state
        this.preloadState = PreloadState.IDLE
        this.preloadedScript = null
        this.preloadedCss = null
    }

    logger() {
        console.table({
            isAppMounted: this.isAppMounted,
            isAppVisible: this.isAppVisible,
            isFlobbyReady: this.isFlobbyReady,
            preloadState: this.preloadState,
            hasPort: this.messagePort !== null,
            queueLength: this.messageQueue.length,
            rpcId: this._rpcId,
        })

        console.table({
            currentRoundId: this._currentRoundId,
            currency: this._currency,
            lastBalance: this._lastBalance,
            currentBet: this._currentBet,
            lastGameWin: this._lastGameWin,
            roundInProgress: this._roundInProgress,
        })
        console.table(this._rounds)
        console.log("this.messageChannel: ", this.messageChannel)
        console.log("this.messagePort: ", this.messagePort)
    }

    startLogger(interval = 5000) {
        this._loggerInterval = setInterval(() => this.logger(), interval)
    }
    stopLogger() {
        clearInterval(this._loggerInterval)
    }

    _setupMessageChannel() {
        // Create a private channel so game doesn't see our messages
        this.messageChannel = new MessageChannel()
        this.messagePort = this.messageChannel.port1

        this.messagePort.onmessage = (event) => {
            const data = event.data
            if (!data || data.jsonrpc !== "2.0") {
                return
            }
            this._handleJsonRpc(data)
        }
    }

    _nextRpcId() {
        return ++this._rpcId
    }

    _handleJsonRpc(message) {
        // Response to a request we sent
        if ("result" in message || "error" in message) {
            console.log("[Flobby] JSON-RPC response:", message)
            return
        }

        // Request/notification from Flobby
        console.log("[Flobby] JSON-RPC:", message.method, message.params)

        const handlers = {
            ready: () => {
                this.isFlobbyReady = true
                this._sendPendingState()
                this._flushMessageQueue()
            },
            closeFlobby: () => {
                this.hideApp()
            },
            requestRefresh: () => {
                console.log("[Flobby] Refresh requested")
            },
            version: () => {
                if (message.id != null) {
                    this._postMessage({
                        jsonrpc: "2.0",
                        result: { version: this.config.version },
                        id: message.id,
                    })
                }
            },
            echo: () => {
                if (message.id != null) {
                    this._postMessage({
                        jsonrpc: "2.0",
                        result: { message: "Hello from nolimit.js!" },
                        id: message.id,
                    })
                }
            },
            flobbySize: () => {
                console.log("[Flobby] Size update:", message.params)
            },
        }

        handlers[message.method]?.()
    }

    /**
     * Send a "version" request to Flobby.
     * Flobby will respond with its own version.
     */
    sendVersion() {
        const msg = {
            jsonrpc: "2.0",
            method: "version",
            params: { version: this.config.version },
            id: this._nextRpcId(),
        }
        this.sendToFlobby(msg)
        console.log("[Flobby] Sent version request:", msg)
    }

    /**
     * Send an "echo" request to Flobby.
     * Flobby will respond with an echo.
     */
    sendEcho() {
        const msg = {
            jsonrpc: "2.0",
            method: "echo",
            params: { message: "Hello from nolimit.js!" },
            id: this._nextRpcId(),
        }
        this.sendToFlobby(msg)
        console.log("[Flobby] Sent echo request:", msg)
    }

    _sendPortToFlobby() {
        // Send port2 to flobby iframe so it can communicate back privately
        if (this.window && this.messageChannel) {
            this.window.postMessage({ type: "__FLOBBY_PORT__" }, "*", [
                this.messageChannel.port2,
            ])
        }
    }

    _flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()
            this._postMessage(message)
        }
    }

    _postMessage(message) {
        // Use MessageChannel port if available (private), otherwise fallback to postMessage
        if (this.messagePort) {
            try {
                this.messagePort.postMessage(message)
            } catch (err) {
                console.error("[Flobby] Error posting message via port:", err)
            }
        } else if (this.window) {
            try {
                this.window.postMessage(message, "*")
            } catch (err) {
                console.error("[Flobby] Error posting message:", err)
            }
        }
    }

    sendToFlobby(message) {
        if (!this.isAppVisible) {
            return
        }

        if (this.isFlobbyReady) {
            this._postMessage(message)
        } else {
            this.messageQueue.push(message)
        }
    }

    forwardEvent(event, data) {
        console.log("[Game Event]", event, data)
        const handlers = {
            info: () => {
                this.gameInfo = data
            },
            balance: () => {
                const balance = Number.parseFloat(data)
                if (!Number.isNaN(balance)) {
                    this._lastBalance = balance
                    this.sendToFlobby({
                        jsonrpc: "2.0",
                        method: "balanceUpdate",
                        params: { balance },
                    })
                }
            },
            idle: () => {
                if (!this._roundInProgress) {
                    return
                }
                this._roundInProgress = false
                const bet = this._currentBet
                const win = this._lastGameWin
                const round = {
                    roundId: this._currentRoundId || "unknown",
                    betAmount: bet,
                    winAmount: win,
                    netResult: win - bet,
                    currency: this._currency?.code || "USD",
                    timestamp: Date.now(),
                }
                this._rounds.push(round)
                if (this._rounds.length > 100) {
                    this._rounds = this._rounds.slice(-100)
                }
                // Try real-time delivery (works when Flobby is open)
                this.sendToFlobby({
                    jsonrpc: "2.0",
                    method: "roundEnd",
                    params: round,
                })
            },
            external: () => {
                if (!data?.name) {
                    return
                }

                if (data.name === "loaded") {
                    this.preload()
                    return
                }

                if (data.name === "gameRoundId") {
                    this._currentRoundId = data.data
                    return
                }

                if (data.name === "currency") {
                    this._currency = data.data
                    this.sendToFlobby({
                        jsonrpc: "2.0",
                        method: "currency",
                        params: data.data,
                    })
                    return
                }

                if (data.name === "bet") {
                    this._currentBet = Number.parseFloat(data.data?.bet) || 0
                    this._lastGameWin = 0
                    this._roundInProgress = true
                    return
                }

                if (data.name === "game") {
                    const gameData = data.data || {}
                    this._lastGameWin = gameData.accumulatedRoundWin ?? 0
                }
            },
        }

        handlers[event]?.(data)
    }

    _sendPendingState() {
        if (this.gameInfo) {
            this._postMessage({
                jsonrpc: "2.0",
                method: "gameInfo",
                params: this.gameInfo,
            })
        }
        if (this._lastBalance != null) {
            this._postMessage({
                jsonrpc: "2.0",
                method: "balanceUpdate",
                params: { balance: this._lastBalance },
            })
        }
        if (this._currency) {
            this._postMessage({
                jsonrpc: "2.0",
                method: "currency",
                params: this._currency,
            })
        }
        // Replay all stored rounds
        for (const round of this._rounds) {
            this._postMessage({
                jsonrpc: "2.0",
                method: "roundEnd",
                params: round,
            })
        }
    }

    /**
     * Shows the launcher button
     */
    showLauncher() {
        this.isAppVisible = false
        this.doc =
            this.iframe.contentDocument || this.iframe.contentWindow?.document

        this.window = this.iframe.contentWindow

        if (!this.doc) {
            return
        }

        this.doc.open()
        this.doc.write(getLaunchButtonDocString())
        this.doc.close()

        const launchButton = this.doc.getElementById("flobby-launch-button")
        const rect = launchButton.getBoundingClientRect()

        styleElement(this.iframe, {
            position: "absolute",
            top: "8px",
            left: "8px",
            width: `${Math.ceil(rect.width)}px`,
            height: `${Math.ceil(rect.height)}px`,
            borderRadius: "9999px",
            overflow: "hidden",
            inset: "",
        })

        // Update button state based on preload state
        this._updateButtonState()

        launchButton.addEventListener("click", () => {
            this._onLaunchClick()
        })
    }

    _updateButtonState() {
        const launchButton = this.doc?.getElementById("flobby-launch-button")

        if (launchButton) {
            launchButton.setAttribute("data-state", this.preloadState)
        }
    }

    _onLaunchClick() {
        if (this.preloadState === PreloadState.LOADING) {
            return
        }

        if (this.preloadState === PreloadState.READY) {
            this.showApp()
            return
        }

        this.preload().then(() => {
            this.showApp()
        })
    }

    /**
     * Preloads flobby assets (JS, and optionally CSS) in the background
     * Call this after the game is ready
     */
    async preload() {
        if (
            this.preloadState === PreloadState.READY ||
            this.preloadState === PreloadState.LOADING
        ) {
            return
        }

        const { css: flobbyCss, script: flobbyScript } = this.config
        if (!flobbyScript) {
            console.error("[Flobby] Missing script URL in config")
            this.preloadState = PreloadState.ERROR
            return
        }

        this.preloadState = PreloadState.LOADING
        this._updateButtonState()
        console.log("[Flobby] Preloading assets...")

        try {
            // Fetch JS (and optionally CSS)
            const response = await fetchRetry(flobbyScript)
            if (!response.ok) {
                throw new Error("Failed to fetch a script")
            }
            this.preloadedScript = await response.text()

            // CSS is optional (may be inlined in JS)
            if (flobbyCss) {
                const cssResponse = await fetchRetry(flobbyCss)
                if (cssResponse.ok) {
                    this.preloadedCss = await cssResponse.text()
                }
                console.log("[Flobby] Loaded CSS...")
            }

            if (!this.preloadedCss) {
                this.preloadedCss = ""
            }

            this.preloadState = PreloadState.READY
            this._updateButtonState()
            console.log("[Flobby] Assets preloaded successfully")
        } catch (error) {
            console.error("[Flobby] Preload failed:", error)
            this.preloadState = PreloadState.ERROR
            this._updateButtonState()
        }
    }

    /**
     * Shows the full Flobby app (after preload)
     */
    showApp() {
        if (this.preloadState !== PreloadState.READY) {
            console.error("[Flobby] Cannot show app - not ready")
            return
        }

        this.isAppVisible = true
        this.doc =
            this.iframe.contentDocument || this.iframe.contentWindow?.document

        this.window = this.iframe.contentWindow

        if (!this.doc) {
            console.error("[Flobby] Cannot access iframe document")
            return
        }

        // Expand iframe to full size
        styleElement(this.iframe, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            top: "0",
            left: "0",
            borderRadius: "0",
            overflow: "visible",
        })

        // Write the app wrapper with inline CSS
        this.doc.open()
        this.doc.write(getAppWrapperDocString(this.preloadedCss))
        this.doc.close()

        // Add close button handler (outside React, always works)
        const closeButton = this.doc.getElementById("flobby-close-button")
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                this.hideApp()
            })
        }

        // Set up private message channel before loading flobby
        this._setupMessageChannel()

        // Execute the preloaded script
        const script = this.doc.createElement("script")
        script.textContent = this.preloadedScript

        script.onerror = (e) => {
            console.error("[Flobby] Failed to execute script:", e)
        }

        this.doc.body.appendChild(script)

        // Initialize Flobby
        const window = this.window
        const root = this.doc.getElementById("flobby-root")

        const MAX_ATTEMPTS = 10
        let attempts = 0

        const initFlobby = () => {
            if (window?.Flobby && typeof window.Flobby.init === "function") {
                try {
                    window.Flobby.init(root)
                    this.isAppMounted = true
                    // Send message port to flobby for private communication
                    this._sendPortToFlobby()
                    console.log("[Flobby] Initialized successfully")
                } catch (err) {
                    console.error("[Flobby] Error initializing:", err)
                }
                return
            }

            attempts += 1
            if (attempts >= MAX_ATTEMPTS) {
                console.error("[Flobby] Timeout: Flobby.init not found")
                return
            }

            // TODO-hevar: cleanup this setTimeout?
            setTimeout(initFlobby, 50)
        }

        initFlobby()
    }

    /**
     * Hides the app and returns to launcher
     */
    hideApp() {
        if (!this.isAppVisible) {
            return
        }

        this.isAppVisible = false
        this.isFlobbyReady = false

        // Return to launcher state
        this.showLauncher()
    }

    getWindow() {
        return this.window
    }

    getDocument() {
        return this.doc
    }
}

async function mountFlobbyInsideGame(gameIframe, flobbyConfig) {
    const gameDoc =
        gameIframe.contentDocument || gameIframe.contentWindow?.document

    if (!gameDoc) {
        console.error("[Flobby] Cannot access game iframe document")
        return
    }

    const body = await waitForBody(gameDoc, 5000)

    if (!body) {
        console.error("[Flobby] Timeout waiting for game body to load")
        return
    }

    if (!body.style.position) {
        body.style.position = "relative"
    }

    const flobbyIframe = gameDoc.createElement("iframe")
    flobbyIframe.title = "Flobby"
    flobbyIframe.setAttribute("frameBorder", "0")
    flobbyIframe.setAttribute("allow", "autoplay")
    flobbyIframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms",
    )
    flobbyIframe.setAttribute("allowTransparency", "true")
    flobbyIframe.allowTransparency = true

    styleElement(flobbyIframe, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "0px",
        height: "0px",
        background: "transparent",
        pointerEvents: "auto",
        zIndex: "2147483648",
    })

    body.appendChild(flobbyIframe)

    const gameWindow = gameIframe.contentWindow
    const flobbyManager = new FlobbyManager(
        flobbyIframe,
        flobbyConfig,
        gameWindow,
    )

    FlobbyContext.setInstance(flobbyManager)

    return flobbyManager
}

/**
 * Constructs the Flobby configuration URL by replacing template placeholders
 * with values from the provided options
 *
 * @param {Object} options - Configuration options
 * @param {string} options.flobbyCdn - The CDN base URL
 * @param {string} options.flobbyVersion - The Flobby version
 * @param {string} options.flobbyEnv - The environment (e.g., 'prod', 'dev')
 * @returns {string} The constructed configuration URL
 */
function getFlobbyConfigUrl(options) {
    return FLOBBY_CONFIG_URL_TEMPLATE.replaceAll(
        "{FLOBBY_CDN}",
        options.flobbyCdn,
    )
        .replaceAll("{FLOBBY_VERSION}", options.flobbyVersion)
        .replaceAll("{FLOBBY_ENV}", options.flobbyEnv)
}

/**
 * Fetches Flobby config
 * On localhost, uses local JSON config
 * On production, fetches from remote CDN
 * @returns {Promise<Object|null>} Config object or null if failed
 */
async function getFlobbyConfig(options) {
    if (isDev) {
        console.log("[Flobby] Using local config (dev mode)")
        return localFlobbyConfig
    }

    const flobbyConfigUrl = getFlobbyConfigUrl(options)

    try {
        const response = await fetchRetry(flobbyConfigUrl)
        console.log("[Flobby] Fetched config from:", flobbyConfigUrl)
        if (!response.ok) {
            console.error(
                "[Flobby] Failed to fetch config. Status:",
                response.status,
            )
            return null
        }
        return await response.json()
    } catch (error) {
        console.error("[Flobby] Error loading config:", error.message)
        return null
    }
}

export async function initFlobby(gameIframe, options) {
    if (!gameIframe) {
        console.error("[Flobby] Invalid game iframe")
        return false
    }

    if (!options) {
        console.error("[Flobby] Init options missing")
        return false
    }

    const { flobbyEnabled } = options

    if (!flobbyEnabled) {
        console.info("[Flobby] Disabled")
        return false
    }

    const config = await getFlobbyConfig(options)

    if (!config) {
        console.warn("[Flobby] Could not load config, initialization aborted")
        return false
    }

    try {
        const flobbyManager = await mountFlobbyInsideGame(gameIframe, config)
        flobbyManager.showLauncher()

        console.info("[Flobby] Initialized successfully")
        return true
    } catch (error) {
        console.error("[Flobby] Failed to mount: ", error.message)
        return false
    }
}
