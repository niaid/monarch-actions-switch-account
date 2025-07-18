import * as core from '@actions/core'
import {STSClient, AssumeRoleCommand} from '@aws-sdk/client-sts'
import {SSMClient, GetParameterCommand} from '@aws-sdk/client-ssm'
import assert from 'assert'

const USER_AGENT = 'configure-aws-credentials-for-github-actions'
const DEFAULT_REGION = 'us-east-1'
export const ALLOWED_ACCOUNTS = ['dev', 'qa', 'stage', 'prod', 'mgmt']

export async function switchAccount(accountName: string): Promise<void> {
  assert(accountName, 'Missing required input for account to switch to.')

  assert(
    ALLOWED_ACCOUNTS.includes(accountName),
    `Invalid account name '${accountName}'. Must be one of: ${ALLOWED_ACCOUNTS.join(
      ', '
    )}`
  )

  // Do the actual work
  const accountId = await getAccountIdViaSsm(accountName)
  if (!accountId) {
    throw new Error(`Could not retrieve account ID for ${accountName}`)
  }
  const accountSession = await assumeAccountRole(accountId)
  exportCredentials(accountSession)
}

export async function createAwsSession(): Promise<STSClient> {
  return new STSClient({
    region: DEFAULT_REGION,
    customUserAgent: USER_AGENT
  })
}

export async function clearAssumedRole(): Promise<{
  AccessKeyId: string
  SecretAccessKey: string
  SessionToken: string
}> {
  const emptyCreds = {
    AccessKeyId: '',
    SecretAccessKey: '',
    SessionToken: ''
  }

  exportCredentials(emptyCreds)

  // AWS SDK v3 doesn't have global config like v2
  // Return empty credentials to indicate cleared state
  return emptyCreds
}

export async function assumeAccountRole(accountId: string): Promise<{
  AccessKeyId?: string
  SecretAccessKey?: string
  SessionToken?: string
}> {
  await clearAssumedRole()

  const sts = await createAwsSession()

  const roleToAssume = {
    RoleArn: `arn:aws:iam::${accountId}:role/cicd-runner-admin`,
    RoleSessionName: 'monarch-actions-switch-account',
    DurationSeconds: 900
  }

  const command = new AssumeRoleCommand(roleToAssume)
  const {Credentials} = await sts.send(command)
  if (!Credentials) {
    throw new Error('no credentials returned')
  }

  return Credentials
}

export async function getAccountIdViaSsm(
  accountName: string
): Promise<string | undefined> {
  const ssm = new SSMClient({
    region: DEFAULT_REGION
  })
  const paramName = `/monarch-ro/space-accounts/${accountName}`

  try {
    const command = new GetParameterCommand({
      Name: paramName,
      WithDecryption: true
    })
    const accountIdParam = await ssm.send(command)
    if (accountIdParam.Parameter) {
      const accountId = accountIdParam.Parameter.Value
      return accountId
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export function exportCredentials(params: {
  AccessKeyId?: string
  SecretAccessKey?: string
  SessionToken?: string
}): void {
  // Configure the AWS CLI and AWS SDKs using environment variables and set them as secrets.
  // Setting the credentials as secrets masks them in Github Actions logs

  // AWS_DEFAULT_REGION and AWS_REGION:
  // Specifies the AWS Region to send requests to
  core.exportVariable('AWS_DEFAULT_REGION', DEFAULT_REGION)
  core.exportVariable('AWS_REGION', DEFAULT_REGION)

  // AWS_ACCESS_KEY_ID:
  // Specifies an AWS access key associated with an IAM user or role
  if (params.AccessKeyId) core.setSecret(params.AccessKeyId)
  core.exportVariable('AWS_ACCESS_KEY_ID', params.AccessKeyId)

  // AWS_SECRET_ACCESS_KEY:
  // Specifies the secret key associated with the access key. This is essentially the "password" for the access key.
  if (params.SecretAccessKey) core.setSecret(params.SecretAccessKey)
  core.exportVariable('AWS_SECRET_ACCESS_KEY', params.SecretAccessKey)

  // AWS_SESSION_TOKEN:
  // Specifies the session token value that is required if you are using temporary security credentials.
  if (params.SessionToken) {
    core.setSecret(params.SessionToken)
    core.exportVariable('AWS_SESSION_TOKEN', params.SessionToken)
  } else if (process.env.AWS_SESSION_TOKEN) {
    // clear session token from previous credentials action
    core.exportVariable('AWS_SESSION_TOKEN', '')
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
