# Monarch Actions Switch Account

A GitHub Action that switches AWS credentials to enable authentication between different Monarch Spaces accounts. This action assumes IAM roles in target accounts and exports the credentials as environment variables for use in subsequent workflow steps.

## Usage

```yaml
- name: Switch to target account
  uses: niaid/monarch-actions-switch-account@v2
  with:
    account: 'prod'  # Must be one of: dev, qa, stage, prod, mgmt
```

The action will:
1. Look up the AWS account ID from SSM Parameter Store at `/monarch-ro/space-accounts/{account}`
2. Assume the `cicd-runner-admin` role in the target account
3. Export AWS credentials as environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`)

### Requirements

- The workflow must have permission to access SSM Parameter Store in the source account
- The target account must have a `cicd-runner-admin` role that trusts the source account
- The account name must be one of: `dev`, `qa`, `stage`, `prod`, or `mgmt`
- The account name must exist as a parameter in SSM at `/monarch-ro/space-accounts/{account}`

### Example Workflow

```yaml
name: Deploy to Monarch Space
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Switch to production account
      uses: niaid/monarch-actions-switch-account@v2
      with:
        account: 'prod'
    
    - name: Deploy application
      run: |
        # Your deployment commands here
        # AWS CLI will automatically use the switched credentials
        aws s3 ls
```

---

## Development

This is a TypeScript GitHub Action built with the GitHub Actions toolkit.

## Create an action from this template

Click the `Use this Template` and provide the new repo details for your action

## Code in Main

> First, you'll need to have a reasonably modern version of `node` handy. This won't work with versions older than 9, for instance.

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```

## Change action.yml

The action.yml defines the inputs and output for your action.

Update the action.yml with your name, description, inputs and outputs for your action.

See the [documentation](https://help.github.com/en/articles/metadata-syntax-for-github-actions)

## Change the Code

Most toolkit and CI/CD operations involve async operations so the action is run in an async function.

```javascript
import * as core from '@actions/core';
...

async function run() {
  try { 
      ...
  } 
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
```

See the [toolkit documentation](https://github.com/actions/toolkit/blob/master/README.md#packages) for the various packages.

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v2
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Validate

You can now validate the action by referencing `./` in a workflow in your repo (see [test.yml](.github/workflows/test.yml))

```yaml
uses: ./
with:
  milliseconds: 1000
```

See the [actions tab](https://github.com/actions/typescript-action/actions) for runs of this action! :rocket:

## Usage:

After testing you can [create a v2 tag](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md) to reference the stable and latest v2 action
