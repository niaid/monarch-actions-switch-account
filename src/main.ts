import * as core from '@actions/core'
import aws from 'aws-sdk'
import assert from 'assert'

// The max time that a GitHub action is allowed to run is 6 hours.
// That seems like a reasonable default to use if no role duration is defined.
// const MAX_ACTION_RUNTIME = 6 * 3600
const USER_AGENT = 'configure-aws-credentials-for-github-actions'
// const ROLE_SESSION_NAME = 'GitHubActions'
const DEFAULT_REGION = 'us-east-1'

async function switchAccount(accountName: string): Promise<void> {
  // Get inputs - these are unused but kept for potential future use
  // const accessKeyId = core.getInput('aws-access-key-id', {required: false})
  // const secretAccessKey = core.getInput('aws-secret-access-key', {
  //   required: false
  // })
  // const region = core.getInput('aws-region', {required: false})
  // const sessionToken = core.getInput('aws-session-token', {required: false})
  // const maskAccountId = core.getInput('mask-aws-account-id', {required: false})
  // const roleToAssume = core.getInput('role-to-assume', {required: false})
  // const roleExternalId = core.getInput('role-external-id', {required: false})
  // const roleDurationSeconds =
  //   core.getInput('role-duration-seconds', {required: false}) ||
  //   MAX_ACTION_RUNTIME
  // const roleSessionName =
  //   core.getInput('role-session-name', {required: false}) || ROLE_SESSION_NAME
  // const roleSkipSessionTaggingInput =
  //   core.getInput('role-skip-session-tagging', {required: false}) || 'false'
  // const roleSkipSessionTagging =
  //   roleSkipSessionTaggingInput.toLowerCase() === 'true'
  // const webIdentityTokenFile = core.getInput('web-identity-token-file', {
  //   required: false
  // })

  assert(accountName, 'Missing required input for account to switch to.')

  // Do the actual work
  const accountId = await getAccountIdViaSsm(accountName)
  const accountSession = await assumeAccountRole(accountId)
  exportCredentials(accountSession)
}

async function createAwsSession(): Promise<aws.STS> {
  return new aws.STS({
    region: DEFAULT_REGION,
    stsRegionalEndpoints: 'regional',
    customUserAgent: USER_AGENT
  })
}

async function clearAssumedRole(): Promise<aws.Credentials | null> {
  const emptyCreds: Partial<aws.STS.Credentials> = {
    AccessKeyId: '',
    SecretAccessKey: '',
    SessionToken: ''
  }

  exportCredentials(emptyCreds)

  aws.config.credentials = null

  return new Promise<aws.Credentials | null>((resolve, reject) => {
    aws.config.getCredentials(err => {
      if (err) {
        reject(err)
        return
      }
      resolve(aws.config.credentials as aws.Credentials | null)
    })
  })
}

async function assumeAccountRole(
  accountId: string
): Promise<aws.STS.Credentials> {
  await clearAssumedRole()

  const sts = await createAwsSession()

  const roleToAssume = {
    RoleArn: `arn:aws:iam::${accountId}:role/cicd-runner-admin`,
    RoleSessionName: 'monarch-actions-switch-account',
    DurationSeconds: 900
  }

  const {Credentials} = await sts.assumeRole(roleToAssume).promise()
  if (!Credentials) {
    throw new Error('no credentials returned')
  }

  return Credentials
}

async function getAccountIdViaSsm(accountName: string): Promise<string> {
  const ssm = new aws.SSM({
    region: DEFAULT_REGION
  })
  const paramName = `/monarch-ro/space-accounts/${accountName}`

  try {
    const accountIdParam = await ssm
      .getParameter({
        Name: paramName,
        WithDecryption: true
      })
      .promise()
    if (accountIdParam.Parameter?.Value) {
      return accountIdParam.Parameter.Value
    }
    throw new Error(`No account ID found for account: ${accountName}`)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
      throw error
    }
    throw new Error('Unknown error occurred')
  }
}

function exportCredentials(params: Partial<aws.STS.Credentials>): void {
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
