import { useEffect, useRef } from 'react'
import type { Message } from '@/entities/message'

const NEAR_BOTTOM_PX = 80

/**
 * Автоскролл вниз: при открытии чата и своих сообщениях — всегда,
 * при входящих — только если пользователь уже у низа (не мешаем читать историю).
 */
export function useStickToBottom(chatId: string | null, messages: Message[]) {
  const listRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const lastChatRef = useRef<string | null>(null)
  const lastCountRef = useRef(0)

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const chatChanged = lastChatRef.current !== chatId
    const added = messages.length > lastCountRef.current
    const lastIsMine = messages[messages.length - 1]?.direction === 'out'
    lastChatRef.current = chatId
    lastCountRef.current = messages.length

    if (chatChanged || (added && lastIsMine)) stickRef.current = true
    if (stickRef.current) el.scrollTop = el.scrollHeight
  }, [chatId, messages])

  function onScroll() {
    const el = listRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  return { listRef, onScroll }
}
