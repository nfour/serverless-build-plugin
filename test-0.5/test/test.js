import number from '../lib/one'
import { typeOf } from 'lutils'
import Promise from 'bluebird'
import 'source-map-support/register'

export async function handler(event, context, done) {
    console.log({ number })
    console.log({ env: process.env })

    await Promise.delay(200)

    const fuck = {
        test: 'hello'
    }

    done(null, { message: number + typeOf(number) + 'hi' + JSON.stringify(fuck)})
}
