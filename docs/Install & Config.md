# INSTALLATION

Serverless build plugin is available as [an NPM module](https://www.npmjs.com/package/serverless-build-plugin).

```sh
yarn add --dev serverless-build-plugin
```

Once installed, add `serverless-build-plugin` to your serverless plugin registry.

## CONFIGURATION

Serverless build plugin can be configured by either or both of the following methods:

- Creating a `serverless.build.yml` file.
- Setting a `custom.build` section in your project's `serverless.yml`.

> If no configuration is found, defaults settings are used.

Serverless projects can be built using one of the following methods:

- [`bundle`](#bundle)
  - Bundle your functions - keeps their directory structure. Based on globbing and module dependency resolution.
- [`file`](#file)
  - Understands a `webpack.config.js`
  - Any file can be specified, as long as the default export is a function wich returns `Promise<string|Buffer|stream>`

See [test/1.0](../test/1.0) for an example project.

### `bundle`

The bundle build method.

- Node.JS optimized version of the [package](https://github.com/serverless/serverless/blob/master/docs/providers/aws/guide/packaging.md) built-in plugin.
- Each file can be optionally transpiled with:
  - **babel**
  - **uglify**
- `node_modules` are whitelisted based on the `package.json` `dependencies`, resolved recursively and reliably.

> To use `babeli`, add it to your .babelrc with the preset

```yaml
method: bundle

# babel
#
# Each file can be babel transpiled. When set to:
#   - An object, the object is parsed as babel configuration.
#   - `true`, a `.babelrc` in the service's directory is used as babel configuration.
#  Default is `null`.
babel: true

# Define core babel package
# Default is babel-core
babelCore: "babel-core"

# uglify
#
# To minify each file.
# Default is `false`.
uglify: false

# uglifyModules
#
# `node_modules` will be uglified. Requires `uglify` to be `true`.
uglifyModules: true

# uglifySource
#
# source will be uglified. Requires `uglify` to be `true`.
uglifySource: false

# sourceMaps
#
# Includes inline source maps for `babel` and `uglify`.
# Default is `true`.
sourceMaps: true

# functions
#
# Like the serverless.yml functions definition, but only for build options
functions:
  myFunction:
    # include
    #
    # An array of glob patterns to match against, including each file
    include:
      - functions/one/**
      - lib/one/**

    # exclude
    #
    # An array of glob patterns to exclude from the `include`
    exclude:
      - **/*.json

    modules:
      # modules.exclude
      #
      # Exclude specific node_modules for a function
      exclude:
        - lutils

      # modules.excludeDeep
      #
      # Exclude deeply nested node_modules for a function
      excludeDeep:
        - lutils

# include
#
# Included for all functions
include:
  - "someFolder"
# exclude
#
# Excluded for all functions
exclude:
  - "*" # Ignores the root directory
```

### `file`

The file build method.

- Use a build file to package functions
- Use `webpack`, by exporting a webpack config

```yaml
method: file

# tryFiles
#
# An array of file patterns to match against as a build file
# This allows you to prefer certain methods over others when
# selecting a build file.
tryFiles:
  - 'webpack.config.js'

# Customize your file extension for locating your entry points in webpack
# Eg. if using TypeScript, set it to `ts`, so that a functions handler of src/myStuff/handler.handler file resolves to ./src/myStuff/handler.ts
handlerEntryExt: 'js' 
```

The build file handles the `default export` with this logic:

- First resolves any `Function` or `Promise` to its value
- When `Object`:
  - Treat as a `webpack.config.js` config
  - Uses your projects version of `webpack` (peer dependency)
  - `externals` are recognizes as node_modules to bundle up seperately
  - `entry` can be used, and will be concat with the `handler.js`
  - Creates a `handler.js` and `handler.map.js` for the current function
- When `String` or `Buffer` or `ReadStream`:
  - Creates a `handler.js` for the current function
  - NOTE: Best to use a `ReadStream` for memory usage

Build files are triggered with these params:

```js
/**
 *  @param fnConfig {Object}
 *  @param serverlessBuild {ServerlessBuildPlugin}
 */
export default async function myBuildFn(fnConfig, serverlessBuild) {
  // ... do stuff, any stuff

  return "console.log('it works');"
}
```

### SHARED OPTIONS

```yaml
# modules
#
# Excluded node_modules for all functions (bundle or file methods)
modules:
  # modules.exclude
  #
  # Exclude specific node_modules
  exclude:
    - aws-sdk

  # modules.excludeDeep
  #
  # Exclude deeply nested node_modules
  deepExclude: # Excluded from deep nested node_modules
    - aws-sdk

# async
#
# When false, function builds will run in parellel
# This will distrupt logging consistancy.
synchronous: true

# zip
#
# Options to pass to the `archiver` zipping instances
zip:
  gzip: true
  gzipOptions: { level: 5 }

```
