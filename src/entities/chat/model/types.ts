export interface LastMessage {
  text: string
  /** Unix-время, сек. */
  timestamp: number
  direction: 'in' | 'out'
}

export interface Chat {
  chatId: string
  title: string
  /** Номер в международном формате, если чат создан по номеру. */
  phone?: string
  lastMessage?: LastMessage
  unread: number
  /** Unix-время создания, сек. Нужно для сортировки чатов без сообщений. */
  createdAt: number
}

export interface ChatsState {
  items: Chat[]
  activeChatId: string | null
}
