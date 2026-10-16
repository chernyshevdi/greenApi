import { request } from './client'
import { ApiError } from './errors'
import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetSettingsResponse,
  GetStateInstanceResponse,
  ReceivedNotification,
  SendMessageParams,
  SendMessageResponse,
} from './types'
import { RECEIVE_TIMEOUT_SEC } from './config'

export async function sendMessage(
  creds: Credentials,
  { chatId, message }: SendMessageParams,
  signal?: AbortSignal,
): Promise<SendMessageResponse> {
  const data = await request<SendMessageResponse>(creds, {
    method: 'POST',
    endpoint: 'sendMessage',
    body: { chatId, message },
    signal,
  })
  if (!data?.idMessage) throw new ApiError('unknown', 'Пустой ответ на отправку сообщения')
  return data
}

/**
 * Long-poll: ждёт до `receiveTimeout` секунд. Возвращает `null`, если уведомлений нет.
 * Уведомление нужно подтвердить через {@link deleteNotification}.
 */
export async function receiveNotification(
  creds: Credentials,
  signal?: AbortSignal,
  receiveTimeout: number = RECEIVE_TIMEOUT_SEC,
): Promise<ReceivedNotification | null> {
  const data = await request<ReceivedNotification>(creds, {
    method: 'GET',
    endpoint: 'receiveNotification',
    query: { receiveTimeout },
    signal,
  })
  return data && typeof data === 'object' && 'receiptId' in data ? data : null
}

export async function deleteNotification(
  creds: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<DeleteNotificationResponse | null> {
  return request<DeleteNotificationResponse>(creds, {
    method: 'DELETE',
    endpoint: 'deleteNotification',
    pathSuffix: String(receiptId),
    signal,
  })
}

/**
 * Определяет chatId по номеру телефона. chatId из номера не вычисляется,
 * поэтому для нового чата нужен этот метод. Номер — только цифры, в международном формате.
 */
export async function checkAccount(
  creds: Credentials,
  phoneNumber: string,
  signal?: AbortSignal,
): Promise<CheckAccountResponse> {
  if (!/^\d+$/.test(phoneNumber)) {
    throw new ApiError('validation', 'Номер должен содержать только цифры')
  }
  const data = await request<
    CheckAccountResponse & { status?: boolean; data?: { reason?: string } }
  >(creds, {
    method: 'POST',
    endpoint: 'checkAccount',
    body: { phoneNumber: Number(phoneNumber) },
    signal,
  })
  if (!data) throw new ApiError('unknown', 'Пустой ответ на проверку номера')
  if (data.status === false) {
    const reason = data.data?.reason
    throw new ApiError(
      reason === 'rate_limit_exceeded' ? 'rate_limit' : 'unknown',
      reason ?? 'Не удалось проверить номер (инстанс не авторизован?)',
    )
  }
  return data
}

/**
 * Состояние инстанса. Используется при входе, чтобы отличить неверные креды
 * (401/403) от неавторизованного в Telegram инстанса. Проверено на реальном инстансе
 * (`authorized`); остальные состояния описаны по документации.
 */
export async function getStateInstance(
  creds: Credentials,
  signal?: AbortSignal,
): Promise<GetStateInstanceResponse> {
  const data = await request<GetStateInstanceResponse>(creds, {
    method: 'GET',
    endpoint: 'getStateInstance',
    signal,
  })
  if (!data?.stateInstance) throw new ApiError('unknown', 'Пустой ответ о состоянии инстанса')
  return data
}

/** Настройки инстанса: нужны, чтобы заранее заметить выключенные входящие уведомления. */
export async function getSettings(
  creds: Credentials,
  signal?: AbortSignal,
): Promise<GetSettingsResponse> {
  const data = await request<GetSettingsResponse>(creds, {
    method: 'GET',
    endpoint: 'getSettings',
    signal,
  })
  if (!data || typeof data !== 'object') throw new ApiError('unknown', 'Пустой ответ с настройками')
  return data
}
