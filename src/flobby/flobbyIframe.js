import { styleElement } from "../utils/styleElement"
import { waitForBody } from "../utils/waitForElement"

/**
 * Creates a nested Flobby iframe inside the game iframes body.
 *
 * @param {HTMLIFrameElement} gameIframe - The game iframe element
 * @returns {Promise<{iframe: HTMLIFrameElement, gameWindow: Window}|null>}
 */
export async function createFlobbyIframe(gameIframe) {
    const gameDoc =
        gameIframe.contentDocument || gameIframe.contentWindow?.document

    if (!gameDoc) {
        console.error("[Flobby] Cannot access game iframe document")
        return null
    }

    const body = await waitForBody(gameDoc, 5000)

    if (!body) {
        console.error("[Flobby] Timeout waiting for game body to load")
        return null
    }

    if (!body.style.position) {
        body.style.position = "relative"
    }

    const flobbyIframe = gameDoc.createElement("iframe")
    flobbyIframe.title = "Flobby"
    flobbyIframe.setAttribute("frameBorder", "0")
    flobbyIframe.setAttribute("allow", "autoplay")
    flobbyIframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
    )
    flobbyIframe.setAttribute("allowTransparency", "true")
    flobbyIframe.allowTransparency = true

    styleElement(flobbyIframe, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "0px",
        height: "0px",
        background: "transparent",
        pointerEvents: "auto",
        zIndex: "2147483648",
    })

    body.appendChild(flobbyIframe)

    return { iframe: flobbyIframe, gameWindow: gameIframe.contentWindow }
}
