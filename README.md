# SERVERLESS BUILD PLUGIN
This plugin is intended to add flexibility to the serverless build process for serverless 1.0.

Currently in testing state. To try this, simply npm install both `./test` and `./`, then `sls deploy` with a default profile or `export AWS_PROFILE=myprofile`.

### TESTING USAGE
- Running the bundler:
    - Set `custom.build.bundle` to `true`
- Running a build file or webpack config:
    - Set `custom.build.bundle` to `false`
    - Set `custom.build.build` to the relative path of your build file.
        - If unset or file not found, this will automatically try for a `webpack.config.js`

### CONFIG
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
    - Closer to an node environment

### TODO
- [ ] Test webpack building, get parity with `severless-webpack-plugin`
    - [x] Webpack builds hanlder and source map
    - [x] Purges existing build folder (as an option)
    - [ ] Extenerals are copied over
        - Will be fixed when bundle is combined

- [ ] Combine both `buildFile` and `bundle` into one, as bundle will need a build method anyway. Not orthoganal.
- [ ] node_modules packaging
    - [x] Copys them over
        - [x] Nested deps too
    - [x] Purges existing build folder
    - [x] Cleanup
    - [ ] Minify .js

- [ ] Create a babel default build method, like webpack, for the servicePath
    - [ ] Minify .js


### REF
- https://github.com/asprouse/serverless-webpack-plugin/blob/master/index.js
- https://github.com/redbadger/serverless-webpack-plugin/blob/a9235521ef395513d48f6ca41bf6779744d8ebdb/1.0/src/index.js
