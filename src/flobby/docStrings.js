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
                    border: 2px solid rgba(130,130,130,0.5);
                    background: rgba(0,0,0,.2);
                    backdrop-filter: saturate(120%) blur(4px);
                    cursor: pointer;
                    user-select: none;
                    font: 600 12px/1 system-ui;
                    color: #fff;
                    pointer-events: auto;
                    transition: border-color 0.2s;
                }

                .flobby-launch-button:active {
                    transform: scale(.98);
                }

                .flobby-launch-button[data-state="loading"] {
                    cursor: wait;
                }

                .flobby-launch-button[data-state="ready"] {
                    border-color: rgba(255,255,255,0.7);
                }

                .flobby-launch-button[data-state="error"] {
                    border-color: rgba(255,17,17,0.7);
                }

                .flobby-launch-button svg {
                    fill: #fff;
                }

                .flobby-icon {
                    display: block;
                }

                .flobby-spinner {
                    display: none;
                }

                .flobby-launch-button[data-state="loading"] .flobby-icon {
                    display: none;
                }

                .flobby-launch-button[data-state="loading"] .flobby-spinner {
                    display: block;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <button id="flobby-launch-button" class="flobby-launch-button" data-state="idle" title="Open Flobby">
                <svg class="flobby-icon" xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 99 111">
                    <g>
                        <path d="M17.8881 3.75972C15.4501 0.763694 12.5716 0 10.2805 0C8.66499 0 7.34321 0.381847 6.69701 0.61683C5.11087 1.17491 0 3.52474 0 10.1043V100.866C0 107.475 5.14025 109.796 6.69701 110.354C8.28314 110.912 13.7171 112.351 17.8881 107.211L45.6747 73.0503L54.7803 61.8298C57.7764 58.1582 57.7764 52.8124 54.7803 49.1114L17.8881 3.73035V3.75972Z"/>
                        <path d="M88.0304 0H78.8367C72.7272 0 67.7631 4.96401 67.7631 11.0736V62.1823C66.9701 64.7378 65.707 67.1463 63.9447 69.3199L54.8391 80.5404L53.3117 82.4202L68.3212 104.42C68.7031 104.949 69.1143 105.449 69.5549 105.918C71.5229 108.973 74.9595 111 78.8367 111H88.0304C94.1399 111 99.104 106.036 99.104 99.9264V11.0736C99.104 4.96401 94.1399 0 88.0304 0Z"/>
                    </g>
                </svg>
                <svg class="flobby-spinner" xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
            </button>
        </body>
    </html>`
}

export function getAppWrapperDocString(inlineCss = "") {
    return `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <style>${inlineCss}</style>
            <style>
                *, *::before, *::after {
                    box-sizing: border-box;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(100, 100, 100, 0.3) transparent;
                }

                ::-webkit-scrollbar { width: 12px; }
                ::-webkit-scrollbar-thumb {
                    border: 4px solid transparent;
                    box-shadow: inset 0 0 0 4px rgba(100, 100, 100, 0.3);
                    min-height: 50px;
                    border-radius: 99px;
                }
                ::-webkit-scrollbar-button { width: 0; height: 0; display: none; }
                ::-webkit-scrollbar-track { background-color: transparent; }
                ::-webkit-scrollbar-corner { background-color: transparent; }

                html, body {
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    color-scheme: light only;
                }

                #flobby-root {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    overflow-y: auto;
                    overflow-x: hidden;
                    background: var(--background, #fff);
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
                    border: none;
                    border-radius: 8px;
                    background-color: #2b2b2b;
                    cursor: pointer;
                    user-select: none;
                    font: 600 1.25rem system-ui;
                    color: #898989;
                    z-index: 2147483647;
                    pointer-events: auto;
                    transition: background-color 0.15s;
                }
                #flobby-close-button:hover {
                    background-color: #3b3b3b;
                    color: #fff;
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
