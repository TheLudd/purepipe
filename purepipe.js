import { PassThrough, Readable, Transform } from 'stream'

const createPipeline = (...streams) => {
  const [source, ...rest] = streams
  const last = streams[streams.length - 1]
  return rest.reduce((acc, transform) => {
    acc.on('error', (err) => last.destroy(err))
    return acc.pipe(transform)
  }, source)
}

const wrap = (...streams) => {
  const passthrough = new PassThrough({ objectMode: true })

  const last = createPipeline(passthrough, ...streams)

  const transform = new Transform({
    objectMode: true,
    transform(chunk, _, cb) {
      passthrough.push(chunk)
      cb()
    },
  })

  last.on('data', (data) => transform.push(data))
  last.on('end', () => transform.push(null))
  last.on('error', (err) => transform.destroy(err))

  return transform
}

export function purepipe(...streams) {
  if (streams.length === 0) return new PassThrough({ objectMode: true })
  if (streams.length === 1) return streams[0]

  const last = streams[streams.length - 1]
  return last instanceof Readable ? wrap(...streams) : createPipeline(...streams)
}