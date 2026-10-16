import type { Store } from '@reduxjs/toolkit'
import type { Chat } from '@/entities/chat'
import type { Message } from '@/entities/message'
import type { Credentials } from '@/shared/api'
import type { RootState } from './rootReducer'
import { readJson, removeKey, writeJson } from './storage'

/**
 * Где что лежит:
 *  - токен (credentials) — sessionStorage: живёт только в этой вкладке и не остаётся на диске;
 *  - чаты и сообщения — localStorage: GREEN-API историю не отдаёт, без этого она пропадёт.
 * Оба хранилища читаются любым скриптом страницы — это компромисс клиентского приложения
 * без бэкенда; в продакшене токен должен жить на сервере.
 */
export const STORAGE_KEYS = {
  session: 'tgchat:session',
  chats: 'tgchat:chats',
} as const

type PreloadedState = Pick<RootState, 'session' | 'chats' | 'messages'>

export interface PersistedState {
  preloadedState: PreloadedState
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''

function parseCredentials(value: unknown): Credentials | null {
  if (!isRecord(value) || !isRecord(value.credentials)) return null
  const { idInstance, apiTokenInstance, apiUrl } = value.credentials
  return isString(idInstance) && isString(apiTokenInstance) && isString(apiUrl)
    ? { idInstance, apiTokenInstance, apiUrl }
    : null
}

function parseChat(value: unknown): Chat | null {
  if (!isRecord(value) || !isString(value.chatId) || typeof value.title !== 'string') return null
  const { lastMessage } = value
  return {
    chatId: value.chatId,
    title: value.title,
    phone: typeof value.phone === 'string' ? value.phone : undefined,
    unread: typeof value.unread === 'number' ? value.unread : 0,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
    lastMessage:
      isRecord(lastMessage) &&
      typeof lastMessage.text === 'string' &&
      typeof lastMessage.timestamp === 'number' &&
      (lastMessage.direction === 'in' || lastMessage.direction === 'out')
        ? {
            text: lastMessage.text,
            timestamp: lastMessage.timestamp,
            direction: lastMessage.direction,
          }
        : undefined,
  }
}

function parseMessage(value: unknown): Message | null {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.chatId) ||
    typeof value.text !== 'string' ||
    typeof value.timestamp !== 'number' ||
    (value.direction !== 'in' && value.direction !== 'out')
  ) {
    return null
  }
  const status = value.status
  return {
    id: value.id,
    chatId: value.chatId,
    text: value.text,
    direction: value.direction,
    timestamp: value.timestamp,
    // Запрос «отправляется» не пережил перезагрузку — даём возможность повторить.
    status:
      status === 'sending' ? 'error' : status === 'sent' || status === 'error' ? status : undefined,
  }
}

const compact = <T>(items: unknown[], parse: (item: unknown) => T | null): T[] =>
  items.map(parse).filter((item): item is T => item !== null)

function parseChatsBlob(value: unknown) {
  if (!isRecord(value) || !isString(value.owner) || !Array.isArray(value.chats)) return null
  const byChatId: Record<string, Message[]> = {}
  if (isRecord(value.messages)) {
    for (const [chatId, list] of Object.entries(value.messages)) {
      if (Array.isArray(list)) byChatId[chatId] = compact(list, parseMessage)
    }
  }
  return { owner: value.owner, chats: compact(value.chats, parseChat), byChatId }
}

/** Читает сохранённое состояние; повреждённые данные молча отбрасываются. */
export function loadPersistedState(): PersistedState {
  const credentials = parseCredentials(readJson('session', STORAGE_KEYS.session))
  const blob = parseChatsBlob(readJson('local', STORAGE_KEYS.chats))
  // Чаты другого инстанса не показываем.
  const keep = blob && (!credentials || credentials.idInstance === blob.owner)

  // Если чаты чужие и отброшены, владельцем становится текущий инстанс.
  const chatsOwner = keep ? blob.owner : (credentials?.idInstance ?? blob?.owner ?? null)

  return {
    preloadedState: {
      session: { credentials, chatsOwner },
      chats: { items: keep ? blob.chats : [], activeChatId: null },
      messages: { byChatId: keep ? blob.byChatId : {} },
    },
  }
}

interface PersistenceHandle {
  /** Немедленно записать текущее состояние. */
  flush: () => void
  stop: () => void
}

/**
 * Сохраняет состояние при изменениях (с задержкой, чтобы не писать на каждое нажатие)
 * и при закрытии страницы.
 */
export function setupPersistence(
  store: Store<RootState>,
  { delay = 300 }: { delay?: number } = {},
): PersistenceHandle {
  let previous = store.getState()
  let timer: ReturnType<typeof setTimeout> | undefined

  function write() {
    timer = undefined
    const { session, chats, messages } = store.getState()
    const { credentials, chatsOwner: owner } = session

    if (credentials) writeJson('session', STORAGE_KEYS.session, { credentials })
    else removeKey('session', STORAGE_KEYS.session)

    const hasData = chats.items.length > 0 || Object.keys(messages.byChatId).length > 0
    // Без кредов (после 401) чаты не трогаем: пользователь войдёт в тот же инстанс и увидит их.
    if (owner && (hasData || credentials)) {
      writeJson('local', STORAGE_KEYS.chats, {
        owner,
        chats: chats.items,
        messages: messages.byChatId,
      })
    } else {
      removeKey('local', STORAGE_KEYS.chats)
    }
  }

  function flush() {
    clearTimeout(timer)
    write()
  }

  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    if (
      state.session === previous.session &&
      state.chats === previous.chats &&
      state.messages === previous.messages
    ) {
      return
    }
    previous = state
    clearTimeout(timer)
    timer = setTimeout(write, delay)
  })

  window.addEventListener('pagehide', flush)

  return {
    flush,
    stop() {
      unsubscribe()
      window.removeEventListener('pagehide', flush)
      if (timer !== undefined) flush()
    },
  }
}
