import { configureStore } from '@reduxjs/toolkit'
import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, chatsSlice, selectChat } from '@/entities/chat'
import { messagesSlice, selectMessages } from '@/entities/message'
import { selectCredentials, sessionSlice, setCredentials } from '@/entities/session'
import type { Credentials } from '@/shared/api'
import { startPolling, useNotificationPolling } from '.'
import { backoffMs } from './model/poller'
import type { PollingDispatch } from './model/poller'

const credentials: Credentials = {
  idInstance: '4100000001',
  apiTokenInstance: 'tok',
  apiUrl: 'https://api.green-api.com',
}

type Step = { status?: number; body?: unknown } | 'network-error'

/** Настройки инстанса в порядке; отдельный мок, чтобы не мешать сценарию уведомлений. */
const settingsOk = { webhookUrl: '', incomingWebhook: 'yes' }
const settingsFetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(settingsOk))))

/**
 * Отвечает по сценарию; когда сценарий закончился, «висит» как long-poll до abort.
 * Запросы getSettings идут в отдельный мок и в сценарий/счётчики не попадают.
 */
function script(steps: Step[]) {
  const queue = [...steps]
  const calls: { method: string; url: string }[] = []
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? 'GET', url })
    const step = queue.shift()
    if (step === 'network-error') return Promise.reject(new TypeError('Failed to fetch'))
    if (step) {
      const { status = 200, body } = step
      return Promise.resolve(
        new Response(body === undefined ? '' : JSON.stringify(body), { status }),
      )
    }
    return new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      )
    })
  })
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url).includes('/getSettings/') ? settingsFetch() : fetchMock(url, init),
  )
  return { calls, fetchMock }
}

const text = (receiptId: number, idMessage: string, chatId = '10000000', message = 'Привет') => ({
  status: 200,
  body: {
    receiptId,
    body: {
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1763115112,
      idMessage,
      senderData: { chatId, chatName: 'Василиса' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: message } },
    },
  },
})
const ok = { status: 200, body: { result: true, reason: '' } }

const makeStore = () =>
  configureStore({
    reducer: {
      chats: chatsSlice.reducer,
      messages: messagesSlice.reducer,
      session: sessionSlice.reducer,
    },
  })

/**
 * Короткие паузы (бэкофф) пропускаем, а длинные (перепроверка настроек раз в 15 с) ждут
 * отмены: иначе цикл без реального ожидания крутился бы бесконечно и ронял воркер.
 */
const instantSleep = (ms: number, signal: AbortSignal) =>
  ms >= 10_000
    ? new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      )
    : Promise.resolve()
const messagesOf = (store: ReturnType<typeof makeStore>, chatId = '10000000') =>
  selectMessages(chatId)(store.getState())

const stops: (() => void)[] = []
function start(store: ReturnType<typeof makeStore>, extra: { onAuthError?: () => void } = {}) {
  const stop = startPolling({
    credentials,
    dispatch: store.dispatch as PollingDispatch,
    sleep: instantSleep,
    ...extra,
  })
  stops.push(stop)
  return stop
}

beforeEach(() => {
  vi.unstubAllGlobals()
  settingsFetch.mockClear()
  settingsFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(settingsOk))))
})
afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  vi.unstubAllGlobals()
})

describe('startPolling', () => {
  it('adds the message, creates the chat and deletes the notification', async () => {
    const { calls } = script([text(7, 'id-1'), ok])
    const store = makeStore()
    start(store)

    await waitFor(() => expect(messagesOf(store)).toHaveLength(1))
    expect(messagesOf(store)[0]).toMatchObject({ id: 'id-1', text: 'Привет', direction: 'in' })
    expect(store.getState().chats.items[0]).toMatchObject({
      chatId: '10000000',
      title: 'Василиса',
      unread: 1,
    })

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
    expect(calls.find((c) => c.method === 'DELETE')?.url).toBe(
      'https://api.green-api.com/waInstance4100000001/deleteNotification/tok/7',
    )
    expect(calls[0].url).toContain('/receiveNotification/tok?receiveTimeout=')
  })

  it('deletes but does not show non-text notifications', async () => {
    const { calls } = script([
      { body: { receiptId: 1, body: { typeWebhook: 'outgoingMessageStatus' } } },
      ok,
      {
        body: {
          receiptId: 2,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'img',
            senderData: { chatId: '1' },
            messageData: { typeMessage: 'imageMessage' },
          },
        },
      },
      ok,
    ])
    const store = makeStore()
    start(store)

    await waitFor(() => expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(2))
    expect(store.getState().chats.items).toEqual([])
    expect(store.getState().messages.byChatId).toEqual({})
  })

  it('does not count unread for the open chat', async () => {
    script([text(1, 'a'), ok])
    const store = makeStore()
    // открываем чат до прихода сообщения
    store.dispatch(addChat({ chatId: '10000000', title: 'V' }))
    store.dispatch(selectChat('10000000'))
    start(store)

    await waitFor(() => expect(messagesOf(store)).toHaveLength(1))
    expect(store.getState().chats.items[0].unread).toBe(0)
  })

  it('processes a redelivered notification only once when delete failed', async () => {
    const { calls } = script([
      text(5, 'dup'),
      { status: 500, body: { message: 'x' } }, // удаление не удалось
      text(5, 'dup'), // пришло повторно
      ok,
    ])
    const store = makeStore()
    start(store)

    await waitFor(() => expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(2))
    expect(messagesOf(store)).toHaveLength(1)
    expect(store.getState().chats.items[0].unread).toBe(1)
  })

  it('retries after network errors without stopping', async () => {
    script(['network-error', 'network-error', text(1, 'after-errors'), ok])
    const store = makeStore()
    start(store)
    await waitFor(() => expect(messagesOf(store)).toHaveLength(1))
  })

  it('stops and reports auth errors', async () => {
    const { fetchMock } = script([{ status: 401, body: {} }])
    const onAuthError = vi.fn()
    start(makeStore(), { onAuthError })

    await waitFor(() => expect(onAuthError).toHaveBeenCalledOnce())
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stop() aborts the request and ignores late notifications', async () => {
    const { fetchMock } = script([])
    const store = makeStore()
    const stop = start(store)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    stop()
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().chats.items).toEqual([])
  })
})

describe('backoffMs', () => {
  it.each([
    [1, 1000],
    [2, 2000],
    [3, 5000],
    [10, 5000],
  ])('%i failures → %i ms', (failures, expected) => {
    expect(backoffMs(failures)).toBe(expected)
  })
})

describe('useNotificationPolling', () => {
  function Poller({ onAuthError }: { onAuthError?: () => void }) {
    useNotificationPolling({ onAuthError })
    return null
  }

  it('polls only with credentials, and runs a single loop under StrictMode', async () => {
    const { fetchMock } = script([])
    const store = makeStore()
    render(
      <StrictMode>
        <Provider store={store}>
          <Poller />
        </Provider>
      </StrictMode>,
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).not.toHaveBeenCalled()

    store.dispatch(setCredentials(credentials))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    // первый запрос из прошлого эффекта отменён, живой запрос ровно один
    const live = fetchMock.mock.calls.filter(([, init]) => !(init as RequestInit).signal?.aborted)
    expect(live).toHaveLength(1)
  })

  it('logs the user out on 401 by default', async () => {
    script([{ status: 401, body: {} }])
    const store = makeStore()
    store.dispatch(setCredentials(credentials))
    render(
      <Provider store={store}>
        <Poller />
      </Provider>,
    )
    await waitFor(() => expect(selectCredentials(store.getState())).toBeNull())
  })
})

describe('startPolling with the real (abortable) sleep', () => {
  afterEach(() => vi.useRealTimers())

  it('waits the backoff interval after a network error, then continues', async () => {
    vi.useFakeTimers()
    const { fetchMock } = script(['network-error', text(1, 'late'), ok])
    const store = makeStore()
    const stop = startPolling({ credentials, dispatch: store.dispatch as PollingDispatch })
    stops.push(stop)

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1) // ошибка, пауза 1 с
    await vi.advanceTimersByTimeAsync(900)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(messagesOf(store)).toHaveLength(1)
  })

  it('stops immediately when aborted during the pause', async () => {
    vi.useFakeTimers()
    const { fetchMock } = script(['network-error', text(1, 'never')])
    const store = makeStore()
    const stop = startPolling({ credentials, dispatch: store.dispatch as PollingDispatch })

    await vi.advanceTimersByTimeAsync(0) // ушли в паузу
    stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().chats.items).toEqual([])
  })

  it('cools down when the server answers "empty" instantly', async () => {
    vi.useFakeTimers()
    const { fetchMock } = script([{}, {}, {}])
    const store = makeStore()
    stops.push(startPolling({ credentials, dispatch: store.dispatch as PollingDispatch }))

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('startPolling: problem reporting', () => {
  afterEach(() => vi.useRealTimers())

  function startWithProblems(store: ReturnType<typeof makeStore>) {
    const onProblem = vi.fn()
    stops.push(
      startPolling({
        credentials,
        dispatch: store.dispatch as PollingDispatch,
        sleep: instantSleep,
        onProblem,
      }),
    )
    return onProblem
  }

  it('reports a 400 immediately as a config problem with the API reason', async () => {
    script([{ status: 400, body: { message: 'custom webhook url is set' } }])
    const onProblem = startWithProblems(makeStore())

    await waitFor(() => expect(onProblem).toHaveBeenCalled())
    expect(onProblem.mock.calls[0][0]).toMatchObject({ kind: 'config' })
    expect(onProblem.mock.calls[0][0].message).toContain('custom webhook url is set')
  })

  it('does not report a single network blip, but reports repeated failures', async () => {
    script(['network-error', text(1, 'ok-after-blip'), ok])
    const store = makeStore()
    const onProblem = startWithProblems(store)
    await waitFor(() => expect(messagesOf(store)).toHaveLength(1))
    expect(onProblem).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'network' }))

    script(['network-error', 'network-error', 'network-error'])
    const second = startWithProblems(makeStore())
    await waitFor(() =>
      expect(second).toHaveBeenCalledWith(expect.objectContaining({ kind: 'network' })),
    )
  })

  it('clears the problem after a successful request', async () => {
    script(['network-error', 'network-error', { body: null }, ok])
    const onProblem = startWithProblems(makeStore())
    await waitFor(() => expect(onProblem).toHaveBeenLastCalledWith(null))
    expect(onProblem.mock.calls.map(([p]) => p?.kind ?? null)).toEqual(['network', null])
  })

  it('reports disabled incoming notifications even though polling itself succeeds', async () => {
    script([])
    settingsFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ webhookUrl: '', incomingWebhook: 'no' }))),
    )
    const onProblem = startWithProblems(makeStore())
    await waitFor(() => expect(onProblem).toHaveBeenCalled())
    expect(onProblem.mock.calls[0][0]).toMatchObject({ kind: 'config' })
    expect(onProblem.mock.calls[0][0].message).toContain('incomingWebhook')
  })

  it('rechecks settings and clears the problem once they are fixed', async () => {
    vi.useFakeTimers()
    script([])
    settingsFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ webhookUrl: 'https://x', incomingWebhook: 'yes' })),
      ),
    )
    const store = makeStore()
    const onProblem = vi.fn()
    stops.push(
      startPolling({ credentials, dispatch: store.dispatch as PollingDispatch, onProblem }),
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(onProblem).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'config' }))

    await vi.advanceTimersByTimeAsync(15_000) // перепроверка: теперь настройки верны
    expect(onProblem).toHaveBeenLastCalledWith(null)
    expect(settingsFetch).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(settingsFetch).toHaveBeenCalledTimes(2) // дальше не перепроверяем
  })

  it('ignores a failure to read settings (does not invent a problem)', async () => {
    script([])
    settingsFetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    const onProblem = startWithProblems(makeStore())
    await new Promise((r) => setTimeout(r, 30))
    expect(onProblem).not.toHaveBeenCalled()
  })

  it('a request problem takes priority over a settings problem', async () => {
    script([{ status: 400, body: { message: 'boom' } }])
    settingsFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ webhookUrl: '', incomingWebhook: 'no' }))),
    )
    const onProblem = startWithProblems(makeStore())
    await waitFor(() => expect(onProblem.mock.calls.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 30))
    expect(onProblem.mock.lastCall?.[0].message).toContain('boom')
  })
})

describe('handleNotification logging', () => {
  it('logs the type of a skipped incoming notification, without its content', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    script([
      {
        body: {
          receiptId: 1,
          body: {
            typeWebhook: 'incomingMessageReceived',
            idMessage: 'i',
            senderData: { chatId: '1' },
            messageData: { typeMessage: 'stickerMessage' },
          },
        },
      },
      ok,
    ])
    start(makeStore())
    await waitFor(() => expect(debug).toHaveBeenCalled())
    expect(debug.mock.calls[0][1]).toEqual({ typeMessage: 'stickerMessage' })
    debug.mockRestore()
  })

  it('stays quiet for non-incoming notifications such as statuses', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { calls } = script([
      { body: { receiptId: 1, body: { typeWebhook: 'outgoingMessageStatus' } } },
      ok,
    ])
    start(makeStore())
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
    expect(debug).not.toHaveBeenCalled()
    debug.mockRestore()
  })
})
