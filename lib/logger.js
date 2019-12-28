const winston = require('winston')

const format = winston.format.combine(winston.format.colorize(), winston.format.simple())

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console({ format, stderrLevels: [ 'info', 'warn', 'debug', 'trace', 'error' ] })
  ]
})

module.exports = logger
