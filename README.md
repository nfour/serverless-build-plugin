# SERVERLESS BUILD PLUGIN

`*** WARNING ***` This is a `beta` release under heavy development, use with caution.

This plugin is intended to add flexibility to the serverless build process for nodejs, under serverless 1.0 including an 0.5 compatibility layer thanks to [zyrorl](http://github.com/zyrorl).

Currently in testing state. To try it:
```
npm i
cd test
npm i
export AWS_PROFILE=default
sls deploy
sls deploy function -f one
sls invoke -f one --log
sls deploy function -f one --method=file
sls invoke -f one --log
```

After running the above you should have built the same function in each of the two methods successfully.

## METHODS

There are two ways to build:
- **Bundling**
    - This will preserve the existing source filestructure and potentially any non-excluded files.
    - Optionally, each JS file in babel'ed and uglified individually
- **Build Files**
    - With this method, specify a file (or let it default to a `webpack.config.js`)
    - The file can return a string, a stream or a `webpack.config.js` object
    - If the file exports a default function, its return value will instead be used, as above
    - Webpack configs will be executed, and their output injected into the zip, including `externals` modules
    - Strings & streams will be piped into a `handler.js`

## CONFIGURATION

There are three ways to configure the plugin:
- Create a `serverless.build.yml` inside the project directory
- Populate `custom.build` in `serverless.yml`
- The commandline
    - `sls deploy function -f one --file=./buildFile.js`

```yaml
# ./serverless.build.yml

method: "bundle"

sourceMaps : true
babel      : true # Will use ./.babelrc
uglify     : true # Will use defaults

exclude:
  - "*" # Ignores the root directory

modules:
  exclude: # excluded from the root node_modules
    - aws-sdk

  deepExclude: # excluded from nested node_modules
    - aws-sdk

functions:
  one:
    include:
      - "functions/one/**"
      - "lib/one/**"

    exclude:
      - "**/*.json"
```


### OPTIONS
- `babel`
    - Can be `true`, will search for a `.babelrc` in the project directory
    - Can be a babelrc-like object
- `uglify`
    - When `true`, will uglify source & modules
    - Can be an options object, passed to uglify
- `method`
    - When `bundle`, will use bundling method
    - When `file`, will use a build file or webpack config
- `file`
    - Path to a build file or webpack config

## ROADBLOCKS
- serverless 1.0 still doesn't support packaging single functions
    - [#1719](https://github.com/serverless/serverless/issues/1719)
    - [#1777](https://github.com/serverless/serverless/issues/1777)
- `sls deploy` will currently take a while due to packaging everything for the first deployment.
    - This is a bug due to not being able to hook into it.

## TODO
- [x] Serverless@0.5 support
- [ ] `sls deploy` currently broken
    - Awaiting upstream bug fix
- [ ] Make ServerlessBuildPlugin work on a per-function workflow
    - Awaiting upstream pull requests
- [x] Bundling based builds
    - [x] Source code
        - [x] Minified with uglifyjs, includes .map
        - [x] Babelifie, includes .map
    - [x] node_modules
        - [x] Recursive resolution of non-dev dependencies
            - [x] Also includes "meta" packages
        - [x] Minified with uglifyjs
- [x] File based builds
    - [x] Webpack
        - [x] Partiy with `severless-webpack-plugin`
        - [x] External node_modules are included
    - [x] Build files
        - [x] Can inherit a webpack config
        - [x] Can pipe buffers and streams to a handler.js
- [x] Performs cleanup
- [ ] Optimizations & refactors
    - [x] Refactor out the plugin inheritence dependency
        - [x] ModuleBundler
        - [x] SourceBundler
        - [x] FileBuild
        - [x] Webpack
        - [x] Babel
        - [x] Uglify
    - [ ] Use serverless' built in yaml parser (which resolve recursively)
        - Requires an intialization step
    - [ ] Change transforms to write to file instead of memory
        - This could bloat memory quite a bit as it stands
    - [ ] Make `webpack` and `babel-core` peer dependencies
    - [ ] Inline source maps for uglifyjs
