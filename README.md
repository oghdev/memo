# 💌 memo

A simple STOMP (Simple Text Oriented Messaging Protocol) powered event broker for Node JS.


## Installation

#### Requirements

*Node JS (>=10)*

#### Package Manager

**memo** can be installed with your favourite node package manager (npm/yarn/pnpm)

An example with npm:

```
npm install oghdev/memo
```

#### Version pinning

If you want to install and pin a specific version of **memo**, you can do so by referencing a specific [release](https://github.com/oghdev/memo/releases) tarball.

An example with npm;

```bash
npm install https://github.com/oghdev/memo/archive/0.1.0.tar.gz
```


## Usage

### Using the Node API

You can also use **memo** via an exposed api:

```
$ cat listen.js

const Memo = require('memo')

const host = process.env.ACTIVE_MQ_HOST
const port = process.env.ACTIVE_MQ_PORT

const destination = process.argv[1]
const event = process.argv[2]

const client = new Memo({
  host,
  port,
  destination
})

client.on('listening', () => console.log('Client is connected'))

await client.listen(event, async (data, e) => {

  const { eventId } = e

  console.log(`Event id: ${eventId}`)
  console.log(`Event data: ${data}`)

  return data

})

await client.block()

$ node listen.js "topic" "event"

Event id: 9f98d24c-9102-4111-82f8-ddb42846a311
Event data: eventdata
```

```
$ cat send.js

const Memo = require('memo')

const host = process.env.ACTIVE_MQ_HOST
const port = process.env.ACTIVE_MQ_PORT

const destination = process.argv[1]
const event = process.argv[2]
const data = process.argv[3]

const client = new Memo({
  host,
  port,
  destination
})

const res = await client.send(event, data)

console.log(res)

$ node send.js "topic" "event" "eventdata"

eventdata
```

## Versioning

We follow the Semantic Versioning Specification for our releases.

For a given version of **memo**, we will only increment the:

- MAJOR version when making an incompatible API change,
- MINOR version when adding functionality in a backwards compatible manner
- PATCH version when making backwards compatible changes/improvements/bug fixes.

If you are concerned about breaking changes, see the section above regarding version pinning.

Currently **memo** should be considered beta software.


## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md)
