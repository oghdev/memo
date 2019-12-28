#!/usr/bin/env node

require('dotenv').config()

const Memo = require('../index')

const yargs = require('yargs')
const getStdin = require('get-stdin')
const promiseTimeout = require('promise-timeout').timeout
const ms = require('ms')

const logger = require('../lib/logger')

const send = async (argv) => {

  logger.level = argv.logLevel || process.env.LOG_LEVEL || 'info'

  if (!argv.message || argv.message === '-') {

    argv.message = await getStdin()

  }

  if (!argv.message) {

    throw new Error('Message not specified')

  }

  const message = argv.message.trim()
  const event = argv.event

  const host = argv.host
  const port = argv.port
  const destination = argv.destination
  const username = argv.username
  const password = argv.password

  const client = new Memo({
    host,
    port,
    destination,
    username,
    password,
    connect: false,
    maxReconnects: 0
  })

  const errorHandler = ({ error }) => {

    console.log({ error })

    if (!error || (error && error.message === 'No ack')) {

      return

    }

    logger.error(`${error.message}`)

    process.exit(1)

  }

  client.on('error', errorHandler)

  client.on('connected', () => {

    logger.debug('Client is connected')

  })

  client.on('ack', ({ brokerId, eventId, eventName, res }) => {

    logger.debug(`Message ack. brokerId=${brokerId} eventId=${eventId} eventName=${eventName} res=${res}`)

  })

  client.on('sending', ({ brokerId, eventId, eventName, global }) => {

    logger.debug(`Sending event. brokerId=${brokerId} eventId=${eventId} eventName=${eventName} global=${global}`)

  })

  client.on('sent', ({ brokerId, eventId, eventName }) => {

    logger.debug(`Sent event. brokerId=${brokerId} eventId=${eventId} eventName=${eventName} global=${global}`)

    let t

    if (global) {

      client.removeAllListeners('ack')
      t = setTimeout(() => client.emit('ack', { eventId, eventName, res: '' }), 200)

    }

    client.once('ack', () => {

      clearTimeout(t)

      client.off('error', errorHandler)

      return client.disconnect()
        .catch((err) => logger.error(err.message))

    })


  })

  await client.connect()

  const raw = argv.raw
  const sendTimeout = ms(argv.sendTimeout)

  const global = argv.global
  const timeout = argv.ackTimeout !== 'null' ? ms(argv.ackTimeout) : -1

  const opts = { global, timeout }

  await promiseTimeout(client.send(event, message, opts), sendTimeout)
    .then(async (res) => {

      if (raw && !global) {

        // eslint-disable-next-line no-console
        console.log(res)

        return

      }

      if (global) {

        logger.warn('Global events will not return a value')

        return

      }

      logger.info(`Message result: ${res}`)

    })
    .catch((err) => errorHandler({ error: err }))

}

const listen = async (argv) => {

  logger.level = argv.logLevel || process.env.LOG_LEVEL || 'info'

  const host = argv.host
  const port = argv.port
  const destination = argv.destination
  const username = argv.username
  const password = argv.password

  const client = new Memo({
    host,
    port,
    destination,
    username,
    password,
    connect: false,
    maxReconnects: 0
  })

  client.on('listening', ({ brokerId, eventName }) => {

    logger.debug(`Listening for events from broker. brokerId=${brokerId} eventName=${eventName}`)

  })

  client.on('error', ({ error }) => {

    if (error.message === 'No ack') {

      return

    }

    logger.error(`${error.message}`)

    process.exit(1)

  })

  logger.warn('Events sent to this consumer will not be redelivered to another. Please only use for visibility/testing purposes.')

  await client.connect()

  const event = argv.event

  await client.listen(event, async (data, e) => {

    const { eventId, eventName, global } = e

    logger.debug(`Got event. eventId=${eventId} eventName=${eventName} global=${global}`)

    return data

  })

}

yargs
  .scriptName('memo')
  .command(
    'send <event> [message]',
    'Sends a event message to the broker',
    (yargs) => (
      yargs.option('host', {
        type: 'string',
        description: 'Hostname of the broker',
        default: 'localhost'
      })
      .option('port', {
        type: 'integer',
        description: 'Port the broker is listening on',
        default: 61613
      })
      .option('destination', {
        type: 'string',
        description: 'Destination topic for the broker'
      })
      .option('username', {
        type: 'string',
        description: 'Username for the broker if it requires authentication'
      })
      .option('password', {
        type: 'string',
        description: 'Password for the broker if it requires authentication'
      })
      .option('global', {
        type: 'boolean',
        description: 'Send message as a broadcast to all consumers. If false, only one consumer will process the message.',
        default: true
      })
      .option('raw', {
        type: 'boolean',
        description: 'Return the raw message ack'
      })
      .option('send-timeout', {
        type: 'string',
        description: 'Timeout to wait for message send (e.g. 10s, 30s, 1m, 1h)',
        default: '2s'
      })
      .option('ack-timeout', {
        type: 'string',
        description: 'Timeout to wait for message process (e.g. 10s, 30s, 1m, 1h)',
        default: 'null'
      })
      .option('log-level', {
        type: 'string',
        choices: [ 'info', 'warn', 'debug', 'trace', 'error' ]
      })
      .positional('event', {
        type: 'string'
      })
      .positional('message', {
        type: 'string'
      })
    ),
    send
  )
  .command(
    'listen <event> [message]',
    'Listen for event messages from the broker',
    (yargs) => (
      yargs.option('host', {
        type: 'string',
        description: 'Hostname of the broker',
        default: 'localhost'
      })
      .option('port', {
        type: 'integer',
        description: 'Port the broker is listening on',
        default: 61613
      })
      .option('destination', {
        type: 'string',
        description: 'Destination topic for the broker'
      })
      .option('username', {
        type: 'string',
        description: 'Username for the broker if it requires authentication'
      })
      .option('password', {
        type: 'string',
        description: 'Password for the broker if it requires authentication'
      })
      .option('ack', {
        type: 'string',
        description: 'Acknowledge message with the broker. This will remove it from the queue without processing.'
      })
      .option('log-level', {
        type: 'string',
        choices: [ 'info', 'warn', 'debug', 'trace', 'error' ]
      })
      .positional('event', {
        type: 'string'
      })
    ),
    listen
  )
  .group([ 'help', 'version' ], 'Global Options:')
  .strict()
  .help()
  .version()
  .showHelpOnFail(true, 'Specify --help for available options')
  .wrap(yargs.terminalWidth()*0.75)
  .argv
