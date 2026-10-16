import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCredentials } from '@/entities/session'
import { App } from './App'
import { createAppStore } from './store'
import type { PersistedState } from './store'

const empty: PersistedState = {
  preloadedState: {
    session: { credentials: null, chatsOwner: null },
    chats: { items: [], activeChatId: null },
    messages: { byChatId: {} },
  },
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const credentials = {
  idInstance: '1',
  apiTokenInstance: 't',
  apiUrl: 'https://api.green-api.com',
}

/** Поведение «сервера», которое тесты подменяют по месту. */
const server = {
  receive: [] as Response[], // очередь ответов receiveNotification; пустая — «висит» до abort
  settings: { webhookUrl: '', incomingWebhook: 'yes' } as Record<string, unknown>,
}
const requests: string[] = []

const fetchMock = vi.fn((url: string, init: RequestInit = {}): Promise<Response> => {
  const endpoint = /\/(\w+)\/[^/?]+(?:\/\d+)?(?:\?|$)/.exec(String(url))?.[1] ?? ''
  requests.push(endpoint)
  switch (endpoint) {
    case 'getStateInstance':
      return Promise.resolve(json({ stateInstance: 'authorized' }))
    case 'getSettings':
      return Promise.resolve(json(server.settings))
    case 'deleteNotification':
      return Promise.resolve(json({ result: true, reason: '' }))
    case 'receiveNotification': {
      const next = server.receive.shift()
      if (next) return Promise.resolve(next)
      // long-poll «висит» до отмены, как настоящий
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
      })
    }
    default:
      return Promise.reject(new TypeError(`unexpected request: ${url}`))
  }
})

beforeEach(() => {
  server.receive = []
  server.settings = { webhookUrl: '', incomingWebhook: 'yes' }
  requests.length = 0
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  fetchMock.mockClear()
  vi.unstubAllGlobals()
})

function renderApp() {
  const store = createAppStore(empty)
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
  return store
}

const incoming = (text = 'Привет от Василисы', over: Record<string, unknown> = {}) =>
  json({
    receiptId: 1,
    body: {
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1763115112,
      idMessage: 'm1',
      senderData: { chatId: '10000000', chatName: 'Василиса' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
      ...over,
    },
  })

describe('App', () => {
  it('shows the login page without a session and does not poll', () => {
    renderApp()
    expect(screen.getByLabelText('idInstance')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs in, opens the chat page and starts polling', async () => {
    const store = renderApp()

    await userEvent.type(screen.getByLabelText('idInstance'), '4100000001')
    await userEvent.type(screen.getByLabelText('apiTokenInstance'), 'tok')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText(/Чатов пока нет/)).toBeInTheDocument()
    expect(store.getState().session.credentials?.idInstance).toBe('4100000001')
    await waitFor(() => expect(requests).toContain('receiveNotification'))
  })

  it('shows an incoming message that arrives via polling', async () => {
    server.receive.push(incoming())
    const store = renderApp()
    store.dispatch(setCredentials(credentials))

    expect(await screen.findByRole('button', { name: /Василиса/ })).toBeInTheDocument()
    expect(screen.getByText('Привет от Василисы')).toBeInTheDocument()
    expect(screen.getByLabelText('Непрочитанных: 1')).toBeInTheDocument()
    await waitFor(() => expect(requests).toContain('deleteNotification'))
  })

  it('shows a reply that is quoted (textMessage with quotedMessage)', async () => {
    server.receive.push(
      incoming('Ответ на твоё сообщение', {
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'Ответ на твоё сообщение' },
          quotedMessage: { stanzaId: 'x', participant: '1' },
        },
      }),
    )
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    expect(await screen.findByText('Ответ на твоё сообщение')).toBeInTheDocument()
  })

  it('shows a text-with-link reply (extendedTextMessage)', async () => {
    server.receive.push(
      incoming('', {
        messageData: {
          typeMessage: 'extendedTextMessage',
          extendedTextMessageData: { text: 'Смотри https://example.com' },
        },
      }),
    )
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    expect(await screen.findByText('Смотри https://example.com')).toBeInTheDocument()
  })

  it('warns when incoming notifications are disabled on the instance', async () => {
    server.settings = { webhookUrl: '', incomingWebhook: 'no' }
    const store = renderApp()
    store.dispatch(setCredentials(credentials))

    expect(await screen.findByRole('alert')).toHaveTextContent('Выключены уведомления')
    expect(screen.getByRole('alert')).toHaveTextContent('incomingWebhook')
  })

  it('warns when webhookUrl is set', async () => {
    server.settings = { webhookUrl: 'https://my.server/hook', incomingWebhook: 'yes' }
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    expect(await screen.findByRole('alert')).toHaveTextContent('webhookUrl')
  })

  it('shows the API reason when receiving is rejected with 400', async () => {
    server.receive.push(
      json({ message: 'Message cannot be received because custom webhook url is set' }, 400),
    )
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    expect(await screen.findByRole('alert')).toHaveTextContent('custom webhook url is set')
  })

  it('shows no banner when everything is fine', async () => {
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    await waitFor(() => expect(requests).toContain('getSettings'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('goes back to the login page on logout', async () => {
    const store = renderApp()
    store.dispatch(setCredentials(credentials))
    await userEvent.click(await screen.findByRole('button', { name: 'Выйти' }))
    expect(await screen.findByLabelText('idInstance')).toBeInTheDocument()
  })
})
