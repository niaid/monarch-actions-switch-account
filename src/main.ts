import * as core from '@actions/core'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import assert from 'assert'

// The max time that a GitHub action is allowed to run is 6 hours.
// That seems like a reasonable default to use if no role duration is defined.
const MAX_ACTION_RUNTIME = 6 * 3600;
const DEFAULT_ROLE_DURATION_FOR_OIDC_ROLES = 3600;
const USER_AGENT = 'configure-aws-credentials-for-github-actions';
const MAX_TAG_VALUE_LENGTH = 256;
const SANITIZATION_CHARACTER = '_';
const ROLE_SESSION_NAME = 'GitHubActions';
const REGION_REGEX = /^[a-z0-9-]+$/g;
const DEFAULT_REGION = 'us-east-1';
export const ALLOWED_ACCOUNTS = ['dev', 'qa', 'stage', 'prod', 'mgmt'];



export async function switchAccount(accountName: string) {
  // Get inputs
  const accessKeyId = core.getInput('aws-access-key-id', { required: false });
  const secretAccessKey = core.getInput('aws-secret-access-key', { required: false });
  const region = core.getInput('aws-region', { required: false });
  const sessionToken = core.getInput('aws-session-token', { required: false });
  const maskAccountId = core.getInput('mask-aws-account-id', { required: false });
  const roleToAssume = core.getInput('role-to-assume', {required: false});
  const roleExternalId = core.getInput('role-external-id', { required: false });
  let roleDurationSeconds = core.getInput('role-duration-seconds', {required: false}) || MAX_ACTION_RUNTIME;
  const roleSessionName = core.getInput('role-session-name', { required: false }) || ROLE_SESSION_NAME;
  const roleSkipSessionTaggingInput = core.getInput('role-skip-session-tagging', { required: false })|| 'false';
  const roleSkipSessionTagging = roleSkipSessionTaggingInput.toLowerCase() === 'true';
  const webIdentityTokenFile = core.getInput('web-identity-token-file', { required: false });

  assert(
    accountName,
    "Missing required input for account to switch to."
  );

  assert(
    ALLOWED_ACCOUNTS.includes(accountName),
    `Invalid account name '${accountName}'. Must be one of: ${ALLOWED_ACCOUNTS.join(', ')}`
  );

  // Do the actual work 
  const accountId = await getAccountIdViaSsm(accountName);
  const accountSession = await assumeAccountRole(accountId);
  exportCredentials(accountSession);
}

export async function createAwsSession() {
  return new STSClient({
    region: DEFAULT_REGION,
    customUserAgent: USER_AGENT
  });
}

export async function clearAssumedRole() {
  const emptyCreds = {
    AccessKeyId: '',
    SecretAccessKey: '',
    SessionToken: ''
  }

  exportCredentials(emptyCreds);

  // AWS SDK v3 doesn't have global config like v2
  // Return empty credentials to indicate cleared state
  return emptyCreds;
}

export async function assumeAccountRole(accountId: any){
  const origCreds = await clearAssumedRole();

  const sts = await createAwsSession();

  const roleToAssume = {
    RoleArn: `arn:aws:iam::${accountId}:role/cicd-runner-admin`,
    RoleSessionName: 'monarch-actions-switch-account',
    DurationSeconds: 900
  }

  const command = new AssumeRoleCommand(roleToAssume);
  const { Credentials } = await sts.send(command);
  if (!Credentials) {
    throw new Error('no credentials returned');
  }

  return Credentials
}

export async function getAccountIdViaSsm(accountName:string){
  const ssm = new SSMClient({
    region: DEFAULT_REGION
  });
  const paramName = `/monarch-ro/space-accounts/${accountName}`

  try {
    const command = new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    });
    const accountIdParam = await ssm.send(command);
    if (accountIdParam.Parameter){
      let accountId = accountIdParam.Parameter.Value
      return accountId;
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }  
}

export function exportCredentials(params:any) {
  // Configure the AWS CLI and AWS SDKs using environment variables and set them as secrets.
  // Setting the credentials as secrets masks them in Github Actions logs

  // AWS_DEFAULT_REGION and AWS_REGION:
  // Specifies the AWS Region to send requests to
  core.exportVariable('AWS_DEFAULT_REGION', DEFAULT_REGION);
  core.exportVariable('AWS_REGION', DEFAULT_REGION);

  // AWS_ACCESS_KEY_ID:
  // Specifies an AWS access key associated with an IAM user or role
  if (params.AccessKeyId) core.setSecret(params.AccessKeyId);
  core.exportVariable('AWS_ACCESS_KEY_ID', params.AccessKeyId);

  // AWS_SECRET_ACCESS_KEY:
  // Specifies the secret key associated with the access key. This is essentially the "password" for the access key.
  if (params.SecretAccessKey) core.setSecret(params.SecretAccessKey);
  core.exportVariable('AWS_SECRET_ACCESS_KEY', params.SecretAccessKey);

  // AWS_SESSION_TOKEN:
  // Specifies the session token value that is required if you are using temporary security credentials.
  if (params.SessionToken) {
    core.setSecret(params.SessionToken);
    core.exportVariable('AWS_SESSION_TOKEN', params.SessionToken);
  } else if (process.env.AWS_SESSION_TOKEN) {
    // clear session token from previous credentials action
    core.exportVariable('AWS_SESSION_TOKEN', '');
  }
}

async function run(): Promise<void> {
  try {
    //do account switch stuff
    const account: string = core.getInput('account')
    await switchAccount(account)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
