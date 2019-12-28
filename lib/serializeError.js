const os = require('os')
const serialize = require('serialize-error').serializeError

const serializeError = (err) => {

  const error = serialize(err)

  error.stack = error.stack.split(os.EOL).map((l) => l.trim())

  return error

}

module.exports = serializeError
