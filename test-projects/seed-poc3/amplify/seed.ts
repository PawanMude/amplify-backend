import type { Schema } from './data/resource';

// This would be @aws-amplify/auth-admin-client in real implementation.
import { getAuthClient } from '@aws-amplify/backend-seed';

import { Amplify } from 'aws-amplify';
import * as auth from 'aws-amplify/auth';
import * as storage from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';

// TSX eats this but the compiler is unhappy about going up the directory hierarchy.
// Perhaps seed should live closer to outputs and frontend code rather than backend.
// @ts-ignore
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

// TODO typings for outputs could be better?
// This is really kind-of auth admin api SDK
const authClient = getAuthClient(outputs);

const dataClient = generateClient<Schema>();

await dataClient.models.Todo.create({
  content: `Todo@${Math.random().toString()}`,
});

const user1 = await authClient.createUser(
  `user${Math.random().toString()}@amazon.com`,
  `P@ssword${Math.random().toString()}`
);

const user2 = await authClient.createUser(
  `user${Math.random().toString()}@amazon.com`,
  `P@ssword${Math.random().toString()}`
);

await auth.signIn({
  username: user1.username,
  password: user1.password,
});

let response = await dataClient.models.Todo.create(
  {
    content: `Todo@${user1?.username ?? ''}@${Math.random().toString()}`,
  },
  {
    authMode: 'userPool',
  }
);
if (response.errors && response.errors.length > 0) {
  throw response.errors;
}

await auth.signOut();

await auth.signIn({
  username: user2.username,
  password: user2.password,
});

response = await dataClient.models.Todo.create(
  {
    content: `Todo@${user2?.username ?? ''}@${Math.random().toString()}`,
  },
  {
    authMode: 'userPool',
  }
);
if (response.errors && response.errors.length > 0) {
  throw response.errors;
}

const uploadTask = storage.uploadData({
  data: `Some Content ${Math.random().toString()}`,
  path: `foo/${Math.random().toString()}`,
});

await uploadTask.result;

const s3Items = await storage.list({
  path: 'foo/',
  options: {
    pageSize: 1000,
  },
});

console.log('######## S3 Items ########');
console.log(s3Items.items);
console.log('##########################');

await auth.signOut();

const todos = await dataClient.models.Todo.list({
  limit: 1000,
});

console.log('####### Data Items #######');
console.log(todos.data);
console.log('##########################');

const result = await dataClient.models.Todo2.create(
  {
    content: `Todo2@${Math.random().toString()}`,
  },
  { authMode: 'iam' }
);

console.log(JSON.stringify(result, null, 2));

const todos2 = await dataClient.models.Todo2.list({
  limit: 1000,
});

console.log('####### Data Items 2 #######');
console.log(todos2.data);
console.log('##########################');


// TODO: how can we use IAM creds with data client?? (and other clients?)

/**
 * ##########################
 * {
 *   "data": null,
 *   "errors": [
 *     {
 *       "message": "Unauthorized",
 *       "recoverySuggestion": "If you're calling an Amplify-generated API, make sure to set the \"authMode\" in generateClient({ authMode: '...' }) to the backend authorization rule's auth provider ('apiKey', 'userPool', 'iam', 'oidc', 'lambda')"
 *     }
 *   ]
 * }
 * ####### Data Items 2 #######
 * []
 * ##########################
 */
