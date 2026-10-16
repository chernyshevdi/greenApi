import { createSelector } from '@reduxjs/toolkit'
import { chatsSlice } from './chatsSlice'

const { selectChats, selectActiveChatId } = chatsSlice.selectors

/** Чаты от новых к старым: по последнему сообщению, иначе по времени создания. */
export const selectChatList = createSelector([selectChats], (chats) =>
  [...chats].sort(
    (a, b) => (b.lastMessage?.timestamp ?? b.createdAt) - (a.lastMessage?.timestamp ?? a.createdAt),
  ),
)

export const selectActiveChat = createSelector(
  [selectChats, selectActiveChatId],
  (chats, activeId) => chats.find((chat) => chat.chatId === activeId) ?? null,
)

export { selectActiveChatId }
