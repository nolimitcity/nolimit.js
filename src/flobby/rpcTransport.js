export class RpcTransport {
    /**
     * @param {Function} onInbound - Called with each inbound JSON-RPC message
     * @param {Function} postFn - Called to actually send a message (lives on facade for patching)
     */
    constructor(onInbound, postFn) {
        this._onInbound = onInbound
        this._postFn = postFn
        this._channel = null
        this._port = null
        this._queue = []
        this._isReady = false
        this._rpcId = 0
    }

    get isReady() {
        return this._isReady
    }
    get port() {
        return this._port
    }
    get channel() {
        return this._channel
    }
    get queueLength() {
        return this._queue.length
    }
    get rpcId() {
        return this._rpcId
    }

    /**
     * Creates a new MessageChannel and sets up the inbound listener.
     */
    setup() {
        this._channel = new MessageChannel()
        this._port = this._channel.port1

        this._port.onmessage = (event) => {
            const data = event.data
            if (!data || data.jsonrpc !== "2.0") {
                return
            }
            this._onInbound(data)
        }
    }

    /**
     * Transfers port2 to the Flobby iframe window for private communication.
     */
    sendPort(targetWindow) {
        if (targetWindow && this._channel) {
            targetWindow.postMessage({ type: "__FLOBBY_PORT__" }, "*", [
                this._channel.port2,
            ])
        }
    }

    nextId() {
        return ++this._rpcId
    }

    /**
     * Sends a message if ready, otherwise queues it.
     */
    send(message) {
        if (this._isReady) {
            this._post(message)
        } else {
            this._queue.push(message)
        }
    }

    _post(message) {
        this._postFn(message)
    }

    /**
     * Flushes all queued messages (called after markReady).
     */
    flush() {
        while (this._queue.length > 0) {
            this._post(this._queue.shift())
        }
    }

    markReady() {
        this._isReady = true
    }

    reset() {
        this._isReady = false
    }
}
