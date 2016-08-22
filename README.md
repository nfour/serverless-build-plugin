# SERVERLESS BUILD PLUGIN

`*** WARNING ***` This is a development release, do not use outside of experimentation.

This plugin is intended to add flexibility to the serverless build process for serverless 1.0.

Currently in testing state. To run:
```
npm i
cd test
npm i
export AWS_PROFILE=default
sls deploy --method=babel --function=one
```

## BUILD METHODS

There are two ways to build:
- **Bundling**
    - This will preserve the existing source filestructure and potentially any non-excluded files.
    - Optionally, each JS file in babel'ed and uglified individually
- **Build Files**
    - With this method, specify a file (or let it default)
    - The file can return a string, a stream or a webpack.config.js
    - If the file exports a default function, its return value will instead be used as above
    - Webpack configs will be executed, and their output injected into the zip
    - Strings & streams will be piped into a `handler.js`

## CONFIGURATION

There are three ways to configure the plugin:
- Create a `serverless.build.yml` inside the project directory
- Populate `custom.build` in `serverless.yml`
- The commandline
    - `sls deploy --keep`, keep build files and artifacts, do not purge.
    - `sls deploy --build=./buildFile.js`
    - `sls deploy --bundle` use bundling instead of a build file.

## ROADBLOCKS
- serverless 1.0 still doesn't support packaging single functions
    - See: [#1719](https://github.com/serverless/serverless/issues/1719) & [#1777](https://github.com/serverless/serverless/issues/1777)

## TODO
- [ ] Test webpack building, get parity with `severless-webpack-plugin`
    - [x] Webpack builds hanlder and source map
    - [x] Purges existing build folder (as an option)
    - [x] Externals are copied over
        - Will be fixed when bundle is combined
    - [ ] Ensure parity

- [x] Combine both `buildFile` and `bundle` into one, as bundle will need a build method anyway. Not orthoganal.
- [ ] node_modules packaging
    - [x] Copys them over
        - [x] Nested deps too
    - [x] Purges existing build folder
    - [x] Cleanup
    - [ ] Minify .js

- [x] Create a babel default build method, like webpack, for the servicePath
    - [x] Figure out file include and ignoring to ensure minimal builds on a per function basis
        - [ ] Option 1: Use multiple `.serverless-(ignore|include)` that function like .gitignore files
        - [x] Option 2: Use a `serverless.build.yml`
            - Specify the build options for each function individually, including root options
            - Can then seperate function includes in a clear way, with both regexp and globs

    - [x] Minify .js
