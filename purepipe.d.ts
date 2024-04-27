import { PassThrough, Readable, Transform, Writable } from 'stream'

export declare function purepipe(): PassThrough
export declare function purepipe(...streams: [Readable, ...Transform[]]): Transform
export declare function purepipe(...streams: [Readable, ...Transform[], Writable]): Writable
