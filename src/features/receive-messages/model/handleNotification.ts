import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit'
import { addChat, touchChat } from '@/entities/chat'
import { addMessage, parseIncomingMessage, selectMessages } from '@/entities/message'
import type { MessagesState } from '@/entities/message'
import type { NotificationBody } from '@/shared/api'

type Thunk = ThunkAction<boolean, { messages: MessagesState }, unknown, UnknownAction>

/**
 * Кладёт входящее текстовое сообщение в стор. Возвращает `true`, если оно новое.
 * Всё нетекстовое и дубли (повторная доставка того же уведомления) игнорируются,
 * в том числе счётчик непрочитанных не увеличивается дважды.
 */
export const handleNotification =
  (body: NotificationBody): Thunk =>
  (dispatch, getState) => {
    const parsed = parseIncomingMessage(body)
    if (!parsed) {
      // Видно в консоли, что именно отбрасывается (только тип, без текста сообщений).
      if (body.typeWebhook === 'incomingMessageReceived') {
        console.debug('[receive-messages] входящее уведомление пропущено', {
          typeMessage: body.messageData?.typeMessage,
        })
      }
      return false
    }

    const { message, chatTitle } = parsed
    if (selectMessages(message.chatId)(getState()).some((m) => m.id === message.id)) return false

    dispatch(addChat({ chatId: message.chatId, title: chatTitle }))
    dispatch(addMessage(message))
    dispatch(
      touchChat({
        chatId: message.chatId,
        lastMessage: { text: message.text, timestamp: message.timestamp, direction: 'in' },
      }),
    )
    return true
  }
