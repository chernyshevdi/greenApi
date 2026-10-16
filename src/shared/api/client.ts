import { ApiError, isAbortError, kindFromStatus } from './errors'
import type { Credentials } from './types'

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE'
  /** Метод API, например `sendMessage`. Дополнительные сегменты идут после токена. */
  endpoint: string
  /** Сегменты пути после токена, например receiptId. */
  pathSuffix?: string
  query?: Record<string, string | number>
  body?: unknown
  signal?: AbortSignal
}

export function buildUrl(
  { apiUrl, idInstance, apiTokenInstance }: Credentials,
  { endpoint, pathSuffix, query }: Pick<RequestOptions, 'endpoint' | 'pathSuffix' | 'query'>,
): string {
  const base = apiUrl.replace(/\/+$/, '')
  const suffix = pathSuffix ? `/${pathSuffix}` : ''
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
    : ''
  return `${base}/waInstance${idInstance}/${endpoint}/${apiTokenInstance}${suffix}${qs}`
}

/**
 * Единая точка HTTP. Возвращает разобранный JSON или `null` для пустого тела
 * (так receiveNotification отвечает, когда уведомлений нет).
 */
export async function request<T>(creds: Credentials, options: RequestOptions): Promise<T | null> {
  const { method, body, signal } = options

  let response: Response
  try {
    response = await fetch(buildUrl(creds, options), {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (isAbortError(error)) throw new ApiError('aborted', 'Запрос отменён')
    throw new ApiError('network', 'Не удалось связаться с сервером GREEN-API')
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw new ApiError(
      kindFromStatus(response.status),
      extractMessage(data, response),
      response.status,
    )
  }
  return data as T | null
}

function extractMessage(data: unknown, response: Response): string {
  if (data && typeof data === 'object') {
    const { message, reason, error } = data as Record<string, unknown>
    for (const value of [message, reason, error]) {
      if (typeof value === 'string' && value) return value
    }
  }
  if (typeof data === 'string' && data) return data
  return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
}
