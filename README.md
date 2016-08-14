# SERVERLESS BUILD PLUGIN
This plugin is intended to add flexibility to the serverless build process for serverless 1.0.

Currently in testing state. To try this, simply npm install both `./test` and `./`, then `sls deploy` with a default profile or `export AWS_PROFILE=myprofile`.

### FEATURE GOALS
- [x] Allow for arbitrary build files to export:
    - Functions (which should return any of the below)
    - Webpack configs
    - File strings & buffers
    - File streams

- [ ] Allow for minimal packaging, simply with babel and non-dev dependency resolution and minification in order to maintain the same structure as the source.
    - This will allow issues with webpack to be sidestepped by sacrificing some file size
    - Closer to an node environment

### TODO
- [ ] Test webpack building, get parity with `severless-webpack-plugin`
- [ ] Test alternate build methods with callback, string, stream etc.
    - May be worth ignoring the return value when it isnt a webpack config, just assume the files were written to `.serverless/`
- [ ] Add the above described minimal packaging method, leveraging the sls@1.0 existing packaging infrastructure
    - This is subject to an ongoing discussion @ serverless thus may change implimentation



### REF
- https://github.com/asprouse/serverless-webpack-plugin/blob/master/index.js
- https://github.com/redbadger/serverless-webpack-plugin/blob/a9235521ef395513d48f6ca41bf6779744d8ebdb/1.0/src/index.js
