export class GameStateTracker {
    /**
     * @param {Function} sendFn - Called to send a JSON-RPC message to Flobby
     * @param {Function} onExternalLoaded - Called when the "loaded" external event fires
     */
    constructor(sendFn, onExternalLoaded) {
        this._sendFn = sendFn
        this._onExternalLoaded = onExternalLoaded
        this.gameInfo = null
        this._currentRoundId = null
        this._currency = null
        this._lastBalance = null
        this._currentBet = 0
        this._lastGameWin = 0
        this._roundInProgress = false
        this._rounds = []
    }

    forwardEvent(event, data) {
        console.log("[Game Event]", event, data)
        const handlers = {
            info: () => {
                this.gameInfo = data
            },
            balance: () => {
                const balance = Number.parseFloat(data)
                if (!Number.isNaN(balance)) {
                    this._lastBalance = balance
                    this._sendFn({
                        jsonrpc: "2.0",
                        method: "balanceUpdate",
                        params: { balance },
                    })
                }
            },
            idle: () => {
                if (!this._roundInProgress) {
                    return
                }
                this._roundInProgress = false
                const bet = this._currentBet
                const win = this._lastGameWin
                const round = {
                    roundId: this._currentRoundId || "unknown",
                    betAmount: bet,
                    winAmount: win,
                    netResult: win - bet,
                    currency: this._currency?.code || "USD",
                    timestamp: Date.now(),
                }
                this._rounds.push(round)
                if (this._rounds.length > 100) {
                    this._rounds = this._rounds.slice(-100)
                }
                this._sendFn({
                    jsonrpc: "2.0",
                    method: "roundEnd",
                    params: round,
                })
            },
            external: () => {
                if (!data?.name) {
                    return
                }

                if (data.name === "loaded") {
                    this._onExternalLoaded?.()
                    return
                }

                if (data.name === "gameRoundId") {
                    this._currentRoundId = data.data
                    return
                }

                if (data.name === "currency") {
                    this._currency = data.data
                    this._sendFn({
                        jsonrpc: "2.0",
                        method: "currency",
                        params: data.data,
                    })
                    return
                }

                if (data.name === "bet") {
                    this._currentBet =
                        Number.parseFloat(data.data?.bet) || 0
                    this._lastGameWin = 0
                    this._roundInProgress = true
                    return
                }

                if (data.name === "game") {
                    const gameData = data.data || {}
                    this._lastGameWin =
                        gameData.accumulatedRoundWin ?? 0
                }
            },
        }

        handlers[event]?.(data)
    }

    /**
     * Returns an array of JSON-RPC messages representing current state,
     * for replay when Flobby reconnects.
     */
    getPendingState() {
        const messages = []
        if (this.gameInfo) {
            messages.push({
                jsonrpc: "2.0",
                method: "gameInfo",
                params: this.gameInfo,
            })
        }
        if (this._lastBalance != null) {
            messages.push({
                jsonrpc: "2.0",
                method: "balanceUpdate",
                params: { balance: this._lastBalance },
            })
        }
        if (this._currency) {
            messages.push({
                jsonrpc: "2.0",
                method: "currency",
                params: this._currency,
            })
        }
        for (const round of this._rounds) {
            messages.push({
                jsonrpc: "2.0",
                method: "roundEnd",
                params: round,
            })
        }
        return messages
    }
}
