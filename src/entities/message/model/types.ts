export type MessageDirection = 'in' | 'out'

/** Статус только у исходящих: отправляется → отправлено / ошибка. */
export type MessageStatus = 'sending' | 'sent' | 'error'

export interface Message {
  /** idMessage из GREEN-API; у неотправленного — временный локальный id. */
  id: string
  chatId: string
  text: string
  direction: MessageDirection
  /** Unix-время, сек. */
  timestamp: number
  status?: MessageStatus
}

export interface MessagesState {
  byChatId: Record<string, Message[]>
}
