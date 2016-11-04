![Serverless Build Plugin](https://i.imgur.com/6ARU4Xm.png)

A **Node.js** focused build optimizer plugin for serverless.

```yaml
# serverless.build.yml

method     : bundle
sourceMaps : true
babel      : true
uglify     : false

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

exclude:
  - "*" # Ignores the root directory

modules:
  exclude: # Excluded from the root node_modules
    - aws-sdk
  deepExclude: # Excluded from deep nested node_modules
    - aws-sdk
```

## BUILD METHODS

### Method: `bundle`

- Node.JS optimized version of the [package](https://github.com/serverless/serverless/blob/master/docs/providers/aws/guide/packaging.md) built-in plugin
- Each file can be, optionally, transpiled with:
  - **babel**
  - **uglify**
  - **babeli** (soon, WIP)
- `node_modules` are whitelisted based on the `package.json` `dependencies`, resolved recursively and reliably

### Method: `file`

- Use a build file to generate functions entirely
- Use `webpack` instead, by exporting a webpack config

## DOCUMENTATION

_The documentation is currently WIP_

- [Installation](./docs/Installation.md)
- [Usage & Configuration](./docs/Usage.md)


## TEST IT OUT

- Make sure you set an AWS profile first

```
git clone git@github.com:nfour/serverless-build-plugin
cd serverless-build-plugin
npm i
cd test/1.0

sls deploy
sls invoke -f one -l
sls deploy function -f two -l
sls invoke -f two -l
```
