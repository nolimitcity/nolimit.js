import { styleElement } from "../utils/styleElement"
import { AssetPreloader, PreloadState } from "./assetPreloader"
import { getAppWrapperDocString, getLaunchButtonDocString } from "./docStrings"
import { GameStateTracker } from "./gameStateTracker"
import { devLog } from "./log"
import {
    getPlayinGameCenterConfig,
    isTrustedScriptUrl,
} from "./playinGameCenterConfig"
import { createPlayinGameCenterIframe } from "./playinGameCenterIframe"
import { RpcTransport } from "./rpcTransport"

export class PlayinGameCenterManager {
    constructor(gameIframe, options = {}) {
        this.gameIframe = gameIframe
        this.options = options
        this.config = null
        this.appConfig = null
        this.iframe = null
        this.gameWindow = null
        this.isAppMounted = false
        this.isAppVisible = false
        this.doc = null
        this.window = null
        this._loadStarted = false

        this._iframePos = null // { left, top } — tracked to avoid getBoundingClientRect on every drag
        this._pendingDelta = null // accumulated deltas waiting for rAF
        this._moveRafId = null

        // Created once config (and therefore the bundle URL) is known, on game `loaded`.
        this._preloader = null

        this._rpc = new RpcTransport(
            (msg) => this._handleJsonRpc(msg),
            (msg) => this._postMessage(msg),
        )

        this._gameState = new GameStateTracker(
            (msg) => this.sendToPlayinGameCenter(msg),
            () => this._onGameLoaded(),
            {
                operator: options.operator,
                game: options.game,
                device: options.device,
            },
        )
    }

    /**
     * Runs when the game fires its `loaded` event. This is the FIRST point at which anything
     * PlayinGameCenter-related touches the network. Fetch config; if enabled, build the overlay
     * iframe, warm the bundle and show the launcher. Fail-silent throughout: any failure
     * leaves the game untouched and PlayinGameCenter simply absent.
     */
    async _onGameLoaded() {
        if (this._loadStarted) {
            return
        }
        this._loadStarted = true

        try {
            const config = await getPlayinGameCenterConfig(this.options)
            this.config = config

            if (!config || !config.enabled || !config.script) {
                devLog(
                    "[PlayinGameCenter] Disabled or unavailable; staying off",
                )
                return
            }

            // reject any script not on the configured CloudFront origin.
            if (
                !isTrustedScriptUrl(
                    config.script,
                    this.options.playinGameCenterCdn,
                )
            ) {
                devLog(
                    "[PlayinGameCenter] Untrusted script origin; staying off:",
                    config.script,
                )
                return
            }

            // Forward the opaque `app` blob plus the resolved per-feature objects. jinx now emits
            // `features` as a sibling of `app` (each feature: { enabled, ...settings }); the overlay
            // consumes that shape over the `appConfig` RPC.
            this.appConfig = {
                ...(config.app || {}),
                features: config.features || {},
            }

            const result = await createPlayinGameCenterIframe(this.gameIframe)
            if (!result) {
                return
            }
            this.iframe = result.iframe
            this.gameWindow = result.gameWindow

            this._preloader = new AssetPreloader(
                config.script,
                config.integrity,
                () => this._updateButtonState(),
            )

            this.showLauncher()
            // Warm the bundle into the launcher document so the first open is instant.
            this._preloader.warm(this.doc)
        } catch (error) {
            devLog("[PlayinGameCenter] Setup failed; staying off:", error)
        }
    }

    get preloadState() {
        return this._preloader.state
    }

    get isPlayinGameCenterReady() {
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
                console.error(
                    "[PlayinGameCenter] Error posting message via port:",
                    err,
                )
            }
        } else if (this.window) {
            try {
                this.window.postMessage(message, "*")
            } catch (err) {
                console.error("[PlayinGameCenter] Error posting message:", err)
            }
        }
    }

    snapshot() {
        const pending = this._gameState._pendingRound
        return {
            isAppMounted: this.isAppMounted,
            isAppVisible: this.isAppVisible,
            isPlayinGameCenterReady: this._rpc.isReady,
            preloadState: this._preloader?.state,
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
        if (this._preloader) {
            this._preloader.state = PreloadState.IDLE
        }
    }

    logger() {
        console.table({
            isAppMounted: this.isAppMounted,
            isAppVisible: this.isAppVisible,
            isPlayinGameCenterReady: this._rpc.isReady,
            preloadState: this._preloader?.state,
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
        devLog("this.messageChannel: ", this._rpc.channel)
        devLog("this.messagePort: ", this._rpc.port)
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
            devLog("[PlayinGameCenter] JSON-RPC response:", message)
            return
        }

        // Request/notification from PlayinGameCenter
        if (message.method !== "moveApp") {
            devLog(
                "[PlayinGameCenter] JSON-RPC:",
                message.method,
                message.params,
            )
        }

        const handlers = {
            ready: () => {
                this._rpc.markReady()
                // Deliver the opaque app blob first so PlayinGameCenter is themed/configured
                // before the game-state messages replay.
                if (this.appConfig) {
                    this._rpc.send({
                        jsonrpc: "2.0",
                        method: "appConfig",
                        params: this.appConfig,
                    })
                }
                for (const msg of this._gameState.getPendingState()) {
                    this._rpc.send(msg)
                }
                this._rpc.flush()
            },
            closePlayinGameCenter: () => {
                this.hideApp()
            },
            requestRefresh: () => {
                devLog("[PlayinGameCenter] Refresh requested")
            },
            version: () => {
                // D3: the build is the source of truth for the version. The loader
                // no longer asserts one — PlayinGameCenter self-reports from its own build.
                if (message.id != null) {
                    this._rpc.send({
                        jsonrpc: "2.0",
                        result: { version: null },
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
            playinGameCenterSize: () => {
                devLog("[PlayinGameCenter] Size update:", message.params)
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
                        const iframeRect = this.iframe.getBoundingClientRect()
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
                const closeBtn = this.doc?.getElementById(
                    "playin-game-center-close-button",
                )
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
     * Send a "version" request to PlayinGameCenter.
     * PlayinGameCenter will respond with its own version.
     */
    sendVersion() {
        const msg = {
            jsonrpc: "2.0",
            method: "version",
            params: {},
            id: this._rpc.nextId(),
        }
        this.sendToPlayinGameCenter(msg)
        devLog("[PlayinGameCenter] Sent version request:", msg)
    }

    /**
     * Send an "echo" request to PlayinGameCenter.
     * PlayinGameCenter will respond with an echo.
     */
    sendEcho() {
        const msg = {
            jsonrpc: "2.0",
            method: "echo",
            params: { message: "Hello from nolimit.js!" },
            id: this._rpc.nextId(),
        }
        this.sendToPlayinGameCenter(msg)
        devLog("[PlayinGameCenter] Sent echo request:", msg)
    }

    sendToPlayinGameCenter(message) {
        if (!this.isAppVisible) {
            return
        }

        this._rpc.send(message)
    }

    forwardEvent(event, data) {
        this._gameState.forwardEvent(event, data)

        if (event === "idle") {
            this._setIframeVisible(true)
        } else if (event === "external" && data?.name === "bet") {
            this._setIframeVisible(false)
        }
    }

    _setIframeVisible(visible) {
        if (!this.iframe) {
            return
        }
        if (!this.iframe.style.transition) {
            styleElement(this.iframe, {
                transition: "opacity 0.2s ease",
            })
        }
        styleElement(this.iframe, {
            opacity: visible ? "1" : "0",
            pointerEvents: visible ? "auto" : "none",
        })
    }

    async preload() {
        // Warming is automatic on the game's `loaded` event; this remains for the public
        // preloadPlayinGameCenter() hook and is a no-op until config has resolved.
        if (this._preloader && this.doc) {
            this._preloader.warm(this.doc)
        }
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

        const launchButton = this.doc.getElementById(
            "playin-game-center-launch-button",
        )
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
        const launchButton = this.doc?.getElementById(
            "playin-game-center-launch-button",
        )

        if (launchButton) {
            launchButton.setAttribute("data-state", this._preloader.state)
        }
    }

    _onLaunchClick() {
        if (this._preloader?.state === PreloadState.LOADING) {
            return
        }
        this.showApp()
    }

    /**
     * Shows the full PlayinGameCenter app (after preload)
     */
    showApp() {
        if (!this._preloader || !this.config) {
            console.error("[PlayinGameCenter] Cannot show app - not configured")
            return
        }

        this.doc =
            this.iframe.contentDocument || this.iframe.contentWindow?.document

        this.window = this.iframe.contentWindow

        if (!this.doc) {
            console.error("[PlayinGameCenter] Cannot access iframe document")
            return
        }

        // Write the app wrapper into the still-launcher-sized iframe. We do NOT expand
        // to fullscreen yet — a stalled/failed load must never cover the game.
        this.doc.open()
        this.doc.write(getAppWrapperDocString()) // SEC2: no server-controlled CSS
        this.doc.close()

        // Set up private message channel before loading playinGameCenter
        this._rpc.setup()

        const root = this.doc.getElementById("playin-game-center-root")

        // Native <script src>: streaming compile, browser caching, and a clean onload
        // readiness signal (no fetch().text(), no inline injection, no polling, no CORS).
        this._preloader
            .load(this.doc)
            .then(() => {
                const win = this.window
                if (
                    !(
                        win?.PlayinGameCenter &&
                        typeof win.PlayinGameCenter.init === "function"
                    )
                ) {
                    throw new Error(
                        "PlayinGameCenter.init not found after load",
                    )
                }

                // Only now is it safe to take over the screen.
                this.isAppVisible = true
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

                // Add close button handler (outside React, always works)
                const closeButton = this.doc.getElementById(
                    "playin-game-center-close-button",
                )
                closeButton?.addEventListener("click", () => this.hideApp())

                win.PlayinGameCenter.init(root)
                this.isAppMounted = true
                // Send message port to playinGameCenter for private communication
                this._rpc.sendPort(win)
                devLog("[PlayinGameCenter] Initialized successfully")
            })
            .catch((err) => {
                console.warn(
                    "[PlayinGameCenter] Bundle load failed; removing launcher:",
                    err,
                )
                this._rpc.reset()
                this.destroy() // unrecoverable → PlayinGameCenter silently absent
            })
    }

    /**
     * Tears down the overlay iframe so a broken bundle leaves no trace, matching the
     * clean config-failure path. Safe to call multiple times.
     */
    destroy() {
        try {
            this._rpc.reset()
            this.iframe?.parentElement?.removeChild(this.iframe)
        } catch (_) {}
        this.iframe = null
        this.isAppVisible = false
        this.isAppMounted = false
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
