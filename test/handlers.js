import merge from 'lutils-merge' // Testing imports
import clone from 'lutils-clone' // Testing imports

export function hello(event, context, done) {
    done(null, {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        event
    })
}

export function test(event, context, done) {
    done(null, { message: "blah" })
}
