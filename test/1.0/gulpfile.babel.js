const gulp = require('gulp');
const Promise = require('bluebird');

Promise.promisifyAll(gulp);

let output;

gulp.task('test', () => {
  return Promise.delay(2000).then(() => {
    output = 'exports.handler = function(event, context, done) { done(null, 1)}';
  });
});

module.exports = () => {
  return gulp.startAsync(['test']).then(() => output);
};
