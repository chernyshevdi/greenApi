import { ApiError } from '@/shared/api'
import type { StateInstance } from '@/shared/api'

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'Неверный idInstance или apiTokenInstance'
      case 'forbidden':
        return 'Доступ запрещён. Проверьте idInstance, apiTokenInstance и apiUrl'
      case 'network':
        return 'Не удалось связаться с сервером. Проверьте apiUrl и интернет-соединение'
      case 'rate_limit':
        return 'Слишком много запросов. Повторите позже'
      case 'server':
        return 'Сервер GREEN-API временно недоступен. Повторите позже'
      default:
        return error.message
    }
  }
  return 'Не удалось войти. Повторите попытку'
}

/** Сообщение, если креды верны, но инстанс не готов к работе; `null` — можно входить. */
export function instanceStateMessage(state: StateInstance): string | null {
  switch (state) {
    case 'authorized':
    case 'suspended': // получение сообщений работает, ограничена только отправка
      return null
    case 'notAuthorized':
      return 'Инстанс не авторизован в Telegram. Авторизуйте его в личном кабинете GREEN-API (QR-код)'
    case 'pendingPassword':
      return 'Инстансу нужен пароль двухфакторной авторизации Telegram. Завершите авторизацию в личном кабинете'
    case 'starting':
      return 'Инстанс запускается (до 5 минут). Повторите попытку позже'
    case 'blocked':
      return 'Инстанс заблокирован'
  }
}
