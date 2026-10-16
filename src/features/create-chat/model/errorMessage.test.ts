import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import type { ApiErrorKind } from '@/shared/api'
import { createChatErrorMessage } from './errorMessage'

describe('createChatErrorMessage', () => {
  it.each<[ApiErrorKind, string]>([
    ['unauthorized', 'Нет доступа к инстансу'],
    ['forbidden', 'Нет доступа к инстансу'],
    ['network', 'Не удалось связаться с сервером'],
    ['rate_limit', 'Слишком много проверок'],
    ['server', 'временно недоступны'],
  ])('%s', (kind, text) => {
    expect(createChatErrorMessage(new ApiError(kind, 'raw'))).toContain(text)
  })

  it('falls back to the API message', () => {
    expect(createChatErrorMessage(new ApiError('validation', 'Bad phone'))).toBe('Bad phone')
  })

  it('handles non-API errors', () => {
    expect(createChatErrorMessage(new Error('x'))).toBe('Не удалось создать чат. Повторите попытку')
  })
})
