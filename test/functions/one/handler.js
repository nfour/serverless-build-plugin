import number from '../../lib/one'
import { typeOf } from 'lutils'
import Promise from 'bluebird'

export async function handler(event, context, done) {
    console.log({ number })
    console.log({ env: process.env })

    await Promise.delay(200)

    done(null, { message: number + typeOf(number) })
}
