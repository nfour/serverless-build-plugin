import number from '../../lib/one'

export function handler(event, context, done) {
    console.log({ number })

    done(null, { message: number })
}
