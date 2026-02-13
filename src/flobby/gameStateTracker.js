export class GameStateTracker {
    /**
     * @param {Function} sendFn - Called to send a JSON-RPC message to Flobby
     * @param {Function} onExternalLoaded - Called when the "loaded" external event fires
     */
    constructor(sendFn, onExternalLoaded, { operator, game } = {}) {
        this._sendFn = sendFn
        this._onExternalLoaded = onExternalLoaded
        this._storageKey = `${operator || "unknown"}.${game || "unknown"}.flobby_game_state`
        this.gameInfo = null
        this._sessionStartTime = null
        this._currentRoundId = null
        this._currency = null
        this._lastBalance = null
        this._lastTotalCost = 0
        this._roundInProgress = false
        this._pendingRound = null
        this._rounds = []
        this._restore()
    }

    _persist() {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify({
                gameInfo: this.gameInfo,
                _currentRoundId: this._currentRoundId,
                _currency: this._currency,
                _lastBalance: this._lastBalance,
                _lastTotalCost: this._lastTotalCost,
                _rounds: this._rounds,
            }))
        } catch (_) {}
    }

    _restore() {
        try {
            const raw = localStorage.getItem(this._storageKey)
            if (!raw) return
            const s = JSON.parse(raw)
            this.gameInfo = s.gameInfo ?? this.gameInfo
            this._currentRoundId = s._currentRoundId ?? this._currentRoundId
            this._currency = s._currency ?? this._currency
            this._lastBalance = s._lastBalance ?? this._lastBalance
            this._lastTotalCost = s._lastTotalCost ?? this._lastTotalCost
            this._rounds = s._rounds ?? this._rounds
        } catch (_) {}
    }

    forwardEvent(event, data) {
        console.log("[Game Event]", event, data)
        const handlers = {
            info: () => {
                this.gameInfo = data
                if (!this._sessionStartTime) {
                    this._sessionStartTime = Date.now()
                }
                this._persist()
            },
            balance: () => {
                const balance = Number.parseFloat(data)
                if (!Number.isNaN(balance)) {
                    this._lastBalance = balance
                    this._persist()
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

                const pending = this._pendingRound
                if (!pending) {
                    return
                }

                const totalCost = pending.totalCost || pending.betAmount
                const round = {
                    roundId: this._currentRoundId || "unknown",
                    betAmount: pending.betAmount,
                    totalCost,
                    winAmount: pending.winAmount,
                    netResult: pending.winAmount - totalCost,
                    winMultiplier:
                        pending.betAmount > 0
                            ? Math.round(
                                  (pending.winAmount / pending.betAmount) * 100,
                              ) / 100
                            : 0,
                    balanceStart: pending.balanceStart,
                    balanceEnd: this._lastBalance,
                    currency: this._currency?.code || "USD",
                    startedAt: pending.startedAt,
                    endedAt: Date.now(),
                    isFeatureBuy: pending.isFeatureBuy,
                    isBoostedBet: pending.isBoostedBet,
                    isFreeSpin: pending.isFreeSpin,
                    mode: pending.mode,
                    featureName: pending.featureName,
                    freespinsPlayed: pending.freespinsPlayed,
                }

                this._rounds.push(round)
                if (this._rounds.length > 1000) {
                    this._rounds = this._rounds.slice(-1000)
                }

                this._pendingRound = null
                this._persist()

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
                    this._persist()
                    this._sendFn({
                        jsonrpc: "2.0",
                        method: "currency",
                        params: data.data,
                    })
                    return
                }

                if (data.name === "betChanged") {
                    this._lastTotalCost =
                        Number.parseFloat(data.data?.totalCost) || 0
                    this._persist()
                    return
                }

                if (data.name === "bet") {
                    // Only create a new pending round on the first bet
                    // (free spin bets fire during an active round)
                    if (!this._roundInProgress) {
                        const betData = data.data || {}
                        this._roundInProgress = true
                        this._pendingRound = {
                            betAmount:
                                Number.parseFloat(betData.bet) || 0,
                            totalCost: this._lastTotalCost,
                            betType: betData.type || "normalBet",
                            featureName: betData.featureName || null,
                            isFeatureBuy: betData.type === "featureBet",
                            isBoostedBet: false,
                            isFreeSpin: false,
                            mode: "NORMAL",
                            winAmount: 0,
                            winMultiplier: 0,
                            freespinsPlayed: 0,
                            balanceStart: this._lastBalance,
                            startedAt: Date.now(),
                        }
                    }
                    return
                }

                if (data.name === "game") {
                    const gameData = data.data || {}
                    if (this._pendingRound) {
                        this._pendingRound.winAmount =
                            gameData.accumulatedRoundWin ?? 0
                        this._pendingRound.isBoostedBet =
                            gameData.boostedBet ??
                            this._pendingRound.isBoostedBet
                        this._pendingRound.isFeatureBuy =
                            this._pendingRound.isFeatureBuy ||
                            (gameData.wasFeatureBuy ?? false)
                        this._pendingRound.mode =
                            gameData.mode || this._pendingRound.mode
                        this._pendingRound.freespinsPlayed =
                            gameData.freespinsPlayed ??
                            this._pendingRound.freespinsPlayed
                        this._pendingRound.isFreeSpin =
                            this._pendingRound.isFreeSpin ||
                            (gameData.mode != null &&
                                gameData.mode !== "NORMAL") ||
                            (gameData.freespinsPlayed ?? 0) > 0
                    }
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
        if (this._sessionStartTime) {
            messages.push({
                jsonrpc: "2.0",
                method: "sessionStart",
                params: { timestamp: this._sessionStartTime },
            })
        }
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
