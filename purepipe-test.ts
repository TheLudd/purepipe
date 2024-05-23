import { describe, it } from 'mocha'
import { assert } from 'chai'
import { Readable, Transform, Writable } from 'stream'
import { purepipe } from './purepipe.js'

const drainStream = (stream: Readable) => {
  return new Promise((resolve, reject) => {
    const values: any[] = []
    stream.on('data', (data: any) => values.push(data))
    stream.on('end', () => resolve(values))
    stream.on('error', (e) => {
      reject({
        errorMessage: e.message,
        receivedValues: values,
      })
    })
  })
}

const awaitWritable = (stream: Writable) => {
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

const createTransform = (fn: (chunk: any) => any, options = {}) => {
  return new Transform({
    objectMode: true,
    ...options,
    async transform(chunk, _, callback) {
      const nextCunk = await fn(chunk)
      callback(null, nextCunk)
    },
  })
}

function* generateNumbers(limit: number) {
  for (let i = 1; i <= limit; i++) {
    yield i
  }
}

const createReadable = (n = 3) => Readable.from(generateNumbers(n))

function* badGenerator(limit: number) {
  for (let i = 1; i < limit; i++) {
    if (i % 2 === 0) {
      throw new Error('I refuse to yield even numbers')
    }
    yield i
  }
}

describe('for no arguments', () => {
  it('retuns a passthrough if there are no arguments', async () => {
    const source = createReadable()
    const pipe = purepipe()
    const endStream = source.pipe(pipe)
    const result = await drainStream(endStream)
    assert.deepEqual(result, [1, 2, 3])
  })
})

describe('for one argument', () => {
  it('returns the same stream if given just one arg', async () => {
    const source = createReadable()
    const endStream = purepipe(source)
    assert.equal(source, endStream)
  })
})

describe('for multiple arguments', () => {
  it('creates a pipeline stream', async () => {
    const source = createReadable()
    const doubleTransform = createTransform((chunk) => chunk * 2)
    const result = await drainStream(purepipe(source, doubleTransform))
    assert.deepEqual(result, [2, 4, 6])
  })

  it('handles more than 2 args', async () => {
    const source = createReadable()
    const doubleTransform = createTransform((chunk) => chunk * 2)
    const plusOneTransform = createTransform((chunk) => chunk + 1)
    const result = await drainStream(purepipe(source, doubleTransform, plusOneTransform))
    assert.deepEqual(result, [3, 5, 7])
  })

  it('propagates errors', async () => {
    const source = Readable.from(badGenerator(5))
    const doubleTransform = createTransform((chunk) => chunk * 2)
    const pipeline = purepipe(source, doubleTransform)
    try {
      await drainStream(pipeline)
      assert.fail('should have thrown')
    } catch (e: any) {
      assert.equal(e.errorMessage, 'I refuse to yield even numbers')
      assert.deepEqual(e.receivedValues, [2])
    }
  })
})

describe('with write stream as last argument', () => {
  const dest: number[] = []
  const createWritable = () => {
    return new Writable({
      objectMode: true,
      write(chunk, _, callback) {
        dest.push(chunk)
        callback()
      },
    })
  }

  beforeEach(() => {
    dest.splice(0)
  })

  it('returns a write stream', async () => {
    const source = createReadable()
    await awaitWritable(purepipe(source, createWritable()))
    assert.deepEqual(dest, [1, 2, 3])
  })

  it('propagates errors', async () => {
    const source = Readable.from(badGenerator(5))
    const pipeline = purepipe(source, createWritable())
    try {
      await awaitWritable(pipeline)
      assert.fail('should have thrown')
    } catch (e: any) {
      assert.equal(e.message, 'I refuse to yield even numbers')
      assert.deepEqual(dest, [1])
    }
  })

  it('can combine transforms with writable streams', async () => {
    const source = createReadable()

    const doubleTransform = createTransform((chunk) => chunk * 2)
    const target = createWritable()

    const combinedWritable = purepipe(doubleTransform, target)

    await awaitWritable(purepipe(source, combinedWritable))

    assert.deepEqual(dest, [2, 4, 6])
  })
})

describe('when combined', () => {
  it('can pipe previoulsy combined streams', async () => {
    const wordStream = Readable.from(['one', 'two', 'three'])
    const lengthTransform = createTransform((word: string) => word.length)

    const squareTransform = createTransform((n: number) => n ** 2)
    const incrementTransform = createTransform((n: number) => n + 1)
    const halfTransform = createTransform((n: number) => n / 2)

    const pipe1 = purepipe(wordStream, lengthTransform)
    const pipe2 = purepipe(squareTransform, incrementTransform, halfTransform)

    const endStream = purepipe(pipe1, pipe2)

    const result = await drainStream(endStream)
    assert.deepEqual(result, [5, 5, 13])
  })
})
