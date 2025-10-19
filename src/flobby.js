import { getAppWrapperDocString, getLaunchButtonDocString } from "./flobby-doc-strings"
import { fetchRetry } from "./utils/fetchRetry"
import { styleElement } from "./utils/styleElement"
import { waitForBody } from "./utils/waitForElement"
import json from "./flobby-config.json"


// 1. initFlobby
// 2. getFlobbyConfig
// 3. fetchRetry
// 4. mountFlobbyInsideGame
// 5. waitForBody
// 6. waitForElement
// 7. new FlobbyManager
// 8. FlobbyContext.setInstance(flobbyManager)
// 9. flobbyManager.showLauncher()


const FLOBBY_CONFIG_URL = "https://ccsqmvifdmwllajsrihc.supabase.co/storage/v1/object/public/flobby/config/flobby-config-v0.0.1.json"

const FlobbyContext = {
    instance: null,

    setInstance(manager) {
        this.instance = manager
        // Also expose on window for debugging and external access
        if (typeof window !== "undefined") {
            window.FlobbyManager = manager
        }
    },

    getInstance() {
        return this.instance
    },

    hasInstance() {
        return this.instance !== null
    }
}

class FlobbyManager {
    constructor(flobbyIframe, flobbyConfig) {
        this.iframe = flobbyIframe
        this.config = flobbyConfig
        this.isAppMounted = false
        this.doc = null
        this.window = null
    }

    showLauncher() {
        this.isAppMounted = false
        this.doc = this.iframe.contentDocument || this.iframe.contentWindow?.document
        this.window = this.iframe.contentWindow

        if (!this.doc) {
            return
        }

        this.doc.open()
        this.doc.write(getLaunchButtonDocString())

        this.doc.close()

        // Size iframe to button
        const launchButton = this.doc.getElementById("flobby-launch-button")
        const rect = launchButton.getBoundingClientRect()
        styleElement(this.iframe, {
            position: "absolute",
            top: "8px",
            left: "8px",
            width: Math.ceil(rect.width) + "px",
            height: Math.ceil(rect.height) + "px",
            borderRadius: "9999px",
            overflow: "hidden",
            inset: ""
        })

        // Attach launch handler
        launchButton.addEventListener("click", () => {
            this.mountApp()
        })
    }

    /**
     * Mounts the full Flobby app
     */
    mountApp() {
        this.isAppMounted = true
        this.doc = this.iframe.contentDocument || this.iframe.contentWindow?.document
        this.window = this.iframe.contentWindow

        if (!this.doc) {
            console.error("[Flobby] Cannot access iframe document")
            return
        }

        const { css: flobbyCss, script: flobbyScript } = this.config

        if (!flobbyCss || !flobbyScript) {
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

        this.doc.open()
        this.doc.write(getAppWrapperDocString(flobbyCss))

        this.doc.close()

        // Add close button handler
        const closeButton = this.doc.getElementById("flobby-close-button")
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                this.unmountApp()
            })
        }

        // Load Flobby script
        const script = this.doc.createElement("script")
        script.src = flobbyScript
        script.async = false
        script.type = "text/javascript"
        script.crossOrigin = "anonymous"

        script.onload = () => {
            const win = this.window
            const root = this.doc.getElementById("flobby-root")

            const MAX_ATTEMPTS = 10
            let attempts = 0

            const initFlobby = () => {
                if (win && win.Flobby && typeof win.Flobby.init === "function") {
                    try {
                        win.Flobby.init(root)
                        console.log("[Flobby] Initialized successfully")
                    } catch (err) {
                        console.error("[Flobby] Error initializing:", err)
                    }
                    return
                }

                attempts += 1
                if (attempts >= MAX_ATTEMPTS) {
                    console.error("[Flobby] Timeout: Flobby.init not found after script load")
                    return
                }

                setTimeout(initFlobby, 100)
            }

            initFlobby()
        }

        script.onerror = (e) => {
            console.error("[Flobby] Failed to load Flobby script:", flobbyScript, e)
        }

        this.doc.body.appendChild(script)
    }

    unmountApp() {
        if (!this.isAppMounted) {
            return
        }

        // Clear the iframe content
        if (this.doc) {
            try {
                this.doc.open()
                this.doc.write("")
                this.doc.close()
            } catch (err) {
                console.error("[Flobby] Error clearing document:", err)
            }
        }

        // Return to launcher state
        this.showLauncher()
    }

    /**
     * Gets the iframe window reference
     */
    getWindow() {
        return this.window
    }

    /**
     * Gets the iframe document reference
     */
    getDocument() {
        return this.doc
    }
}

/**
 * Mounts a launcher iframe inside the game iframe
 */
async function mountFlobbyInsideGame(gameIframe, flobbyConfig) {
    const gameDoc = gameIframe.contentDocument || gameIframe.contentWindow?.document
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
    flobbyIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms")
    flobbyIframe.setAttribute("allowTransparency", "true")
    flobbyIframe.allowTransparency = true

    styleElement(flobbyIframe, {
        position: "absolute",
        top: "8px",
        left: "8px",
        width: "0px",
        height: "0px",
        background: "transparent",
        pointerEvents: "auto",
        zIndex: "2147483648"
    })

    body.appendChild(flobbyIframe)

    const flobbyManager = new FlobbyManager(flobbyIframe, flobbyConfig)
    FlobbyContext.setInstance(flobbyManager)
    flobbyManager.showLauncher()
}

/**
 * Fetches Flobby config
 * @returns {Promise<Object|null>} Config object or null if failed
 */
async function getFlobbyConfig() {
    try {
        const response = await fetchRetry(FLOBBY_CONFIG_URL)
        console.log("[FLOBBY_CONFIG_URL]", response)
        if (!response.ok) {
            console.error(`[Flobby] Failed to fetch config. Status: ${response.status}`)
            return null
        }
        return await response.json()
    } catch (error) {
        console.error(`[Flobby] Error loading config:`, error.message)
        return null
    }
}

/**
 * Gets the current Flobby instance from context
 * @returns {FlobbyManager|null}
 */
export function getFlobbyInstance() {
    return FlobbyContext.getInstance()
}

/**
 * Checks if Flobby is currently mounted
 * @returns {boolean}
 */
export function isFlobbyMounted() {
    const instance = FlobbyContext.getInstance()
    return instance ? instance.isAppMounted : false
}

/**
 * Initializes Flobby inside the game iframe
 * @param {HTMLIFrameElement} gameIframe - The game iframe element
 * @returns {Promise<boolean>} True if successfully initialized, false otherwise
 */
export async function initFlobby(gameIframe) {
    if (!gameIframe) {
        console.error("[Flobby] Invalid game iframe")
        return false
    }

    // const config = await getFlobbyConfig()
    const config = json

    if (!config) {
        console.warn("[Flobby] Could not load config, initialization aborted")
        return false
    }

    if (!config.enabled) {
        console.info("[Flobby] Disabled in config")
        return false
    }

    try {
        await mountFlobbyInsideGame(gameIframe, config)
        console.info("[Flobby] Initialized successfully")
        return true
    } catch (error) {
        console.error("[Flobby] Failed to mount: ", error.message)
        return false
    }
}
