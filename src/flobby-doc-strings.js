export function getLaunchButtonDocString() {
    return `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <style>
                html, body { 
                    margin: 0;
                    pointer-events: auto;
                }
                
                .flobby-launch-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    border-radius: 9999px;
                    border: 2px solid #111;
                    background: rgba(0,0,0,.2);
                    backdrop-filter: saturate(120%) blur(4px);
                    cursor: pointer;
                    user-select: none;
                    font: 600 12px/1 system-ui;
                    color: #fff;
                    pointer-events: auto;
                }
                
                .flobby-launch-button:active {
                    transform: scale(.98);
                }
            </style>
        </head>
        <body>
            <button id="flobby-launch-button" class="flobby-launch-button" title="Open Flobby">▶</button>
        </body>
    </html>`
}

export function getAppWrapperDocString(flobbyCss) {
    return `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <link rel="stylesheet" href="${flobbyCss}">
            
            <style>
                *, *::before, *::after {
                    box-sizing: border-box;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(70, 70, 70, 0.3) transparent;
                }
    
                ::-webkit-scrollbar {
                    width: 12px;
                }
                
                ::-webkit-scrollbar-thumb {
                    border: 4px solid transparent;
                    box-shadow: inset 0 0 0 4px rgba(70, 70, 70, 0.3);
                    min-height: 50px;
                    border-radius: 99px;
                }
                
                ::-webkit-scrollbar-button {
                    width: 0;
                    height: 0;
                    display: none;
                }
                
                ::-webkit-scrollbar-track {
                    background-color: transparent;
                }
                
                ::-webkit-scrollbar-corner {
                    background-color: transparent;
                }
                
                html, body {
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    background: transparent !important;
                    color-scheme: light only;
                }
                
                #flobby-root {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }
                
                #flobby-close-button {
                    position: fixed;
                    top: 8px;
                    right: 8px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    background-color: #2b2b2b;
                    cursor: pointer;
                    user-select: none;
                    font: 600 1.5rem system-ui;
                    color: #898989;
                    z-index: 2147483647;
                    pointer-events: auto;
                }
                
                #flobby-close-button:active { 
                    transform: scale(.98);
                }
            </style>
            <script>
                window.addEventListener("error", function(e) {
                    console.error("[Flobby] Script error:", e.error || e.message, e.filename, e.lineno)
                })
            </script>
        </head>
        <body>
            <div id="flobby-root"></div>
            <button id="flobby-close-button" title="Close Flobby">✕</button>
        </body>
    </html>`
}