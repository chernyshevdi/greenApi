const formatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Unix-время в секундах (как в уведомлениях GREEN-API) → «14:05». */
export function formatTime(timestampSec: number): string {
  return formatter.format(new Date(timestampSec * 1000))
}
