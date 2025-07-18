import {expect, test, jest, describe, beforeEach} from '@jest/globals'
import {
  switchAccount,
  getAccountIdViaSsm,
  assumeAccountRole,
  ALLOWED_ACCOUNTS,
  exportCredentials
} from '../src/main'
import type {GetParameterCommandOutput} from '@aws-sdk/client-ssm'
import type {AssumeRoleCommandOutput} from '@aws-sdk/client-sts'
import * as core from '@actions/core'

// Mock AWS SDK v3
const mockSTSSend = jest.fn() as jest.MockedFunction<
  (command: any) => Promise<AssumeRoleCommandOutput>
>
const mockSSMSend = jest.fn() as jest.MockedFunction<
  (command: any) => Promise<GetParameterCommandOutput>
>

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({
    send: mockSTSSend
  })),
  AssumeRoleCommand: jest.fn()
}))

jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: mockSSMSend
  })),
  GetParameterCommand: jest.fn()
}))

// Mock @actions/core
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn(),
  setSecret: jest.fn()
}))

describe('switchAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock getInput to return empty values by default
    ;(core.getInput as jest.Mock).mockReturnValue('')
  })

  test('validates account name', async () => {
    await expect(switchAccount('invalid')).rejects.toThrow(
      'Invalid account name'
    )
  })

  test('accepts valid account names', () => {
    expect(ALLOWED_ACCOUNTS).toContain('dev')
    expect(ALLOWED_ACCOUNTS).toContain('qa')
    expect(ALLOWED_ACCOUNTS).toContain('stage')
    expect(ALLOWED_ACCOUNTS).toContain('prod')
    expect(ALLOWED_ACCOUNTS).toContain('mgmt')
  })

  test('successfully switches account', async () => {
    // Mock SSM response
    mockSSMSend.mockResolvedValue({
      Parameter: {Value: '123456789012'}
    } as GetParameterCommandOutput)

    // Mock STS response
    const mockCredentials = {
      AccessKeyId: 'AKIATEST',
      SecretAccessKey: 'secret',
      SessionToken: 'token'
    }
    mockSTSSend.mockResolvedValue({
      Credentials: mockCredentials
    } as AssumeRoleCommandOutput)

    await switchAccount('dev')

    expect(mockSSMSend).toHaveBeenCalled()
    expect(mockSTSSend).toHaveBeenCalled()
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_DEFAULT_REGION',
      'us-east-1'
    )
    expect(core.exportVariable).toHaveBeenCalledWith('AWS_REGION', 'us-east-1')
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_ACCESS_KEY_ID',
      'AKIATEST'
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SECRET_ACCESS_KEY',
      'secret'
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SESSION_TOKEN',
      'token'
    )
    expect(core.setSecret).toHaveBeenCalledWith('AKIATEST')
    expect(core.setSecret).toHaveBeenCalledWith('secret')
    expect(core.setSecret).toHaveBeenCalledWith('token')
  })
})

describe('getAccountIdViaSsm', () => {
  test('retrieves account ID from SSM', async () => {
    mockSSMSend.mockResolvedValue({
      Parameter: {Value: '123456789012'}
    } as GetParameterCommandOutput)

    const result = await getAccountIdViaSsm('dev')
    expect(result).toBe('123456789012')
    expect(mockSSMSend).toHaveBeenCalled()
  })

  test('handles SSM parameter not found', async () => {
    mockSSMSend.mockResolvedValue({
      Parameter: undefined
    } as GetParameterCommandOutput)

    const result = await getAccountIdViaSsm('dev')
    expect(result).toBeUndefined()
    expect(mockSSMSend).toHaveBeenCalled()
  })

  test('handles SSM error', async () => {
    const error = new Error('Parameter not found')
    mockSSMSend.mockRejectedValue(error)

    await getAccountIdViaSsm('dev')
    expect(core.setFailed).toHaveBeenCalledWith('Parameter not found')
  })
})

describe('assumeAccountRole', () => {
  test('assumes role and returns credentials', async () => {
    const mockCredentials = {
      AccessKeyId: 'AKIATEST',
      SecretAccessKey: 'secret',
      SessionToken: 'token'
    }

    mockSTSSend.mockResolvedValue({
      Credentials: mockCredentials
    } as AssumeRoleCommandOutput)

    const result = await assumeAccountRole('123456789012')
    expect(result).toEqual(mockCredentials)
    expect(mockSTSSend).toHaveBeenCalled()
  })

  test('throws error when no credentials returned', async () => {
    mockSTSSend.mockResolvedValue({
      Credentials: undefined
    } as AssumeRoleCommandOutput)

    await expect(assumeAccountRole('123456789012')).rejects.toThrow(
      'no credentials returned'
    )
  })
})

describe('exportCredentials', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock process.env
    delete process.env.AWS_SESSION_TOKEN
  })

  test('exports credentials with all values', () => {
    const params = {
      AccessKeyId: 'AKIATEST',
      SecretAccessKey: 'secret',
      SessionToken: 'token'
    }

    exportCredentials(params)

    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_DEFAULT_REGION',
      'us-east-1'
    )
    expect(core.exportVariable).toHaveBeenCalledWith('AWS_REGION', 'us-east-1')
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_ACCESS_KEY_ID',
      'AKIATEST'
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SECRET_ACCESS_KEY',
      'secret'
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SESSION_TOKEN',
      'token'
    )
    expect(core.setSecret).toHaveBeenCalledWith('AKIATEST')
    expect(core.setSecret).toHaveBeenCalledWith('secret')
    expect(core.setSecret).toHaveBeenCalledWith('token')
  })

  test('exports credentials without session token', () => {
    const params = {
      AccessKeyId: 'AKIATEST',
      SecretAccessKey: 'secret'
    }

    exportCredentials(params)

    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_ACCESS_KEY_ID',
      'AKIATEST'
    )
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SECRET_ACCESS_KEY',
      'secret'
    )
    expect(core.setSecret).toHaveBeenCalledWith('AKIATEST')
    expect(core.setSecret).toHaveBeenCalledWith('secret')
    expect(core.setSecret).not.toHaveBeenCalledWith(undefined)
  })

  test('clears session token when previous one exists', () => {
    process.env.AWS_SESSION_TOKEN = 'previous-token'

    const params = {
      AccessKeyId: 'AKIATEST',
      SecretAccessKey: 'secret'
    }

    exportCredentials(params)

    expect(core.exportVariable).toHaveBeenCalledWith('AWS_SESSION_TOKEN', '')
  })

  test('handles empty credentials', () => {
    const params = {
      AccessKeyId: '',
      SecretAccessKey: '',
      SessionToken: ''
    }

    exportCredentials(params)

    expect(core.exportVariable).toHaveBeenCalledWith('AWS_ACCESS_KEY_ID', '')
    expect(core.exportVariable).toHaveBeenCalledWith(
      'AWS_SECRET_ACCESS_KEY',
      ''
    )
    expect(core.setSecret).not.toHaveBeenCalled()
  })
})
