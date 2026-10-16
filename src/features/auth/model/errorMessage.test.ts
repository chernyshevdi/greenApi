import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import type { ApiErrorKind, StateInstance } from '@/shared/api'
import { instanceStateMessage, loginErrorMessage } from './errorMessage'

describe('loginErrorMessage', () => {
  it.each<[ApiErrorKind, string]>([
    ['unauthorized', 'Неверный idInstance или apiTokenInstance'],
    ['forbidden', 'Доступ запрещён'],
    ['network', 'Не удалось связаться с сервером'],
    ['rate_limit', 'Слишком много запросов'],
    ['server', 'временно недоступен'],
  ])('%s', (kind, text) => {
    expect(loginErrorMessage(new ApiError(kind, 'raw'))).toContain(text)
  })

  it('falls back to the API message for other errors', () => {
    expect(loginErrorMessage(new ApiError('validation', 'Bad idInstance'))).toBe('Bad idInstance')
  })

  it('handles non-API errors', () => {
    expect(loginErrorMessage(new Error('x'))).toBe('Не удалось войти. Повторите попытку')
  })
})

describe('instanceStateMessage', () => {
  it.each<StateInstance>(['authorized', 'suspended'])('%s allows login', (state) => {
    expect(instanceStateMessage(state)).toBeNull()
  })

  it.each<[StateInstance, string]>([
    ['notAuthorized', 'не авторизован в Telegram'],
    ['pendingPassword', 'двухфакторной'],
    ['starting', 'запускается'],
    ['blocked', 'заблокирован'],
  ])('%s blocks login with a hint', (state, text) => {
    expect(instanceStateMessage(state)).toContain(text)
  })
})
