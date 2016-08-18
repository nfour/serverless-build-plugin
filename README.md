# SERVERLESS BUILD PLUGIN
This plugin is intended to add flexibility to the serverless build process for serverless 1.0.

Currently in testing state. To try this, simply:
- npm install both `./test` and `./`
- then `sls deploy` in the test folder with a default AWS profile or `export AWS_PROFILE=myprofile`.

The plugin can be configured both on the commandline and under `custom.build` in `serverless.yml`

- `sls deploy --keep`, keep build files and artifacts, do not purge.
- `sls deploy --build=./buildFile.js`
- `sls deploy --bundle` use bundling instead of a build file.

### FEATURE GOALS
- [x] Allow for arbitrary build files to export:
    - Functions (which should return any of the below)
    - Webpack configs
    - File strings & buffers
    - File streams

- [ ] Allow for `minimal packaging`, simply with babel and non-dev dependency resolution and minification in order to maintain the same structure as the source.
    - This will allow issues with webpack to be sidestepped by sacrificing some file size
    - Closer to a node environment

### TODO
- [ ] Test webpack building, get parity with `severless-webpack-plugin`
    - [x] Webpack builds hanlder and source map
    - [x] Purges existing build folder (as an option)
    - [x] Externals are copied over
        - Will be fixed when bundle is combined

- [x] Combine both `buildFile` and `bundle` into one, as bundle will need a build method anyway. Not orthoganal.
- [ ] node_modules packaging
    - [x] Copys them over
        - [x] Nested deps too
    - [x] Purges existing build folder
    - [x] Cleanup
    - [ ] Minify .js

- [ ] Create a babel default build method, like webpack, for the servicePath
    - [ ] Figure out file include and ignoring to ensure minimal builds on a per function basis
        - [ ] Option 1: Use multiple `.serverless-(ignore|include)` that function like .gitignore files
        - [ ] Option 2: Use a `serverless.build.yml`
            - Specify the build options for each function individually, including root options
            - Can then seperate function includes in a clear way, with both regexp and globs

    - [ ] Minify .js


### REF
- https://github.com/asprouse/serverless-webpack-plugin/blob/master/index.js
- https://github.com/redbadger/serverless-webpack-plugin/blob/a9235521ef395513d48f6ca41bf6779744d8ebdb/1.0/src/index.js
