import number from '../../lib/two'

export function handler(event, context, done) {
    console.log({ number })

    done(null, { message: number })
}
