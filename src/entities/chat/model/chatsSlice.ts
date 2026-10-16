import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Chat, ChatsState, LastMessage } from './types'

export const initialChatsState: ChatsState = { items: [], activeChatId: null }

interface NewChat {
  chatId: string
  title: string
  phone?: string
}

export const chatsSlice = createSlice({
  name: 'chats',
  initialState: initialChatsState,
  reducers: {
    addChat: {
      reducer(state, { payload }: PayloadAction<Chat>) {
        if (state.items.some((chat) => chat.chatId === payload.chatId)) return
        state.items.push(payload)
      },
      prepare(chat: NewChat) {
        return {
          payload: { ...chat, unread: 0, createdAt: Math.floor(Date.now() / 1000) } satisfies Chat,
        }
      },
    },
    /** Открывает чат и сбрасывает непрочитанные. `null` — закрыть. */
    selectChat(state, { payload }: PayloadAction<string | null>) {
      state.activeChatId = payload
      const chat = state.items.find((item) => item.chatId === payload)
      if (chat) chat.unread = 0
    },
    /** Обновляет превью чата; входящее в неактивный чат увеличивает счётчик непрочитанных. */
    touchChat(state, { payload }: PayloadAction<{ chatId: string; lastMessage: LastMessage }>) {
      const chat = state.items.find((item) => item.chatId === payload.chatId)
      if (!chat) return
      chat.lastMessage = payload.lastMessage
      if (payload.lastMessage.direction === 'in' && state.activeChatId !== chat.chatId) {
        chat.unread += 1
      }
    },
    resetChats: () => initialChatsState,
  },
  selectors: {
    selectChats: (state) => state.items,
    selectActiveChatId: (state) => state.activeChatId,
  },
})

export const { addChat, selectChat, touchChat, resetChats } = chatsSlice.actions
