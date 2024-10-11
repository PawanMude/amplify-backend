import { beforeEach, describe, it, mock } from 'node:test';
import { ReferenceAuthInitializer } from './reference_auth_initializer';
import { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { ReferenceAuthInitializerProps } from './reference_auth_initializer_types';
import assert from 'node:assert';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  DescribeUserPoolClientCommandOutput,
  DescribeUserPoolCommand,
  DescribeUserPoolCommandOutput,
  GetUserPoolMfaConfigCommand,
  GetUserPoolMfaConfigCommandOutput,
  ListIdentityProvidersCommand,
  ListIdentityProvidersCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  CognitoIdentityClient,
  DescribeIdentityPoolCommand,
  DescribeIdentityPoolCommandOutput,
  GetIdentityPoolRolesCommand,
  GetIdentityPoolRolesCommandOutput,
} from '@aws-sdk/client-cognito-identity';
import {
  IdentityPool,
  IdentityPoolRoles,
  IdentityProviders,
  MFAResponse,
  UserPool,
  UserPoolClient,
} from './sample_data';

const inputProperties: ReferenceAuthInitializerProps = {
  authRoleArn: 'arn:aws:iam::000000000000:role/service-role/ref-auth-role-1',
  unauthRoleArn: 'arn:aws:iam::000000000000:role/service-role/ref-unauth-role1',
  identityPoolId: 'us-east-1:sample-identity-pool-id',
  userPoolClientId: 'sampleUserPoolClientId',
  userPoolId: 'us-east-1_userpoolTest',
  region: 'us-east-1',
};
const customResourceEventCommon: Omit<
  CloudFormationCustomResourceEvent,
  'RequestType'
> = {
  ServiceToken: 'mockServiceToken',
  ResponseURL: 'mockPreSignedS3Url',
  StackId: 'mockStackId',
  RequestId: '123',
  LogicalResourceId: 'logicalId',
  ResourceType: 'AWS::CloudFormation::CustomResource',
  ResourceProperties: {
    ...inputProperties,
    ServiceToken: 'token',
  },
};
const createCfnEvent: CloudFormationCustomResourceEvent = {
  RequestType: 'Create',
  ...customResourceEventCommon,
};

const updateCfnEvent: CloudFormationCustomResourceEvent = {
  RequestType: 'Update',
  PhysicalResourceId: 'physicalId',
  OldResourceProperties: {
    ...inputProperties,
    ServiceToken: 'token',
  },
  ...customResourceEventCommon,
};

const deleteCfnEvent: CloudFormationCustomResourceEvent = {
  RequestType: 'Delete',
  PhysicalResourceId: 'physicalId',
  ...customResourceEventCommon,
};

const uuidMock = () => '00000000-0000-0000-0000-000000000000';
const identityProviderClient = new CognitoIdentityProviderClient();
const identityClient = new CognitoIdentityClient();
const expectedData = {
  userPoolId: 'us-east-1_userpoolTest',
  webClientId: 'sampleUserPoolClientId',
  identityPoolId: 'us-east-1:sample-identity-pool-id',
  signupAttributes: '["sub","email","name"]',
  usernameAttributes: '[]',
  verificationMechanisms: '["email"]',
  passwordPolicyMinLength: '10',
  passwordPolicyRequirements:
    '["REQUIRES_NUMBERS","REQUIRES_LOWERCASE","REQUIRES_UPPERCASE"]',
  mfaConfiguration: 'ON',
  mfaTypes: '["TOTP"]',
  socialProviders: '["FACEBOOK","GOOGLE","LOGIN_WITH_AMAZON"]',
  oauthCognitoDomain: 'ref-auth-userpool-1',
  allowUnauthenticatedIdentities: 'true',
  oauthScope: '["email","openid","phone"]',
  oauthRedirectSignIn: 'https://redirect.com,https://redirect2.com',
  oauthRedirectSignOut: 'https://anotherlogouturl.com,https://logouturl.com',
  oauthResponseType: 'code',
  oauthClientId: 'sampleUserPoolClientId',
};

void describe('ReferenceAuthInitializer', () => {
  let handler: ReferenceAuthInitializer;
  let describeUserPoolResponse: DescribeUserPoolCommandOutput;
  let getUserPoolMfaConfigResponse: GetUserPoolMfaConfigCommandOutput;
  let listIdentityProvidersResponse: ListIdentityProvidersCommandOutput;
  let describeUserPoolClientResponse: DescribeUserPoolClientCommandOutput;
  let describeIdentityPoolResponse: DescribeIdentityPoolCommandOutput;
  let getIdentityPoolRolesResponse: GetIdentityPoolRolesCommandOutput;
  beforeEach(() => {
    handler = new ReferenceAuthInitializer(
      identityClient,
      identityProviderClient,
      uuidMock
    );
    describeUserPoolResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      UserPool: UserPool,
    };
    getUserPoolMfaConfigResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      ...MFAResponse,
    };
    listIdentityProvidersResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      Providers: [...IdentityProviders],
    };
    describeUserPoolClientResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      UserPoolClient: UserPoolClient,
    };
    describeIdentityPoolResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      ...IdentityPool,
    };
    getIdentityPoolRolesResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      ...IdentityPoolRoles,
    };
    mock.method(
      identityProviderClient,
      'send',
      async (
        request:
          | DescribeUserPoolCommand
          | GetUserPoolMfaConfigCommand
          | ListIdentityProvidersCommand
          | DescribeUserPoolClientCommand
      ) => {
        if (request instanceof DescribeUserPoolCommand) {
          return describeUserPoolResponse;
        }
        if (request instanceof GetUserPoolMfaConfigCommand) {
          return getUserPoolMfaConfigResponse;
        }
        if (request instanceof ListIdentityProvidersCommand) {
          return listIdentityProvidersResponse;
        }
        if (request instanceof DescribeUserPoolClientCommand) {
          return describeUserPoolClientResponse;
        }
        return undefined;
      }
    );
    mock.method(
      identityClient,
      'send',
      async (
        request: DescribeIdentityPoolCommand | GetIdentityPoolRolesCommand
      ) => {
        if (request instanceof DescribeIdentityPoolCommand) {
          return describeIdentityPoolResponse;
        }
        if (request instanceof GetIdentityPoolRolesCommand) {
          return getIdentityPoolRolesResponse;
        }
        return undefined;
      }
    );
  });
  void it('handles create events', async () => {
    const result = await handler.handleEvent(createCfnEvent);
    assert.deepEqual(result.Status, 'SUCCESS');
    assert.equal(
      result.PhysicalResourceId,
      '00000000-0000-0000-0000-000000000000'
    );
    assert.deepEqual(result.Data, expectedData);
  });

  void it('handles update events', async () => {
    const result = await handler.handleEvent(updateCfnEvent);
    assert.deepEqual(result.Status, 'SUCCESS');
    assert.deepEqual(result.Data, expectedData);
  });

  void it('handles delete events', async () => {
    const result = await handler.handleEvent(deleteCfnEvent);
    assert.deepEqual(result.Status, 'SUCCESS');
  });

  void it('fails gracefully if fetching user pool fails', async () => {
    describeUserPoolResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
    };
    const result = await handler.handleEvent(createCfnEvent);
    assert.equal(result.Status, 'FAILED');
    assert.equal(result.Reason, 'Failed to retrieve the specified UserPool.');
  });

  void it('fails gracefully if user pool has no password policy', async () => {
    describeUserPoolResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      UserPool: {
        ...UserPool,
        Policies: undefined,
      },
    };
    const noPoliciesResult = await handler.handleEvent(createCfnEvent);
    assert.equal(noPoliciesResult.Status, 'FAILED');
    assert.equal(
      noPoliciesResult.Reason,
      'Failed to retrieve password policy.'
    );
  });

  void it('fails gracefully if fetching user pool MFA config fails', async () => {
    getUserPoolMfaConfigResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
    };
    const result = await handler.handleEvent(createCfnEvent);
    assert.equal(result.Status, 'FAILED');
    assert.equal(
      result.Reason,
      'Failed to retrieve the MFA configuration for the specified UserPool.'
    );
  });

  void it('fails gracefully if fetching user pool providers fails', async () => {
    listIdentityProvidersResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
      Providers: [],
    };
    const httpErrorResult = await handler.handleEvent(createCfnEvent);
    assert.equal(httpErrorResult.Status, 'FAILED');
    assert.equal(
      httpErrorResult.Reason,
      'An error occurred while retrieving identity providers for the user pool.'
    );
    listIdentityProvidersResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      Providers: undefined,
    };
    const undefinedProvidersResult = await handler.handleEvent(createCfnEvent);
    assert.equal(undefinedProvidersResult.Status, 'FAILED');
    assert.equal(
      undefinedProvidersResult.Reason,
      'An error occurred while retrieving identity providers for the user pool.'
    );
  });

  void it('fails gracefully if fetching user pool client fails', async () => {
    describeUserPoolClientResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
    };
    const result = await handler.handleEvent(createCfnEvent);
    assert.equal(result.Status, 'FAILED');
    assert.equal(
      result.Reason,
      'An error occurred while retrieving the user pool client details.'
    );
    describeUserPoolClientResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      UserPoolClient: undefined,
    };
    const undefinedUserPoolClientResult = await handler.handleEvent(
      createCfnEvent
    );
    assert.equal(undefinedUserPoolClientResult.Status, 'FAILED');
    assert.equal(
      undefinedUserPoolClientResult.Reason,
      'An error occurred while retrieving the user pool client details.'
    );
  });

  void it('fails gracefully if fetching identity pool fails', async () => {
    describeIdentityPoolResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
      IdentityPoolId: undefined,
      IdentityPoolName: undefined,
      AllowUnauthenticatedIdentities: undefined,
    };
    const result = await handler.handleEvent(createCfnEvent);
    assert.equal(result.Status, 'FAILED');
    assert.equal(
      result.Reason,
      'An error occurred while retrieving the identity pool details.'
    );
    describeIdentityPoolResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      IdentityPoolId: undefined,
      IdentityPoolName: undefined,
      AllowUnauthenticatedIdentities: undefined,
    };
    const undefinedIdentityPoolIdResult = await handler.handleEvent(
      createCfnEvent
    );
    assert.equal(undefinedIdentityPoolIdResult.Status, 'FAILED');
    assert.equal(
      undefinedIdentityPoolIdResult.Reason,
      'An error occurred while retrieving the identity pool details.'
    );
  });

  void it('fails gracefully if fetching identity pool roles fails', async () => {
    getIdentityPoolRolesResponse = {
      $metadata: {
        httpStatusCode: 500,
      },
    };
    const result = await handler.handleEvent(createCfnEvent);
    assert.equal(result.Status, 'FAILED');
    assert.equal(
      result.Reason,
      'An error occurred while retrieving the roles for the identity pool.'
    );
    getIdentityPoolRolesResponse = {
      $metadata: {
        httpStatusCode: 200,
      },
      Roles: undefined,
    };
    const undefinedIdentityPoolIdResult = await handler.handleEvent(
      createCfnEvent
    );
    assert.equal(undefinedIdentityPoolIdResult.Status, 'FAILED');
    assert.equal(
      undefinedIdentityPoolIdResult.Reason,
      'An error occurred while retrieving the roles for the identity pool.'
    );
  });
});
