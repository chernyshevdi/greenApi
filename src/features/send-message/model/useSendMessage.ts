import { useDispatch, useSelector } from 'react-redux'
import { touchChat } from '@/entities/chat'
import { addMessage, updateMessage } from '@/entities/message'
import type { Message } from '@/entities/message'
import { selectCredentials } from '@/entities/session'
import { MAX_MESSAGE_LENGTH, sendMessage } from '@/shared/api'

let localCounter = 0
const nextLocalId = () => `local-${Date.now()}-${(localCounter += 1)}`
const nowSec = () => Math.floor(Date.now() / 1000)

/** Текст, который можно отправить: не пустой и в пределах лимита API. */
export function isSendable(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH
}

/**
 * Отправка с оптимистичным обновлением: сообщение сразу попадает в чат со статусом
 * `sending`, после ответа получает настоящий idMessage и статус `sent` либо `error`.
 */
export function useSendMessage() {
  const dispatch = useDispatch()
  const credentials = useSelector(selectCredentials)

  async function deliver(chatId: string, localId: string, text: string) {
    const fail = () =>
      dispatch(updateMessage({ chatId, id: localId, changes: { status: 'error' } }))
    if (!credentials) return fail()

    try {
      const { idMessage } = await sendMessage(credentials, { chatId, message: text })
      dispatch(updateMessage({ chatId, id: localId, changes: { id: idMessage, status: 'sent' } }))
    } catch {
      fail()
    }
  }

  /** Возвращает `false`, если текст нельзя отправить (пустой или слишком длинный). */
  function send(chatId: string, rawText: string): boolean {
    if (!isSendable(rawText)) return false
    const text = rawText.trim()
    const timestamp = nowSec()
    const message: Message = {
      id: nextLocalId(),
      chatId,
      text,
      direction: 'out',
      timestamp,
      status: 'sending',
    }

    dispatch(addMessage(message))
    dispatch(touchChat({ chatId, lastMessage: { text, timestamp, direction: 'out' } }))
    void deliver(chatId, message.id, text)
    return true
  }

  /** Повторная отправка сообщения со статусом `error`. */
  function retry(message: Message) {
    dispatch(
      updateMessage({ chatId: message.chatId, id: message.id, changes: { status: 'sending' } }),
    )
    void deliver(message.chatId, message.id, message.text)
  }

  return { send, retry }
}
