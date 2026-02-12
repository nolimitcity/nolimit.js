/**
 * Waits for an element to appear in the DOM
 * @param {string|function} selector - CSS selector or function that returns element/boolean
 * @param {Document} [doc=document] - Document to search in (useful for iframes)
 * @param {number} [timeout=5000] - Timeout in milliseconds (0 = no timeout)
 * @returns {Promise<Element|null>} Resolves with element or null if timeout
 */
export function waitForElement(selector, doc = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const isFunction = typeof selector === "function"

        // Check if element already exists
        const existing = isFunction ? selector() : doc.querySelector(selector)
        if (existing) {
            return resolve(existing)
        }

        // If no root element to observe, reject immediately
        if (!doc.body && !doc.documentElement) {
            return reject(new Error("[Flobby] Document has no body or documentElement"))
        }

        let timeoutId = null
        const observer = new MutationObserver(() => {
            const element = isFunction ? selector() : doc.querySelector(selector)

            if (element) {
                observer.disconnect()
                if (timeoutId) {
                    clearTimeout(timeoutId)
                }
                resolve(element)
            }
        })

        observer.observe(doc.documentElement || doc.body, {
            childList: true,
            subtree: true
        })

        // Set timeout if specified
        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                observer.disconnect()
                resolve(null)
            }, timeout)
        }
    })
}

/**
 * Waits for document body to be ready
 * @param {Document} [doc=document] - Document to check
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<HTMLBodyElement|null>}
 */
export function waitForBody(doc = document, timeout = 5000) {
    return waitForElement(() => doc.body, doc, timeout)
}