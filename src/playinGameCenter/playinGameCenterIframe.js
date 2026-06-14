import { styleElement } from "../utils/styleElement"
import { waitForBody } from "../utils/waitForElement"

/**
 * Creates a nested PlayinGameCenter iframe inside the game iframes body.
 *
 * @param {HTMLIFrameElement} gameIframe - The game iframe element
 * @returns {Promise<{iframe: HTMLIFrameElement, gameWindow: Window}|null>}
 */
export async function createPlayinGameCenterIframe(gameIframe) {
    const gameDoc =
        gameIframe.contentDocument || gameIframe.contentWindow?.document

    if (!gameDoc) {
        console.error("[PlayinGameCenter] Cannot access game iframe document")
        return null
    }

    const body = await waitForBody(gameDoc, 5000)

    if (!body) {
        console.error(
            "[PlayinGameCenter] Timeout waiting for game body to load",
        )
        return null
    }

    if (!body.style.position) {
        body.style.position = "relative"
    }

    const playinGameCenterIframe = gameDoc.createElement("iframe")
    playinGameCenterIframe.title = "Playin Game Center"
    playinGameCenterIframe.setAttribute("frameBorder", "0")
    playinGameCenterIframe.setAttribute("allow", "autoplay")
    playinGameCenterIframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
    )
    playinGameCenterIframe.setAttribute("allowTransparency", "true")
    playinGameCenterIframe.allowTransparency = true

    styleElement(playinGameCenterIframe, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "0px",
        height: "0px",
        background: "transparent",
        pointerEvents: "auto",
        zIndex: "2147483648",
    })

    body.appendChild(playinGameCenterIframe)

    return {
        iframe: playinGameCenterIframe,
        gameWindow: gameIframe.contentWindow,
    }
}
