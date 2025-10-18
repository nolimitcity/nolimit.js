import { fetchRetry } from "./utils/fetchRetry"

const FLOBBY_CONFIG_URL = "https://ccsqmvifdmwllajsrihc.supabase.co/storage/v1/object/public/flobby/config/flobby-config-v0.0.1.json"

function styleElement(element, resizeObject) {
    if (!element || !resizeObject) {
        return
    }

    Object.keys(resizeObject).forEach(property => {
        element.style[property] = resizeObject[property]
    })
}


function mountFlobbyApp(flobbyIframe, flobbyConfig) {
    const flobbyIframeDoc = flobbyIframe.contentDocument || flobbyIframe.contentWindow?.document

    if (!flobbyIframeDoc) {
        console.error("Cannot access iframe document")
        return
    }

    const { css: flobbyCss, script: flobbyScript } = flobbyConfig

    if (!flobbyCss || !flobbyScript) {
        return
    }

    flobbyIframeDoc.open()
    flobbyIframeDoc.write(`<!doctype html>
        <html>
            <head>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <link rel="stylesheet" href="${flobbyCss}">
                
                <style>
                    *,*::before,*::after {
                        box-sizing:border-box
                    }
                    html,body {
                        margin:0;
                        width:100%;
                        height:100%;
                        background:transparent !important;
                        color-scheme: light only; /* prevents UA dark backgrounds */
                    }
                    #flobby-root {
                        position:relative;
                        width:100%;
                        height:100%;
                        overflow:visible;
                    }
                    
                    #flobby-close {
                        position: fixed;
                        top: 8px;
                        right: 8px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 36px;
                        height: 36px;
                        border-radius: 9999px;
                        border: 2px solid #111;
                        background: rgba(0,0,0,.2);
                        backdrop-filter: saturate(120%) blur(4px);
                        cursor: pointer;
                        user-select: none;
                        font: 600 16px/1 system-ui;
                        color: #fff;
                        z-index: 2147483647;
                        pointer-events: auto;
                    }
                    
                    #flobby-close:active { 
                        transform: scale(.98) 
                    }
                </style>
                <script>
                    console.log('[Flobby Iframe] Document created, waiting for script load...');
                    window.addEventListener('error', function(e) {
                        console.error('[Flobby Iframe] Script error:', e.error || e.message, e.filename, e.lineno);
                    });
                </script>
            </head>
            <body>
                <div id="flobby-root"></div>
                <button id="flobby-close" title="Close Flobby">✕</button>
            </body>
        </html>`)

    flobbyIframeDoc.close()

    const script = flobbyIframeDoc.createElement("script")
    script.src = flobbyScript
    script.async = false
    script.type = "text/javascript"
    script.crossOrigin = "anonymous"

    script.onload = () => {
        const win = flobbyIframe.contentWindow
        const root = flobbyIframeDoc.getElementById("flobby-root")

        const closeButton = flobbyIframeDoc.getElementById("flobby-close")
        if (closeButton) {
            closeButton.addEventListener("click", () => {
                try {
                    flobbyIframeDoc.open()
                    flobbyIframeDoc.write("")
                    flobbyIframeDoc.close()
                } catch {
                    console.log("[Flobby Iframe error] Close Flobby")
                }

                styleElement(flobbyIframe, {
                    position: "absolute", top: "8px", left: "8px", width: "48px", height: "48px", inset: ""
                })
                createFlobbyLauncher(flobbyIframe, flobbyConfig)
            })
        }

        setTimeout(() => {
            if (win && win.Flobby && typeof win.Flobby.init === "function") {
                try {
                    win.Flobby.init(root)
                } catch (err) {
                    console.error("[Parent] Error initializing Flobby:", err)
                }
            } else {
                fetch(flobbyScript).catch(e => {
                    console.error("[Parent] Could not fetch script:", e)
                })
            }
        }, 100)
    }

    script.onerror = (e) => {
        console.error("[Parent] Failed to load Flobby script:", flobbyScript, e)
    }
    flobbyIframeDoc.body.appendChild(script)
}


/**
 * Creates and writes the HTML document content for the Flobby launcher iframe
 *
 * @param {HTMLIFrameElement} flobbyIframe - The iframe element that will contain the launcher
 * @param {Object} flobbyConfig - Configuration object containing Flobby settings
 * @param {string} flobbyConfig.css - URL to the Flobby CSS file
 * @param {string} flobbyConfig.script - URL to the Flobby JavaScript file
 * @returns {void}
 */
function createFlobbyLauncher(flobbyIframe, flobbyConfig) {
    const flobbyIframeDoc = flobbyIframe.contentDocument || flobbyIframe.contentWindow?.document
    if (!flobbyIframeDoc) {
        return
    }

    flobbyIframeDoc.open()
    flobbyIframeDoc.write(`<!doctype html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <style>
                html,body { 
                    margin:0;
                    pointer-events: auto;
                }
                
                .flobby-launcher {
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    width:48px;
                    height:48px;
                    border-radius:9999px;
                    border:2px solid #111;
                    background:rgba(0,0,0,.2);
                    backdrop-filter:saturate(120%) blur(4px);
                    cursor:pointer;
                    user-select:none;
                    font:600 12px/1 system-ui;
                    color:#fff;
                    pointer-events: auto;
                }
                
                .flobby-launcher:active {
                    transform:scale(.98)
                }

            </style>
        </head>
        <body>
            <button id="flobby-launcher" class="flobby-launcher" title="Open Flobby">▶</button>
        </body>
    </html>`)

    flobbyIframeDoc.close()

    const launcherButton = flobbyIframeDoc.getElementById("flobby-launcher")
    const r = launcherButton.getBoundingClientRect()
    styleElement(flobbyIframe, {
        width: Math.ceil(r.width) + "px",
        height: Math.ceil(r.height) + "px"
    })

    launcherButton.addEventListener("click", () => {
        styleElement(flobbyIframe, {
            position: "absolute", inset: "0", width: "59%", height: "59%", top: "0", left: "0",
        })
        mountFlobbyApp(flobbyIframe, flobbyConfig)
    })
}

/**
 * Mounts a launcher iframe inside a game iFrame to enable Flobby functionality
 *
 * @param {HTMLIFrameElement} gameIframe - The game's iframe element where launcher will be mounted
 * @param {Object} flobbyConfig - Configuration object containing CSS and JS URLs
 * @param {string} flobbyConfig.css - URL to the Flobby CSS file
 * @param {string} flobbyConfig.script - URL to the Flobby JavaScript file
 * @returns {void}
 */
function mountFlobbyInsideGame(gameIframe, flobbyConfig) {
    const gameDoc = gameIframe.contentDocument || gameIframe.contentWindow?.document
    if (!gameDoc) {
        return
    }

    const ensureMount = () => {
        console.count("ensureMount")
        if (!gameDoc.body) {
            return setTimeout(ensureMount, 10)
        }
        if (!gameDoc.body.style.position) {
            gameDoc.body.style.position = "relative"
        }

        // Small launcher iframe
        const flobbyIframe = gameDoc.createElement("iframe")
        flobbyIframe.title = "Flobby Launcher"
        flobbyIframe.setAttribute("frameBorder", "0")
        flobbyIframe.setAttribute("allow", "autoplay")
        flobbyIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms")
        flobbyIframe.style.position = "absolute"
        flobbyIframe.style.top = "8px"
        flobbyIframe.style.left = "8px"
        flobbyIframe.style.width = "0px"
        flobbyIframe.style.height = "0px"
        flobbyIframe.allowTransparency = true
        flobbyIframe.style.background = "transparent"
        flobbyIframe.style.backgroundColor = "blue"
        flobbyIframe.setAttribute("allowTransparency", "true")
        flobbyIframe.style.pointerEvents = "auto"
        flobbyIframe.style.zIndex = "2147483648"

        gameDoc.body.appendChild(flobbyIframe)
        createFlobbyLauncher(flobbyIframe, flobbyConfig)
    }
    ensureMount()
}


async function getFlobbyConfig() {
    try {
        const response = await fetchRetry(FLOBBY_CONFIG_URL)
        if (!response.ok) {
            throw new Error(`Failed to fetch Flobby config. Response status: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error("Error loading Flobby config:", error.message)
        return null
    }
}


export async function initFlobby(gameIframe) {
    const config = await getFlobbyConfig()
    console.log("config: ", config)
    if (!config) {
        return
    }

    if (!config.enabled || config.enabled === false) {
        console.log("Flobby is disabled in config")
        return
    }

    mountFlobbyInsideGame(gameIframe, config)


    console.log("initFlobby 555")
}