# purepipe

A function to create steam pipelines while propagating errors.

## pipe to writable streams

```javascript
import { purepipe } from 'purepipe'

const source = // readable stream
const transform = // transform stream
const write = // writable stream

purepipe(source, transform, write) // returns a writable stream

```

## create a reusable transform stream

```javascript
import { purepipe } from 'purepipe'

const transform1 = // transform stream
const transform2 = // transform stream

const combinedTransform = purepipe(transform1, transform2) 
```
