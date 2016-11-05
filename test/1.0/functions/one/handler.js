import 'source-map-support/register';
import { typeOf } from 'lutils';
import Promise from 'bluebird';
import number from '../../lib/one';

export const handler = async (event, context, done) => {
  console.log({ number });
  console.log({ env: process.env });

  // await Promise.delay(200);

  // Uncomment this to emit an error
  // await require('./file')();

  done(null, {
    statusCode : 200,
    headers    : { 'content-type': 'application/json' },
    body       : JSON.stringify({ num: number + typeOf(number) }) });
};
