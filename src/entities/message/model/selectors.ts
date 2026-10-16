import { messagesSlice } from './messagesSlice'
import type { Message } from './types'

const EMPTY: Message[] = []

/** Стабильная ссылка на пустой массив, чтобы пустой чат не вызывал лишних перерисовок. */
export const selectMessages =
  (chatId: string | null) =>
  (state: Parameters<typeof messagesSlice.selectors.selectMessagesByChat>[0]): Message[] =>
    (chatId && messagesSlice.selectors.selectMessagesByChat(state)[chatId]) || EMPTY
