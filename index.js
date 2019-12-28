const EventEmitter = require('events')
const EventBroker = require('distributed-eventemitter')

const uuid = require('uuid/v4')
const waitForEvent = require('wait-for-event-promise')

const serializeError = require('./lib/serializeError')
const removeUndefined = require('./lib/removeUndefined')

class Memo extends EventEmitter {

  constructor (opts) {

    super()

    const self = this

    opts = Object.assign({
      host: 'localhost',
      port: 61613,
      destination: 'events',
      excludedEvents: [],
      maxReconnects: 1,
      username: '',
      password: '',
      connect: true
    }, removeUndefined(opts || {}))

    opts.excludedEvents.push(...['message.error', 'message'])

    const config = {
      destination: opts.destination,
      excludedEvents: opts.excludedEvents,
      servers: [
        {
          host: opts.host,
          port: opts.port,
          connectHeaders: {
            login: opts.username,
            passcode: opts.password
          }
        }
      ],
      reconnectOpts: { maxReconnects: opts.maxReconnects }
    }

    const broker = new EventBroker(config)

    const brokerId = broker.getId()
    const destination = opts.destination

    broker.on('connecting', () => this.emit('connecting', { brokerId, destination }))

    broker.on('connected', () => {

      self.emit('connected', { brokerId, destination })

      self.connected = true

    })

    broker.on('disconnected', () => {

      self.emit('disconnected', { brokerId, destination })

      self.connected = false

    })

    broker.on('error', (err) => {

      const error = serializeError(err)

      self.emit('error', { brokerId, destination, error })

      self.connected = false

    })

    this.client = broker
    this.connected = false

    if (opts.connect) {

      this.connect()
        .then(() => this.emit('ready'))

    } else {

      this.emit('ready')

    }

  }

  async send (
    eventName, data, opts
  ) {

    const self = this

    data = data || {}

    opts = Object.assign({
      global: true,
      timeout: -1,
      throwDisconnected: true
    }, removeUndefined(opts || {}))

    if (opts.throwDisconnected && !this.connected) {

      await this.connect()

      throw new Error('Message broker is not connected')

    }

    const brokerId = this.client.getId()
    const eventId = uuid()
    const global = opts.global

    this.emit('sending', { brokerId, eventId, eventName, global })

    const e = {
      eventName,
      eventId,
      brokerId,
      global
    }

    const packet = {
      data,
      e
    }

    const method = opts.global
      ? 'emit'
      : 'emitToOne'

    return this.client[method](
      eventName, packet, opts.timeout
    ).then((res) => {

      self.emit('sent', { brokerId, eventId, eventName })

      if (!global) {

        self.emit('ack', { brokerId, eventId, eventName, res })

      }

      return res

    })

  }

  async listen (
    eventName, handler, opts
  ) {

    const self = this

    opts = Object.assign({ throwDisconnected: true }, opts || {})

    !this.connected && await this.connect()

    if (opts.throwDisconnected && !this.connected) {

      throw new Error('Message broker is not connected')

    }

    const brokerId = this.client.getId()

    this.emit('listening', { brokerId, eventName })

    this.client.on(eventName, async (
      packet, resolve, reject, raw
    ) => {

      const { data, e } = packet
      const { eventId, eventName, global } = e

      raw = raw || reject

      Object.assign(raw, { packet })

      self.emit('processing', { brokerId, eventName, eventId, global, raw })

      if (global) {

        return handler(data, e, raw)
          .catch((err) => {

            const error = serializeError(err)

            self.emit('error', { brokerId, eventName, eventId, error })

          })

      }

      try {

        self.emit('message', { brokerId, eventName, eventId, data, e })

        const res = await handler(data, e, raw)

        if (!res) {

          return reject && reject()

        }

        resolve && resolve(res)

      } catch (err) {

        const error = serializeError(err)

        self.emit('message.error', { brokerId, eventName, eventId, error })

        reject && reject(error)

      }

    })

  }

  connect () {

    const self = this

    return new Promise((resolve, reject) => {

      self.client.connect()
        .then(() => resolve())

      waitForEvent(self, 'error')
        .then((err) => reject(err))

    })

  }

  disconnect () {

    return this.client.disconnect()

  }

  block () {

    return waitForEvent(this.client, 'disconnect')

  }

}

module.exports = Memo
