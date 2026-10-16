import type { ConnectionProblem } from '@/entities/connection'
import { ApiError } from '@/shared/api'
import type { GetSettingsResponse } from '@/shared/api'

/** Ошибка получения уведомлений → проблема для показа пользователю. */
export function problemFromError(error: unknown): ConnectionProblem {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'validation':
        // 400 при получении: чаще всего задан webhookUrl или не включён HTTP API.
        return {
          kind: 'config',
          message: `${error.message}. Проверьте в личном кабинете GREEN-API: webhookUrl должен быть пустым, а incomingWebhook включён.`,
        }
      case 'network':
        return { kind: 'network', message: 'Пробуем подключиться снова…' }
      case 'rate_limit':
        return { kind: 'rate_limit', message: 'Повторим чуть позже.' }
      default:
        return { kind: 'server', message: 'Повторим автоматически.' }
    }
  }
  return { kind: 'server', message: 'Повторим автоматически.' }
}

/** Настройки инстанса, при которых ответы не придут. `null` — всё в порядке. */
export function problemFromSettings(settings: GetSettingsResponse): ConnectionProblem | null {
  if (settings.webhookUrl) {
    return {
      kind: 'config',
      message:
        'В настройках задан webhookUrl: уведомления уходят на него, а не в очередь. Очистите webhookUrl в личном кабинете GREEN-API.',
    }
  }
  if (settings.incomingWebhook !== 'yes') {
    return {
      kind: 'config',
      message:
        'Выключены уведомления о входящих сообщениях. Включите incomingWebhook в личном кабинете GREEN-API.',
    }
  }
  return null
}
