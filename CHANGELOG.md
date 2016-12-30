## 0.7.0 - Dec 31 2016
- @arabold #22 fixes #16 - Invalid artifact paths
- Dependency updates

## 0.6.3 - Dec 14 2016
- Add `graceful-fs` dependency to implement incremental backoff
based on EMFILE (see [graceful-fs](https://github.com/isaacs/node-graceful-fs)).

## 0.6.0 - Dec 08 2016
- Added `babili` option,ES6+ aware minification of source code
  - Set this to true to augment your existing babel tranform with minification

## 0.5.2 - Dec 07 2016
- Added version to verbose module logging

## 0.5.1
- Added coloring and config output through logging
- Changed deploy hooks, single function fixed
- By default `uglify` is off
  - `babeli` is needed in future

## 0.5.0.alpha.2
- Added `deepExclude` module checks when bundling nested module `node_modules` directories
## 0.3.0 -> 0.4.0
- Hooks now require `serverless@1.2`
## 0.4.0 -> 0.4.1
- Cleanup
