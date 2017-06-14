# USAGE

Serverless build uses the `sls deploy` and `sls deploy function` CLI commands, overriding the standard build
functionality.

- [Configure serverless build](./Install%20&%20Config.md)
- [Configure serverless with AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)
- `sls deploy` to deploy your resources and all functions at once
- `sls invoke -l -f <fnName>` to invoke a deployed function
- `sls deploy function -f <fnName>` to deploy a single function
- `NODE_ENV=production sls deploy function -f <fnName>` when your build process cares about `process.env.NODE_ENV`

## TEST IT OUT

If you'd like to test out a preconfigured project...

```
git clone git@github.com:nfour/serverless-build-plugin
cd serverless-build-plugin
yarn
yarn build
yarn link
cd test/1.0
yarn
yarn link serverless-build-plugin

sls deploy
sls invoke -f one -l
sls deploy function -f two
sls invoke -f two -l
```

If you want to audit the built zip, run:

```
sls package
```

Then check the `.serverless/artifacts` directory
