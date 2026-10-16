import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, resetChats, selectChat, touchChat } from '@/entities/chat'
import { addMessage, resetMessages } from '@/entities/message'
import { resetSession, setCredentials } from '@/entities/session'
import type { Credentials } from '@/shared/api'
import { loadPersistedState, setupPersistence, STORAGE_KEYS } from './persistence'
import { createAppStore } from './store'

const creds: Credentials = {
  idInstance: '4100000001',
  apiTokenInstance: 'secret-token',
  apiUrl: 'https://api.green-api.com',
}

function boot() {
  const persisted = loadPersistedState()
  const store = createAppStore(persisted)
  const persistence = setupPersistence(store, { delay: 300 })
  return { store, persistence }
}

const message = (id: string, over = {}) => ({
  id,
  chatId: 'c1',
  text: 'hi',
  direction: 'out' as const,
  timestamp: 1,
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('persistence', () => {
  it('keeps the token in sessionStorage only and chats in localStorage only', () => {
    const { store, persistence } = boot()
    store.dispatch(setCredentials(creds))
    store.dispatch(addChat({ chatId: 'c1', title: 'Anna' }))
    persistence.flush()

    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toContain('secret-token')
    expect(localStorage.getItem(STORAGE_KEYS.chats)).not.toContain('secret-token')
    expect(localStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEYS.chats)).toBeNull()
  })

  it('restores session, chats and messages after a reload', () => {
    const first = boot()
    first.store.dispatch(setCredentials(creds))
    first.store.dispatch(addChat({ chatId: 'c1', title: 'Anna', phone: '7987' }))
    first.store.dispatch(addMessage(message('m1', { status: 'sent' })))
    first.persistence.flush()
    first.persistence.stop()

    const { store } = boot()
    const state = store.getState()
    expect(state.session.credentials).toEqual(creds)
    expect(state.chats.items[0]).toMatchObject({ chatId: 'c1', title: 'Anna', phone: '7987' })
    expect(state.messages.byChatId.c1).toHaveLength(1)
    expect(state.chats.activeChatId).toBeNull()
  })

  it('writes with a debounce, not on every change', () => {
    const { store } = boot()
    store.dispatch(setCredentials(creds))
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    vi.advanceTimersByTime(300)
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).not.toBeNull()
  })

  it('flushes on pagehide', () => {
    const { store } = boot()
    store.dispatch(setCredentials(creds))
    window.dispatchEvent(new Event('pagehide'))
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).not.toBeNull()
  })

  it('turns "sending" messages into "error" after a reload', () => {
    const first = boot()
    first.store.dispatch(setCredentials(creds))
    first.store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    first.store.dispatch(addMessage(message('m1', { status: 'sending' })))
    first.persistence.flush()

    expect(boot().store.getState().messages.byChatId.c1[0].status).toBe('error')
  })

  it('logout clears both storages', () => {
    const { store, persistence } = boot()
    store.dispatch(setCredentials(creds))
    store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    persistence.flush()

    store.dispatch(resetChats())
    store.dispatch(resetMessages())
    store.dispatch(resetSession())
    persistence.flush()

    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.chats)).toBeNull()
  })

  it('keeps chats when only the session ends (e.g. 401) and restores them on re-login', () => {
    const { store, persistence } = boot()
    store.dispatch(setCredentials(creds))
    store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    store.dispatch(resetSession())
    persistence.flush()

    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.chats)).toContain('"c1"')

    const reloaded = boot().store
    expect(reloaded.getState().chats.items).toHaveLength(1)
    reloaded.dispatch(setCredentials(creds)) // тот же инстанс
    expect(reloaded.getState().chats.items).toHaveLength(1)
  })

  it('clears chats when logging in to a different instance', () => {
    const first = boot()
    first.store.dispatch(setCredentials(creds))
    first.store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    first.store.dispatch(resetSession())
    first.persistence.flush()
    first.persistence.stop()

    const { store, persistence } = boot()
    expect(store.getState().chats.items).toHaveLength(1)
    store.dispatch(setCredentials({ ...creds, idInstance: '4100000002' }))
    expect(store.getState().chats.items).toEqual([])

    persistence.flush()
    expect(localStorage.getItem(STORAGE_KEYS.chats)).toContain('4100000002')
    expect(localStorage.getItem(STORAGE_KEYS.chats)).not.toContain('"c1"')
  })

  it('does not show chats of another instance after a reload with a session', () => {
    localStorage.setItem(
      STORAGE_KEYS.chats,
      JSON.stringify({ owner: '999', chats: [{ chatId: 'x', title: 'X' }], messages: {} }),
    )
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ credentials: creds }))
    expect(boot().store.getState().chats.items).toEqual([])
  })

  it('persists the last message preview and unread counter', () => {
    const first = boot()
    first.store.dispatch(setCredentials(creds))
    first.store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    first.store.dispatch(
      touchChat({ chatId: 'c1', lastMessage: { text: 'yo', timestamp: 5, direction: 'in' } }),
    )
    first.persistence.flush()
    const chat = boot().store.getState().chats.items[0]
    expect(chat.unread).toBe(1)
    expect(chat.lastMessage?.text).toBe('yo')
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem(STORAGE_KEYS.chats, '{not json')
    sessionStorage.setItem(STORAGE_KEYS.session, '[1,2')
    const state = boot().store.getState()
    expect(state.session.credentials).toBeNull()
    expect(state.chats.items).toEqual([])
  })

  it('drops invalid entries but keeps valid ones', () => {
    localStorage.setItem(
      STORAGE_KEYS.chats,
      JSON.stringify({
        owner: '1',
        chats: [{ chatId: 'ok', title: 'Ok' }, { nope: true }, 5],
        messages: { ok: [{ id: 'm', chatId: 'ok', text: 't', direction: 'in', timestamp: 1 }, {}] },
      }),
    )
    const state = boot().store.getState()
    expect(state.chats.items.map((c) => c.chatId)).toEqual(['ok'])
    expect(state.messages.byChatId.ok).toHaveLength(1)
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { store, persistence } = boot()
    store.dispatch(setCredentials(creds))
    store.dispatch(selectChat(null))
    expect(() => persistence.flush()).not.toThrow()
    expect(store.getState().session.credentials).toEqual(creds)
    vi.restoreAllMocks()
  })
})

describe('chats owner in session', () => {
  it('is restored from saved chats when there is no session', () => {
    const first = boot()
    first.store.dispatch(setCredentials(creds))
    first.store.dispatch(addChat({ chatId: 'c1', title: 'A' }))
    first.store.dispatch(resetSession())
    first.persistence.flush()

    expect(boot().store.getState().session.chatsOwner).toBe('4100000001')
  })

  it('switches to the current instance when foreign chats are dropped', () => {
    localStorage.setItem(
      STORAGE_KEYS.chats,
      JSON.stringify({ owner: '999', chats: [{ chatId: 'x', title: 'X' }], messages: {} }),
    )
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ credentials: creds }))
    expect(boot().store.getState().session.chatsOwner).toBe('4100000001')
  })
})
