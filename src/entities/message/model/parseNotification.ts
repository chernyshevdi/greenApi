import type { NotificationBody } from '@/shared/api'
import type { Message } from './types'

export interface IncomingMessage {
  message: Message
  /** Имя отправителя для создания чата. */
  chatTitle: string
}

/** Текст из `textMessage` или из `extendedTextMessage` (текст со ссылкой). */
function extractText({ messageData }: NotificationBody): string | undefined {
  switch (messageData?.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage
    case 'extendedTextMessage':
      return messageData.extendedTextMessageData?.text
    default:
      return undefined
  }
}

/**
 * Превращает уведомление GREEN-API во входящее текстовое сообщение.
 * Всё остальное (статусы, не-текст, исходящие) → `null`.
 */
export function parseIncomingMessage(body: NotificationBody): IncomingMessage | null {
  if (body.typeWebhook !== 'incomingMessageReceived') return null
  const text = extractText(body)
  const { senderData, idMessage } = body
  if (!text || !senderData?.chatId || !idMessage) return null

  return {
    chatTitle:
      senderData.chatName ||
      senderData.senderName ||
      senderData.senderContactName ||
      (senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : senderData.chatId),
    message: {
      id: idMessage,
      chatId: senderData.chatId,
      text,
      direction: 'in',
      timestamp: body.timestamp ?? Math.floor(Date.now() / 1000),
    },
  }
}
