import { generateModels } from '@aws-amplify/graphql-generator';
import { text } from 'node:stream/consumers';

const schema = await text(process.stdin);

const output = await generateModels({
  schema,
  target: 'introspection',
});

const introspectionSchema = Object.values(output)[0];

// This is by design to output result to console so the parent process can read it.
// eslint-disable-next-line no-console
console.log(introspectionSchema);
