import { devLog } from "./log"

const CONFIG_PATH = "/api/v1/playin-game-center/config"
const FETCH_TIMEOUT_MS = 2500
// Freshness is server-controlled via the response `maxAge` (seconds). This constant is only the
// floor used when a cached config predates that field or omits it; it matches the edge TTL.
const DEFAULT_FRESHNESS_SECONDS = 60

// Absolute worst case: silently off. The loader carries this bundled default so a
// failed config (and a stale/absent cache) can never produce a broken overlay - only
// "no overlay". Safe because the contract is additive-only.
const BUNDLED_DEFAULT = Object.freeze({ enabled: false })

function getConfigUrl(options) {
    const base = (options.playinGameCenterCdn || "").replace(/\/+$/, "")
    const params = new URLSearchParams({
        operator: options.operator || "",
        pgcEnv: options.playinGameCenterEnv || "prod",
        platformEnv: options.playinGameCenterPlatformEnv || "production",
    })
    if (options.game) {
        params.set("game", options.game)
    }

    if (options.jurisdiction?.name) {
        params.set("jurisdiction", options.jurisdiction.name)
    }
    if (options.language) {
        params.set("language", options.language)
    }
    const njs = options["nolimit.js"]
    if (njs) {
        params.set("njs", njs)
    }
    return `${base}${CONFIG_PATH}?${params.toString()}`
}

function cacheKey(options) {
    return [
        "playinGameCenter.config",
        options.operator || "?",
        options.game || "?",
        options.playinGameCenterEnv || "prod",
        options.playinGameCenterPlatformEnv || "production",
        options.jurisdiction?.name || "?",
        options.language || "?",
    ].join(".")
}

function readCache(options) {
    try {
        const raw = localStorage.getItem(cacheKey(options))
        if (!raw) {
            return null
        }
        const { config, ts } = JSON.parse(raw)
        if (!config || typeof ts !== "number") {
            return null
        }

        const maxAgeSeconds =
            typeof config.maxAge === "number"
                ? config.maxAge
                : DEFAULT_FRESHNESS_SECONDS
        if (Date.now() - ts > maxAgeSeconds * 1000) {
            return null
        }
        return config
    } catch (_) {
        return null
    }
}

function writeCache(options, config) {
    try {
        localStorage.setItem(
            cacheKey(options),
            JSON.stringify({ config, ts: Date.now() }),
        )
    } catch (_) {}
}

/**
 * Resolves the PlayinGameCenter config, fail-silent. Never throws into the game.
 *
 * Fallback chain: live API → last-good config from localStorage (within a freshness
 * window) → a bundled { enabled: false } default. A successful response overwrites the
 * cache; the cache is only consulted on failure. This is safe because bundle
 * URLs are immutable and versioned, so a cached `script` URL is always still valid.
 *
 * @param {Object} options - resolved loader options (operator, game, playinGameCenterCdn, playinGameCenterEnv, playinGameCenterPlatformEnv, jurisdiction, language, "nolimit.js")
 * @returns {Promise<Object>} resolved config object (always an object, possibly { enabled: false })
 */
export async function getPlayinGameCenterConfig(options) {
    const url = getConfigUrl(options)
    const hasAbort = typeof AbortController !== "undefined"
    const controller = hasAbort ? new AbortController() : null
    const timeout = controller
        ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        : null

    try {
        const response = await fetch(url, {
            signal: controller?.signal,
            credentials: "omit",
        })
        if (!response.ok) {
            throw new Error(`status ${response.status}`)
        }
        const config = await response.json()
        writeCache(options, config)
        devLog("[PlayinGameCenter] Config loaded from API:", url)
        return config
    } catch (error) {
        devLog(
            "[PlayinGameCenter] Config fetch failed, falling back:",
            error?.message || error,
        )
        return readCache(options) || BUNDLED_DEFAULT
    } finally {
        if (timeout) {
            clearTimeout(timeout)
        }
    }
}

/**
 * The bundle URL is server-controlled per operator and executes with same-origin
 * authority inside the game document, so it must be pinned to the configured
 * CloudFront origin over https before we ever inject it.
 *
 * @param {string} scriptUrl - the bundle URL from the resolved config
 * @param {string} cdnBase - the configured CloudFront base (options.playinGameCenterCdn)
 * @returns {boolean}
 */
export function isTrustedScriptUrl(scriptUrl, cdnBase) {
    try {
        const script = new URL(scriptUrl)
        const base = new URL(cdnBase)
        if (script.origin !== base.origin) {
            return false
        }
        if (script.protocol === "https:") {
            return true
        }
        // Dev only: http is fine on loopback (a potentially-trustworthy origin).
        const loopback = new Set(["localhost", "127.0.0.1", "[::1]"])
        return script.protocol === "http:" && loopback.has(script.hostname)
    } catch (_) {
        return false
    }
}
