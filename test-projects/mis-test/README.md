# Overview

This project and related changes are to determine feasibility of generating Model Introspection Schema (MIS)
at/around synthesis time. So that it could be bundled into functions.

# Approach 1 - async pre synthesis

The idea here is that:

1. We disable auto synth, see [here](https://github.com/aws/aws-cdk/blob/5d9af0fb872a60f30a8cc1219016591c4c8c58f9/packages/aws-cdk-lib/core/lib/app.ts#L191-L196)
2. We replace auto synth with our own where additional phase is added, i.e.

   ```typescript
   const synth = async (): Promise<void> => {
     console.log('beforeSynth');
     for (const constructFactory of Object.values(constructFactories)) {
       if (constructFactory.beforeSynth) {
         await constructFactory.beforeSynth();
       }
     }
     app.synth();
   };

   process.once('beforeExit', () => void synth());
   ```

3. This allows to add additional pre synth, pre deployment phase.

An attempt to build and use it revealed that:

1. This could work if the goal was to produce MIS as an assert that is then persisted somewhere during deployment (S3)
2. This won't work for lambda code bundling as bundling appears to be happening well before synthesis.

We added a couple of `console.log` to determine feasibility of this approach (around synthesis and lambda code bundling).
It has produced the following log.

```shell
$ npx ampx sandbox --once

  Amplify Sandbox

  Identifier: 	<REDACTED>
  Stack: 	<REDACTED>

  To specify a different sandbox identifier, use --identifier
beforeBundling /asset-input /asset-output
afterBundling /asset-input /asset-output
beforeBundling /Users/sobkamil/git/amplify-backend /Users/<REDACTED>/git/amplify-backend/test-projects/mis-test/.amplify/artifacts/cdk.out/bundling-temp-1d85e6b59e4e652e19fe604f7f8a135f42c62e2a82f94fcbe79ebd3758abff3f
afterBundling /Users/sobkamil/git/amplify-backend /Users/<REDACTED>/git/amplify-backend/test-projects/mis-test/.amplify/artifacts/cdk.out/bundling-temp-1d85e6b59e4e652e19fe604f7f8a135f42c62e2a82f94fcbe79ebd3758abff3f
afterDefineBackend
beforeSynth

<REDACTED>

✨  Synthesis time: 0.02s
```

This logs says that:

1. Bundling happens synchronously inside `defineFunction`, i.e. through chain of synchronous function/ctor calls it reaches sync execution of child process that runs `esbuild`.
2. Bundling happens before `defineBackend` exists.
3. Bundling happens before synth and before potential "async pre-synth".

Effectively, we can't achieve the objective of async-generating MIS **and** bundling it into lambda this way.

See the diff [here](https://github.com/aws-amplify/amplify-backend/commit/12c0d60ba1fb83f70c9e0178086b9381ee7e2d7f) 

# Approach 2 - execaSync

In this case we are leveraging that fact that one can execute child process synchronously.
Schema generation running in child process will always complete before that process exits before giving control back
to parent.

This feels a bit hacky, but might be acceptable stop gap solution given that:
1. The content of child process's script depends only on `@aws-amplify/graphql-generator`
2. The content of child process's script can still be tested and compiled to assure correctness.
3. This "solution" can be hidden behind internal abstraction and wait for `@aws-amplify/graphql-generator` to offer sync API (if ever).

This approach yielded a working solution.

See the diff [here](https://github.com/aws-amplify/amplify-backend/commit/23a986e1dad55976681e8762a0b891bfd1455437)

# Test app

```shell
npm run clean && npm install && npm run build
npm link ./packages/cli ./packages/create-amplify
cd test-projects/mis-test
npx ampx sandbox --once
```
