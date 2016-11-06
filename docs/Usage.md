# USAGE

Serverless build uses the `sls deploy` and `sls deploy function` CLI commands, overriding the standard build
functionality.

- [Configure serverless build](./Install%20&%20Config.md)
- [Configure serverless with AWS credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/)
- `sls deploy` to deploy your resources and all functions at once
- `sls invoke -l -f <fnName>` to invoke a deployed function
- `sls deploy function -f <fnName>` to deploy a single function
- `NODE_ENV=production sls deploy function -f <fnName>` when your build process cares about `process.env.NODE_ENV`

Try adding this to your npm scripts, to both deploy and run at once:
```json
{
    "scripts": {
        "function": "sls deploy function -f $FUNCTION && sls invoke -l -f $FUNCTION"
    }
}
```

And running `FUNCTION=myFn npm run function`

## TEST IT OUT

If you'd like to test out a preconfigured project...

```
git clone git@github.com:nfour/serverless-build-plugin
cd serverless-build-plugin
npm i
npm run build
npm link
cd test/1.0
npm link serverless-build-plugin

sls deploy
sls invoke -f one -l
sls deploy function -f two
sls invoke -f two -l
```

If you want to audit the built zip in a test run, add the `--no-deploy` option

```
sls deploy function -f two --no-deploy
```

Then check the `./.serverless/artifacts` directory
