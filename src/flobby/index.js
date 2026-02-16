import { getFlobbyConfig } from "./flobbyConfig"
import { createFlobbyIframe } from "./flobbyIframe"
import { FlobbyManager } from "./flobbyManager"

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
        const result = await createFlobbyIframe(gameIframe)
        if (!result) {
            return false
        }

        const { iframe, gameWindow } = result
        const flobbyManager = new FlobbyManager(iframe, config, gameWindow, {
            operator: options.operator,
            game: options.game,
        })
        FlobbyContext.setInstance(flobbyManager)
        flobbyManager.showLauncher()

        console.info("[Flobby] Initialized successfully")
        return true
    } catch (error) {
        console.error("[Flobby] Failed to mount: ", error.message)
        return false
    }
}
