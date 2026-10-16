import { ApiError } from '@/shared/api'

export const PHONE_HINT = 'Номер в международном формате, например 79876543210'
export const NOT_FOUND_MESSAGE = 'Номер не найден в Telegram'

export function createChatErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'unauthorized':
      case 'forbidden':
        return 'Нет доступа к инстансу. Выйдите и войдите заново'
      case 'network':
        return 'Не удалось связаться с сервером. Проверьте интернет-соединение'
      case 'rate_limit':
        return 'Слишком много проверок номеров. Повторите позже'
      case 'server':
        return 'Telegram или GREEN-API временно недоступны. Повторите позже'
      default:
        return error.message
    }
  }
  return 'Не удалось создать чат. Повторите попытку'
}
