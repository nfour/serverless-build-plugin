'use strict';

exports.hello = (event, context, done) =>
  done(
    null,
    {
      message: 'Go Serverless v1.0! Your function executed successfully!',
      event
    }
  );

exports.blah = (event, context, done) =>
  done(null, { message: "blah" })
