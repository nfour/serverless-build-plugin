
## 2.1.0 - Jul 13 2017

- [x] Fixed #36, issue with `.map` files being required for file builds

## 2.0.1 - Jun 13 2017

- [x] Removed `babili` option.
  - You can add it to your .babelrc yourself

## 2.0.0 - Jun 12 2017

Breaking changes:
- [x] `serverless@0.5` support dropped
- [x] `babel`, `uglifyjs`, `babel-preset-babili` are now optional **peerDependencies**

Features:
- [x] Symlinked modules now supported. 
  - eg. `yarn link myModule` will work as expected when building
- [x] Build times improved
- [x] CLI output imrpoved
  - [x] Can now specify the `silent` option to hush the CLI
- [x] Artifacts are now configured for `archiver` 
- [x] Supports `sls package` instead of `sls deploy --no-deploy`. This command can't build one function at a time at this time

Under the covers:
- [x] Rewritten in TypeScript for added sanity
- [x] Fixed a race condition

## 1.5.0 - May 30 2017
Features:
- [x] Supports latest serverless versions as of now (1.14)


## 1.0.0 - Jan 5 2017
- [BREAKING] Made `excludes` file globs actually override `includes`
  - This means if you have a global exclude like `**/*.js` you can't include .js files
  - This also means if you include `myFolder` you can exclude a `__tests__` folder within it
- Update deps

## 0.9.0 - Jan 2 2017
- Added option `normalizeBabelExt` (boolean) (default: `false`)
  - When `true`, `.jsx` files are renamed to `.js` for babel compiled source 

## 0.8.0 - Dec 31 2016
- Module bundler concurrency changes
- Linting fixes
- Dependency updates

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
