import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Message, MessagesState } from './types'

export const initialMessagesState: MessagesState = { byChatId: {} }

interface UpdateMessage {
  chatId: string
  id: string
  /** `id` меняется, когда сервер вернул настоящий idMessage вместо локального. */
  changes: Partial<Pick<Message, 'id' | 'status'>>
}

export const messagesSlice = createSlice({
  name: 'messages',
  initialState: initialMessagesState,
  reducers: {
    /** Добавляет сообщение; дубль по id в том же чате игнорируется. */
    addMessage(state, { payload }: PayloadAction<Message>) {
      const list = (state.byChatId[payload.chatId] ??= [])
      if (list.some((message) => message.id === payload.id)) return
      list.push(payload)
    },
    updateMessage(state, { payload }: PayloadAction<UpdateMessage>) {
      const list = state.byChatId[payload.chatId]
      const message = list?.find((item) => item.id === payload.id)
      if (!message) return
      const { id: newId, status } = payload.changes
      if (status) message.status = status
      if (newId && !list.some((item) => item.id === newId)) message.id = newId
    },
    resetMessages: () => initialMessagesState,
  },
  selectors: {
    selectMessagesByChat: (state) => state.byChatId,
  },
})

export const { addMessage, updateMessage, resetMessages } = messagesSlice.actions
