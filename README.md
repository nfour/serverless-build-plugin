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
    - [ ] Purges existing build folder (as an option)
    - [ ] Extenerals are copied over

- [ ] Add the above described `minimal packaging` method, leveraging the sls@1.0 existing packaging workflow
    - [ ] node_modules packaging
        - [x] Copys them over
        - [ ] Purges existing build folder
        - [ ] Minifies them with uglify
        - [ ] Minified with webpack in order to remove unused code
        - [ ] Integrate this with the webpack `extenerals`, as sls-webpack-plugin does
    - [ ] Add src code with babel complation as necessary to `./build`
    - [ ] Uglify source

    - This is subject to an ongoing discussion @ serverless thus may change implimentation
- [ ] Test alternate build methods with promise, string, stream etc.
    - May be worth ignoring the return value when it isnt a webpack config, just assume the files were written to `.serverless/`



### REF
- https://github.com/asprouse/serverless-webpack-plugin/blob/master/index.js
- https://github.com/redbadger/serverless-webpack-plugin/blob/a9235521ef395513d48f6ca41bf6779744d8ebdb/1.0/src/index.js
