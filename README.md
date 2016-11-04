![Serverless Build Plugin](http://i.imgur.com/UfNQs5G.png)

A **Node.js** focused build plugin for serverless.

```yaml
# serverless.build.yml

method     : bundle
sourceMaps : true
babel      : true
uglify     : false

exclude:
  - "*" # Ignores the root directory

functions:
  one:
    include:
      - "functions/one/**"
      - "lib/one/**"
    exclude:
      - "**/*.json"

    modules:
      exclude:
        - lutils

modules:
  exclude: # Excluded from the root node_modules
    - aws-sdk
  deepExclude: # Excluded from deep nested node_modules
    - aws-sdk
```

## BUILD METHODS

### Method: `bundle`

- Node.JS optimized version of the [package](https://github.com/serverless/serverless/blob/master/docs/providers/aws/guide/packaging.md) built-in serverless plugin
- Per file transforms, with source maps:
  - **babel**
  - **uglify**
- Modules whitelisted based on the `package.json` `dependencies`, resolved recursively and reliably
- Glob based file matching for arbitrary files

### Method: `file`

- Use a build file to generate functions
- Use a `webpack.config.js` or a file which returns a webpack config

## DOCUMENTATION

- [Installation](./docs/Installation.md)
- [Usage & Configuration](./docs/Usage.md)


## TEST IT OUT

- Make sure you set an AWS profile first

```
git clone git@github.com/nfour/serverless-build-plugin
cd serverless-build-plugin
npm i
cd test/1.0

sls deploy
sls invoke -f one -l
sls deploy function -f two -l
sls invoke -f two -l
```
