const MAX_RETRIES = 4
const RETRY_DELAY_MS = 250

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export const fetchRetry = async (input, init) => {
    let retryLeft = MAX_RETRIES

    while (retryLeft > 0) {
        try {
            return await fetch(input, init)
        } catch (_err) {
            await sleep(RETRY_DELAY_MS)
        } finally {
            retryLeft -= 1
        }
    }
    throw new Error("[Flobby] Failed to load flobby - max retries")
}
