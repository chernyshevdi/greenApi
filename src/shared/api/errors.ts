export type ApiErrorKind =
  | 'unauthorized' // 401: неверные idInstance/apiTokenInstance
  | 'forbidden' // 403: нет доступа / аккаунт ограничен
  | 'validation' // 400: неверные параметры
  | 'rate_limit' // 429/469 или rate_limit_exceeded
  | 'server' // 5xx
  | 'network' // нет соединения/CORS
  | 'aborted' // запрос отменён через AbortSignal
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 400) return 'validation'
  if (status === 429 || status === 469) return 'rate_limit'
  if (status >= 500) return 'server'
  return 'unknown'
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
