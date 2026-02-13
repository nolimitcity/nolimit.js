import localFlobbyConfig from "../flobby-config.json"
import { isDev } from "../utils/constants"
import { fetchRetry } from "../utils/fetchRetry"

const FLOBBY_CONFIG_URL_TEMPLATE =
    "{FLOBBY_CDN}/storage/v1/object/public/flobby/{FLOBBY_ENV}/config/{FLOBBY_VERSION}/flobby-config-{FLOBBY_VERSION}.json"

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
export function getFlobbyConfigUrl(options) {
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
export async function getFlobbyConfig(options) {
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
