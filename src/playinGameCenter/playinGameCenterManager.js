import { styleElement } from "../utils/styleElement"
import { AssetPreloader, PreloadState } from "./assetPreloader"
import { BoxPoller } from "./boxPoller"
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
        this.hasNotification = false
        this._boxPoller = null
        this._latestBoxId = null // kept across pollers so reopening the launcher does not replay the spin
        this._acknowledgedBoxId = null // latest box when the player last opened the app, maybe save in LocalStorage?
        this._isGameActive = true
        this._playerConnect = null
        this._destroyed = false

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
            if (this._destroyed) {
                return
            }
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
            if (this._destroyed) {
                result?.iframe.remove()
                return
            }
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
            this.startBoxPolling()

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
        if (this._destroyed) {
            return
        }
        if (event === "external" && data?.name === "hidden") {
            // The game reports focus as true, despite the event's name.
            if (typeof data.data === "boolean" && data.data !== this._isGameActive) {
                devLog("[PlayinGameCenter] hidden event:", data.data, data.data ? "resuming polling" : "pausing polling")
                this._isGameActive = data.data
                this._boxPoller?.refresh()
            }
        }
        if (event === "external" && data?.name === "playerConnect") {
            const token = typeof data.data === "string" && data.data.trim() ? data.data : null
            if (token !== this._playerConnect) {
                this._playerConnect = token
                this.startBoxPolling()
            }
            return
        }
        this._gameState.forwardEvent(event, data)
        // Testing to not spin on every event
        // if (
        //     event === "external" &&
        //     data?.name === "state" &&
        //     data.data === "starting"
        // ) {
        //     this.spinLauncher()
        // }
    }

    spinLauncher() {
        const reel = this.doc?.getElementById("playin-game-center-reel")
        const button = this.doc?.getElementById("playin-game-center-launch-button")
        if (!reel || this.isAppVisible || button?.dataset.state === "loading") {
            return
        }

        const logo = reel.querySelector("svg")
        if (!logo) {
            return
        }
        const iconCount = 4
        const fragment = this.doc.createDocumentFragment()
        for (let index = 0; index < iconCount * 3; index++) {
            const item = this.doc.createElement("span")
            item.className = "playin-game-center-reel-item"
            item.appendChild(logo.cloneNode(true))
            fragment.appendChild(item)
        }
        // Restart cleanly even if another win arrives during the spin.
        for (const animation of reel.getAnimations()) {
            animation.cancel()
        }
        reel.replaceChildren(fragment)
        const itemHeight = reel.firstElementChild.getBoundingClientRect().height
        const start = iconCount * 2 * itemHeight
        const stop = Math.floor(Math.random() * iconCount) * itemHeight
        reel.style.transform = "translateY(-" + stop + "px)"
        if (this.window?.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return
        }
        return reel.animate(
            [
                { transform: "translateY(-" + start + "px)" },
                { transform: "translateY(-" + stop + "px)" },
            ],
            { duration: 1500, easing: "ease-in-out" },
        )
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


    startBoxPolling() {
        this._boxPoller?.stop()
        this._boxPoller = null
        if (this._destroyed || !this.iframe || !this.config?.enabled || !this._playerConnect) {
            return
        }
        const base = (this.options.playinGameCenterCdn || "").replace(/\/+$/, "")
        this._boxPoller = new BoxPoller({
            url: `${base}/api/v1/pgc/player/summary`,
            token: this._playerConnect,
            isActive: () => this._isGameActive,
            onSummary: (summary) => this._onBoxSummary(summary),
            onUnauthorized: () =>
                devLog("[PlayinGameCenter] Box polling paused until a new playerConnect token arrives"),
        })
        this._boxPoller.start()
    }


    /**
     * Updates the launcher from a box summary. The notification dot shows while the player has
     * boxes they have not looked at yet (notSeen > 0), unless they have opened the app since the
     * latest one arrived. The launcher spins once when a box arrives that was not there on the
     * previous poll, i.e. latestBoxId changed, and the dot appears after the spin finishes.
     */
    _onBoxSummary(summary) {
        if (typeof summary?.notSeen !== "number") {
            return
        }
        const latest = summary.latestBoxId ?? null
        const isNewBox = latest !== null && latest !== this._latestBoxId && summary.notSeen > 0
        const isAcknowledged = latest !== null && latest === this._acknowledgedBoxId
        this._latestBoxId = latest
        const showDot = summary.notSeen > 0 && !isAcknowledged
        if (!isNewBox) {
            this.setNotification(showDot)
            return
        }
        devLog("[PlayinGameCenter] New box:", summary)
        const spin = this.spinLauncher()
        if (!spin) {
            this.setNotification(showDot)
            return
        }
        // Show the dot once the spin lands. A cancelled spin means a newer one took over.
        spin.finished.then(
            () => {
                if (!this._destroyed && this._acknowledgedBoxId !== latest) {
                    this.setNotification(showDot)
                }
            },
            () => {},
        )
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
        // Keep the button in place while reserving transparent room for its badge.
        const padding = Number.parseFloat(this.window.getComputedStyle(this.doc.body).paddingTop) || 0

        styleElement(this.iframe, {
            position: "absolute",
            inset: "",
            top: `${40 - padding}px`,
            left: `${8 - padding}px`,
            width: `${Math.ceil(rect.width + padding * 2)}px`,
            height: `${Math.ceil(rect.height + padding * 2)}px`,
            borderRadius: "0",
            overflow: "hidden",
        })

        // Restore notification state when returning from the overlay.
        this.setNotification(this.hasNotification)

        // Update button state based on preload state
        this._updateButtonState()

        launchButton.addEventListener("click", () => {
            this._onLaunchClick()
        })
    }

    // Can be called before the launcher exists or while the overlay is open.
    setNotification(visible) {
        const wasVisible = this.hasNotification
        this.hasNotification = Boolean(visible)
        const button = this.doc?.getElementById("playin-game-center-launch-button")
        if (!button) {
            return
        }

        button.dataset.notification = String(this.hasNotification)
        const label = this.hasNotification
            ? "Open Playin Game Center — new notifications"
            : "Open Playin Game Center"
        button.setAttribute("aria-label", label)
        button.title = label

        if (this.hasNotification && !wasVisible) {
            this.animateNotificationPop()
        } else if (!this.hasNotification) {
            const dot = button.querySelector(".playin-game-center-notification")
            for (const animation of dot?.getAnimations() || []) animation.cancel()
        }
    }

    animateNotificationPop() {
        const dot = this.doc?.querySelector(".playin-game-center-notification")
        if (!dot || !this.hasNotification || this.isAppVisible) {
            return
        }

        for (const animation of dot.getAnimations()) animation.cancel()
        if (this.window?.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return
        }

        dot.animate([
            { transform: "translate(-25%, -25%) scale(0.25)", opacity: 0, offset: 0 },
            { transform: "translate(-25%, -25%) scale(1.25)", opacity: 1, offset: 0.55 },
            { transform: "translate(-25%, -25%) scale(0.92)", opacity: 1, offset: 0.8 },
            { transform: "translate(-25%, -25%) scale(1)", opacity: 1, offset: 1 },
        ], { id: "notification-pop", duration: 450, easing: "ease-out" })
    }

    toggleNotification() {
        this.setNotification(!this.hasNotification)
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
                // Opening the app counts as seeing the current boxes, so the dot stays
                // hidden after closing until a newer box arrives.
                this._acknowledgedBoxId = this._latestBoxId
                this.setNotification(false)
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
        this._destroyed = true
        this._playerConnect = null
        this._boxPoller?.stop()
        this._boxPoller = null

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
        this.startBoxPolling()
    }

    getWindow() {
        return this.window
    }

    getDocument() {
        return this.doc
    }
}
