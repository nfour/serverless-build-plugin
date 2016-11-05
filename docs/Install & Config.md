# INSTALLATION
```
npm i --save serverless-build-plugin
```

Then add `serverless-build-plugin` to your serverless plugin registry

## CONFIGURATION

Serverless build can be configured in two locations (or both):

- Use a `serverless.build.yml`
- Use `custom.build` in your `serverless.yml`

There are two ways to build:
- `bundle`, this will bundle your functions and keep their directory structure based on globbing and module dependency resolution
- `file`, this can be a `webpack.config.js` or any file which builds your functions, allowing fexibility

See [test/1.0](./test/1.0) for an example project.

### BUNDLE METHOD CONFIG

- Node.JS optimized version of the [package](https://github.com/serverless/serverless/blob/master/docs/providers/aws/guide/packaging.md) built-in plugin
- Each file can be, optionally, transpiled with:
  - **babel**
  - **uglify**
  - **babeli** (soon, WIP)
  - _custom transforms_ (soon, WIP)
- `node_modules` are whitelisted based on the `package.json` `dependencies`, resolved recursively and reliably

```yaml
method: bundle

# babel
#
# Each file can be babel transpiled:
# - When this is an object, it is treated as a babel config
# - When true, a `.babelrc` in the service directory is used
babel: true

# uglify
#
# To minify each file.
uglify: false

# uglifyModules
#
# node_modules will be uglified.
# - Requires `uglify` to be true.
uglifyModules: true

# uglifySource
#
# source will be uglified
# - Requires `uglify` to be true.
uglifySource: false

# sourceMaps
#
# Includes inline source maps for `babel` and `uglify`
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

### FILE METHOD CONFIG

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
# Options to pass to the `yazl` zipping instances
zip:
  compress: true
```
