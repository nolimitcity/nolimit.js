import { styleElement } from "../utils/styleElement"
import { AssetPreloader, PreloadState } from "./assetPreloader"
import { getAppWrapperDocString, getLaunchButtonDocString } from "./docStrings"
import { GameStateTracker } from "./gameStateTracker"
import { RpcTransport } from "./rpcTransport"

export class FlobbyManager {
    constructor(
        flobbyIframe,
        flobbyConfig,
        gameWindow,
        { operator, game } = {},
    ) {
        this.iframe = flobbyIframe
        this.config = flobbyConfig
        this.gameWindow = gameWindow
        this.isAppMounted = false
        this.isAppVisible = false
        this.doc = null
        this.window = null

        this._iframePos = null // { left, top } — tracked to avoid getBoundingClientRect on every drag
        this._pendingDelta = null // accumulated deltas waiting for rAF
        this._moveRafId = null

        this._preloader = new AssetPreloader(flobbyConfig, () =>
            this._updateButtonState(),
        )

        this._rpc = new RpcTransport(
            (msg) => this._handleJsonRpc(msg),
            (msg) => this._postMessage(msg),
        )

        this._gameState = new GameStateTracker(
            (msg) => this.sendToFlobby(msg),
            () => this.preload(),
            { operator, game },
        )
    }

    get preloadState() {
        return this._preloader.state
    }

    get isFlobbyReady() {
        return this._rpc.isReady
    }

    get gameInfo() {
        return this._gameState.gameInfo
    }

    _postMessage(message) {
        if (this._rpc.port) {
            try {
                this._rpc.port.postMessage(message)
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

    snapshot() {
        const pending = this._gameState._pendingRound
        return {
            isAppMounted: this.isAppMounted,
            isAppVisible: this.isAppVisible,
            isFlobbyReady: this._rpc.isReady,
            preloadState: this._preloader.state,
            hasPort: this._rpc.port !== null,
            queueLength: this._rpc.queueLength,
            rpcId: this._rpc.rpcId,
            currentRoundId: this._gameState._currentRoundId,
            currency: this._gameState._currency,
            lastBalance: this._gameState._lastBalance,
            currentBet: pending?.betAmount ?? null,
            currentWin: pending?.winAmount ?? null,
            roundInProgress: this._gameState._roundInProgress,
            roundsCount: this._gameState._rounds.length,
        }
    }

    resetPreloader() {
        this._preloader.state = PreloadState.IDLE
        this._preloader.script = null
        this._preloader.css = null
    }

    logger() {
        console.table({
            isAppMounted: this.isAppMounted,
            isAppVisible: this.isAppVisible,
            isFlobbyReady: this._rpc.isReady,
            preloadState: this._preloader.state,
            hasPort: this._rpc.port !== null,
            queueLength: this._rpc.queueLength,
            rpcId: this._rpc.rpcId,
        })

        console.table({
            currentRoundId: this._gameState._currentRoundId,
            currency: this._gameState._currency,
            lastBalance: this._gameState._lastBalance,
            roundInProgress: this._gameState._roundInProgress,
        })
        console.table(this._gameState._rounds)
        console.log("this.messageChannel: ", this._rpc.channel)
        console.log("this.messagePort: ", this._rpc.port)
    }

    startLogger(interval = 5000) {
        this._loggerInterval = setInterval(() => this.logger(), interval)
    }

    stopLogger() {
        clearInterval(this._loggerInterval)
    }

    // JSON-RPC dispatch
    _handleJsonRpc(message) {
        // Response to a request we sent
        if ("result" in message || "error" in message) {
            console.log("[Flobby] JSON-RPC response:", message)
            return
        }

        // Request/notification from Flobby
        if (message.method !== "moveApp") {
            console.log("[Flobby] JSON-RPC:", message.method, message.params)
        }

        const handlers = {
            ready: () => {
                this._rpc.markReady()
                for (const msg of this._gameState.getPendingState()) {
                    this._rpc.send(msg)
                }
                this._rpc.flush()
            },
            closeFlobby: () => {
                this.hideApp()
            },
            requestRefresh: () => {
                console.log("[Flobby] Refresh requested")
            },
            version: () => {
                if (message.id != null) {
                    this._rpc.send({
                        jsonrpc: "2.0",
                        result: { version: this.config.version },
                        id: message.id,
                    })
                }
            },
            echo: () => {
                if (message.id != null) {
                    this._rpc.send({
                        jsonrpc: "2.0",
                        result: { message: "Hello from nolimit.js!" },
                        id: message.id,
                    })
                }
            },
            flobbySize: () => {
                console.log("[Flobby] Size update:", message.params)
            },
            logger: () => {
                this.logger()
            },
            startLogger: () => {
                this.startLogger(message.params?.interval)
            },
            stopLogger: () => {
                this.stopLogger()
            },
            moveApp: () => {
                const params = message.params || {}

                // Accumulate deltas — multiple messages between frames get batched
                if (!this._pendingDelta) {
                    this._pendingDelta = { deltaX: 0, deltaY: 0 }
                }
                this._pendingDelta.deltaX += params.deltaX || 0
                this._pendingDelta.deltaY += params.deltaY || 0

                if (this._moveRafId) return // rAF already scheduled

                this._moveRafId = requestAnimationFrame(() => {
                    this._moveRafId = null
                    const delta = this._pendingDelta
                    this._pendingDelta = null
                    if (!delta) return

                    const parent = this.iframe.parentElement
                    if (!parent) return

                    // Lazily initialise tracked position (one-time DOM read)
                    if (!this._iframePos) {
                        const parentRect = parent.getBoundingClientRect()
                        const iframeRect =
                            this.iframe.getBoundingClientRect()
                        this._iframePos = {
                            left: iframeRect.left - parentRect.left,
                            top: iframeRect.top - parentRect.top,
                            parentW: parentRect.width,
                            parentH: parentRect.height,
                            iframeW: iframeRect.width,
                            iframeH: iframeRect.height,
                        }
                    }

                    const pos = this._iframePos
                    pos.left = Math.max(
                        0,
                        Math.min(
                            pos.left + delta.deltaX,
                            pos.parentW - pos.iframeW,
                        ),
                    )
                    pos.top = Math.max(
                        0,
                        Math.min(
                            pos.top + delta.deltaY,
                            pos.parentH - pos.iframeH,
                        ),
                    )

                    styleElement(this.iframe, {
                        right: "",
                        left: `${pos.left}px`,
                        top: `${pos.top}px`,
                    })
                })
            },
            setAppMode: () => {
                // Reset drag state
                this._iframePos = null
                this._pendingDelta = null
                if (this._moveRafId) {
                    cancelAnimationFrame(this._moveRafId)
                    this._moveRafId = null
                }
                const params = message.params || {}
                const closeBtn = this.doc?.getElementById("flobby-close-button")
                const iframeDoc = this.doc
                if (params.mode === "mini") {
                    styleElement(this.iframe, {
                        inset: "",
                        position: "absolute",
                        top: `${params.top}px`,
                        right: `${params.right}px`,
                        left: "",
                        bottom: "",
                        width: `${params.width}px`,
                        height: `${params.height}px`,
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "transparent",
                    })
                    this.iframe.setAttribute("allowtransparency", "true")
                    if (iframeDoc) {
                        iframeDoc.documentElement.style.background =
                            "transparent"
                        iframeDoc.body.style.background = "transparent"
                    }
                    if (closeBtn) {
                        closeBtn.style.display = "none"
                    }
                } else if (params.mode === "full") {
                    styleElement(this.iframe, {
                        inset: "0",
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        top: "0",
                        left: "0",
                        borderRadius: "0",
                        overflow: "visible",
                        background: "",
                    })
                    this.iframe.removeAttribute("allowtransparency")
                    if (iframeDoc) {
                        iframeDoc.documentElement.style.background = ""
                        iframeDoc.body.style.background = ""
                    }
                    if (closeBtn) {
                        closeBtn.style.display = ""
                    }
                }
            },
        }

        handlers[message.method]?.()
    }

    // Public API

    /**
     * Send a "version" request to Flobby.
     * Flobby will respond with its own version.
     */
    sendVersion() {
        const msg = {
            jsonrpc: "2.0",
            method: "version",
            params: { version: this.config.version },
            id: this._rpc.nextId(),
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
            id: this._rpc.nextId(),
        }
        this.sendToFlobby(msg)
        console.log("[Flobby] Sent echo request:", msg)
    }

    sendToFlobby(message) {
        if (!this.isAppVisible) {
            return
        }

        this._rpc.send(message)
    }

    forwardEvent(event, data) {
        this._gameState.forwardEvent(event, data)
    }

    async preload() {
        await this._preloader.preload()
    }

    // UI Flow

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
            inset: "",
            top: "40px",
            left: "8px",
            width: `${Math.ceil(rect.width)}px`,
            height: `${Math.ceil(rect.height)}px`,
            borderRadius: "9999px",
            overflow: "hidden",
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
            launchButton.setAttribute("data-state", this._preloader.state)
        }
    }

    _onLaunchClick() {
        if (this._preloader.state === PreloadState.LOADING) {
            return
        }

        if (this._preloader.state === PreloadState.READY) {
            this.showApp()
            return
        }

        this.preload().then(() => {
            this.showApp()
        })
    }

    /**
     * Shows the full Flobby app (after preload)
     */
    showApp() {
        if (this._preloader.state !== PreloadState.READY) {
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
        this.doc.write(getAppWrapperDocString(this._preloader.css))
        this.doc.close()

        // Add close button handler (outside React, always works)
        const closeButton = this.doc.getElementById("flobby-close-button")
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                this.hideApp()
            })
        }

        // Set up private message channel before loading flobby
        this._rpc.setup()

        // Execute the preloaded script
        const script = this.doc.createElement("script")
        script.textContent = this._preloader.script

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
                    this._rpc.sendPort(this.window)
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
        this._rpc.reset()

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
