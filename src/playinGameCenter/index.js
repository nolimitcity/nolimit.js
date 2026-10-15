import { devInfo } from "./log"
import { PlayinGameCenterManager } from "./playinGameCenterManager"
import { withPlayinGameCenterOrigin } from "./playinGameCenterOrigin"

const PlayinGameCenterContext = {
    instance: null,

    setInstance(manager) {
        this.instance = manager
        if (typeof window !== "undefined") {
            window.PlayinGameCenterManager = manager
        }
    },

    getInstance() {
        return this.instance
    },

    hasInstance() {
        return this.instance !== null
    },
}

export function getPlayinGameCenterInstance() {
    return PlayinGameCenterContext.getInstance()
}

export function isPlayinGameCenterMounted() {
    const instance = PlayinGameCenterContext.getInstance()
    return instance ? instance.isAppMounted : false
}

export function preloadPlayinGameCenter() {
    const instance = PlayinGameCenterContext.getInstance()
    if (instance) {
        instance.preload()
    }
}

/**
 * Sets up the PlayinGameCenter overlay for a game. Fully deferred: the manager starts capturing
 * game state immediately, but nothing PlayinGameCenter-related touches the network until the game
 * fires its `loaded` event. The game always takes priority.
 *
 * @param {HTMLIFrameElement} gameIframe - the game iframe element
 * @param {Object} options - resolved loader options (operator, game, device, playinGameCenterEnabled, playinGameCenterCdn, playinGameCenterEnv, "nolimit.js")
 * @param {Function} [callGame] - the game api's `call(method, data)`, for PlayinGameCenter requests the game must act on
 * @returns {boolean} whether PlayinGameCenter was set up (it may still resolve to "off" once config loads)
 */
export function initPlayinGameCenter(gameIframe, options, callGame) {
    if (!gameIframe) {
        console.error("[PlayinGameCenter] Invalid game iframe")
        return false
    }

    if (!options) {
        console.error("[PlayinGameCenter] Init options missing")
        return false
    }

    if (!options.playinGameCenterEnabled) {
        devInfo("[PlayinGameCenter] Disabled")
        return false
    }

    const playinGameCenterManager = new PlayinGameCenterManager(
        gameIframe,
        withPlayinGameCenterOrigin(options),
        callGame,
    )
    PlayinGameCenterContext.setInstance(playinGameCenterManager)

    return true
}
