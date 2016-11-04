# INSTALLATION

### Serverless 1.x.x

**Run:** `npm i --save serverless-build-plugin`

Add the plugin to `serverless.yml` under `plugins`

eg.
```yaml
service: my-service

provider:
  name: aws
  runtime: nodejs4.3

plugins:
  - serverless-build-plugin

package:
    exclude:
        - node_modules

functions:
  one:
    handler: functions/one/handler.handler
```

Then create the `serverless.build.yml` as per [Configuration](#configuration).

### Serverless 0.5.x

**Run:** `npm i --save serverless-build-plugin`

Modify `s-project.json` to add `serverless-build-plugin` to the plugins array.

ie.
```javascript
{
  "name": "example-serverless-project",
  "plugins": [
    "serverless-build-plugin"
  ],
  "description": "My Serverless Project",
  "version": "0.0.1",
  "profile": "serverless-v0.5.5"
}
```

Then create the `serverless.build.yml` as per [Configuration](#configuration).
