const reduce = (acc, [ key, value ]) => {

  if (value !== undefined) {

    Object.assign(acc, { [key]: value })

  }

  return acc

}

const removeUndefined = (obj) => Object.entries(obj).reduce(reduce, {})

module.exports = removeUndefined
