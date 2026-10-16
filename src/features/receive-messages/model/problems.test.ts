import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import { problemFromError, problemFromSettings } from './problems'

describe('problemFromError', () => {
  it('400 is a config problem and keeps the API reason', () => {
    const problem = problemFromError(new ApiError('validation', 'webhook url is set', 400))
    expect(problem.kind).toBe('config')
    expect(problem.message).toContain('webhook url is set')
    expect(problem.message).toContain('webhookUrl должен быть пустым')
  })

  it.each([
    [new ApiError('network', 'x'), 'network'],
    [new ApiError('rate_limit', 'x'), 'rate_limit'],
    [new ApiError('server', 'x'), 'server'],
    [new ApiError('unknown', 'x'), 'server'],
    [new Error('x'), 'server'],
  ])('maps %# to %s', (error, kind) => {
    expect(problemFromError(error).kind).toBe(kind)
  })
})

describe('problemFromSettings', () => {
  it('returns null for correct settings', () => {
    expect(problemFromSettings({ webhookUrl: '', incomingWebhook: 'yes' })).toBeNull()
  })

  it('flags a set webhookUrl (it wins over incomingWebhook)', () => {
    const problem = problemFromSettings({ webhookUrl: 'https://x', incomingWebhook: 'no' })
    expect(problem?.message).toContain('webhookUrl')
  })

  it('flags disabled incoming notifications', () => {
    const problem = problemFromSettings({ webhookUrl: '', incomingWebhook: 'no' })
    expect(problem?.kind).toBe('config')
    expect(problem?.message).toContain('incomingWebhook')
  })
})
