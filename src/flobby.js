// 1. Load the flobby config file
// 2. load in the flobby (css, js etc)
// 3. Create the flobby launch button
// 4. Add flobby iframe

import { fetchRetry } from "./utils/fetchRetry"

const FLOBBY_CONFIG_URL = "https://ccsqmvifdmwllajsrihc.supabase.co/storage/v1/object/public/flobby/config/flobby-config-v0.0.1.json"


function expandToFull(frameEl) {
    frameEl.style.position = "absolute"
    frameEl.style.inset = "0"
    frameEl.style.width = "100%"
    frameEl.style.height = "100%"
    frameEl.style.top = "0"
    frameEl.style.left = "0"
}


function bootFlobbyInExistingFrame(frameEl, cssUrl, jsUrl) {
    const doc = frameEl.contentDocument || frameEl.contentWindow?.document
    if (!doc) {
        console.error("Cannot access iframe document")
        return
    }

    // Replace launcher document with full flobby root
    doc.open()
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="${cssUrl}">
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{
    margin:0;
    width:100%;
    height:100%;
    background:transparent !important;
    color-scheme: light only; /* prevents UA dark backgrounds */
  }
  #flobby-root{
    position:relative;
    width:100%;
    height:100%;
    overflow:visible;
  }
</style>
<script>
  // Debug: Log when any script executes in this iframe
  console.log('[Flobby Iframe] Document created, waiting for script load...');
  window.addEventListener('error', function(e) {
    console.error('[Flobby Iframe] Script error:', e.error || e.message, e.filename, e.lineno);
  });
</script>
</head>
<body>
  <div id="flobby-root"></div>
</body>
</html>`)
    doc.close()

    const script = doc.createElement("script")
    script.src = jsUrl
    script.async = false // Make it synchronous to ensure it loads completely
    script.type = "text/javascript"
    script.crossOrigin = "anonymous" // Help with CORS if needed

    script.onload = () => {
        console.log("[Parent] Flobby script loaded from:", jsUrl)
        const win = frameEl.contentWindow
        const root = doc.getElementById("flobby-root")

        // Give it a tiny delay to ensure IIFE executes
        setTimeout(() => {
            console.log("[Parent] Checking for Flobby in iframe window:", {
                hasWindow: !!win,
                hasFlobby: !!(win && win.Flobby),
                flobbyType: win && typeof win.Flobby,
                hasInit: !!(win && win.Flobby && win.Flobby.init),
                initType: win && win.Flobby && typeof win.Flobby.init,
                windowKeys: win ? Object.keys(win).filter(k => k.toLowerCase().includes("flob")) : [],
                allWindowKeys: win ? Object.keys(win).slice(0, 50) : []
            })

            if (win && win.Flobby && typeof win.Flobby.init === "function") {
                console.log("[Parent] Initializing Flobby...")
                try {
                    const instance = win.Flobby.init(root)
                    console.log("[Parent] Flobby initialized successfully", instance)
                } catch (err) {
                    console.error("[Parent] Error initializing Flobby:", err)
                }
            } else {
                console.error("[Parent] Flobby.init not found. Window object:", win)
                console.error("[Parent] Available on window:", win ? Object.keys(win).slice(0, 50) : "no window")

                // Try to see what's in the script by fetching it
                fetch(jsUrl)
                    .then(r => r.text())
                    .then(text => {
                        console.log("[Parent] Script content length:", text.length)
                        console.log("[Parent] Script contains \"Flobby\":", text.includes("Flobby"))
                        console.log("[Parent] Script contains \"window.Flobby\":", text.includes("window.Flobby"))
                        console.log("[Parent] Last 500 chars:", text.slice(-500))
                    })
                    .catch(e => console.error("[Parent] Could not fetch script:", e))
            }
        }, 100)
    }

    script.onerror = (e) => {
        console.error("[Parent] Failed to load Flobby script:", jsUrl, e)
    }

    console.log("[Parent] Appending Flobby script:", jsUrl)
    doc.body.appendChild(script)
}


/**
 * Creates and writes the HTML document content for the launcher iframe
 *
 * @param {HTMLIFrameElement} launcherFrame - The iframe element to write launcher content into
 * @param {string} cssUrl - URL to the Flobby CSS file (not used in initial launcher)
 * @param {string} jsUrl - URL to the Flobby JavaScript file (not used in initial launcher)
 * @returns {void}
 */
function writeLauncherDoc(launcherFrame, cssUrl, jsUrl) {
    const doc = launcherFrame.contentDocument || launcherFrame.contentWindow?.document
    if (!doc) {
        return
    }

    doc.open()
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  html,body{margin:0;pointer-events: auto;}
  .nlc-flobby-launcher{
    display:inline-flex;align-items:center;justify-content:center;
    width:48px;height:48px;border-radius:9999px;
    border:2px solid #111;background:rgba(0,0,0,.2);backdrop-filter:saturate(120%) blur(4px);
    cursor:pointer;user-select:none;font:600 12px/1 system-ui;color:#fff;
    pointer-events: auto;
  }
  .nlc-flobby-launcher:active{transform:scale(.98)}
</style>
</head>
<body>
  <button id="nlc-flobby-launcher" class="nlc-flobby-launcher" title="Open Playin">▶</button>
</body>
</html>`)
    doc.close()

    const btn = doc.getElementById("nlc-flobby-launcher")
    const sizeToButton = () => {
        const r = btn.getBoundingClientRect()
        launcherFrame.style.width = Math.ceil(r.width) + "px"
        launcherFrame.style.height = Math.ceil(r.height) + "px"
    }
    sizeToButton()

    btn.addEventListener("click", () => {
        expandToFull(launcherFrame)
        bootFlobbyInExistingFrame(launcherFrame, cssUrl, jsUrl)
    })
}


/**
 * Mounts a launcher iframe inside a game iFrame to enable Flobby functionality
 *
 * @param {HTMLIFrameElement} gameIFrame - The game's iframe element where launcher will be mounted
 * @param {string} cssUrl - URL to the Flobby CSS file
 * @param {string} jsUrl - URL to the Flobby JavaScript file
 * @returns {void}
 */
function mountLauncherInsideGame(gameIFrame, cssUrl, jsUrl) {
    const gameDoc = gameIFrame.contentDocument || gameIFrame.contentWindow?.document
    if (!gameDoc) {
        return
    }

    const ensure = () => {
        if (!gameDoc.body) {
            return void setTimeout(ensure, 10)
        }
        if (!gameDoc.body.style.position) {
            gameDoc.body.style.position = "relative"
        }

        // Small launcher iframe
        const launcherFrame = gameDoc.createElement("iframe")
        launcherFrame.title = "Flobby Launcher"
        launcherFrame.setAttribute("frameBorder", "0")
        launcherFrame.setAttribute("allow", "autoplay")
        launcherFrame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms")
        launcherFrame.style.position = "absolute"
        launcherFrame.style.top = "8px"
        launcherFrame.style.left = "8px"
        launcherFrame.style.width = "1px"
        launcherFrame.allowTransparency = true
        launcherFrame.style.background = "transparent"
        launcherFrame.style.backgroundColor = "transparent" // some engines
// optional legacy flag (non-standard, harmless)
        launcherFrame.setAttribute("allowTransparency", "true")
        launcherFrame.style.pointerEvents = "auto"
        launcherFrame.style.zIndex = "2147483648"

        gameDoc.body.appendChild(launcherFrame)
        writeLauncherDoc(launcherFrame, cssUrl, jsUrl)
    }
    ensure()
}


async function getFlobbyConfig() {
    try {
        const response = await fetchRetry(FLOBBY_CONFIG_URL)
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error(error.message)
        return null
    }
}


export async function initFlobby(gameIFrame) {
    const config = await getFlobbyConfig()

    if (!config) {
        return
    }

    mountLauncherInsideGame(gameIFrame, config.css, config.script)


    console.log("initFlobby 2")
}