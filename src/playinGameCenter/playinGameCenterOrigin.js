// Each NLC platform has its own ashe deployment, because ashe awards boxes from that platform's rounds.
const ORIGINS = {
    test: "https://test.pgc.evorng.com",
    production: "https://pgc.evorng.com",
}

/**
 * Fills in the platform and the origin serving its PlayinGameCenter config and bundles, unless the
 * integration set them. A game on the test environment runs on the test platform.
 *
 * @param {Object} options - merged loader options
 * @returns {Object} the options with playinGameCenterPlatformEnv and playinGameCenterCdn set
 */
export function withPlayinGameCenterOrigin(options) {
    const platformEnv =
        options.playinGameCenterPlatformEnv ||
        (options.environment === "test" ? "test" : "production")
    return {
        ...options,
        playinGameCenterPlatformEnv: platformEnv,
        playinGameCenterCdn:
            options.playinGameCenterCdn ||
            ORIGINS[platformEnv] ||
            ORIGINS.production,
    }
}
