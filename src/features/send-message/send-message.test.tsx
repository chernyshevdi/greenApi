import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider, useSelector } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, chatsSlice } from '@/entities/chat'
import { MessageBubble, messagesSlice, selectMessages } from '@/entities/message'
import { sessionSlice, setCredentials } from '@/entities/session'
import { MessageInput, isSendable, useSendMessage } from '.'

const fetchMock = vi.fn()
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function makeStore(withSession = true) {
  const store = configureStore({
    reducer: {
      chats: chatsSlice.reducer,
      messages: messagesSlice.reducer,
      session: sessionSlice.reducer,
    },
  })
  if (withSession) {
    store.dispatch(
      setCredentials({
        idInstance: '4100000001',
        apiTokenInstance: 'tok',
        apiUrl: 'https://api.green-api.com',
      }),
    )
  }
  store.dispatch(addChat({ chatId: 'c1', title: 'Anna' }))
  return store
}

const messagesOf = (store: ReturnType<typeof makeStore>) => selectMessages('c1')(store.getState())

function setup(store = makeStore()) {
  render(
    <Provider store={store}>
      <MessageInput chatId="c1" />
    </Provider>,
  )
  return store
}

describe('isSendable', () => {
  it.each([
    ['hello', true],
    ['  hi  ', true],
    ['   ', false],
    ['', false],
    ['x'.repeat(4096), true],
    ['x'.repeat(4097), false],
  ])('%#: %s', (text, expected) => {
    expect(isSendable(text)).toBe(expected)
  })
})

describe('MessageInput', () => {
  it('sends on Enter, shows it optimistically, then confirms with server id', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
    const store = setup()

    await userEvent.type(screen.getByLabelText('Сообщение'), 'Привет{Enter}')

    expect(screen.getByLabelText('Сообщение')).toHaveValue('')
    expect(messagesOf(store)).toHaveLength(1)
    expect(messagesOf(store)[0]).toMatchObject({
      text: 'Привет',
      direction: 'out',
      status: 'sending',
    })
    expect(store.getState().chats.items[0].lastMessage?.text).toBe('Привет')

    resolve(new Response(JSON.stringify({ idMessage: 'srv-1' })))
    await waitFor(() => expect(messagesOf(store)[0].status).toBe('sent'))
    expect(messagesOf(store)[0].id).toBe('srv-1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.green-api.com/waInstance4100000001/sendMessage/tok')
    expect(JSON.parse(init.body)).toEqual({ chatId: 'c1', message: 'Привет' })
  })

  it('does not send on Shift+Enter (new line instead)', async () => {
    const store = setup()
    await userEvent.type(screen.getByLabelText('Сообщение'), 'a{Shift>}{Enter}{/Shift}b')
    expect(screen.getByLabelText('Сообщение')).toHaveValue('a\nb')
    expect(messagesOf(store)).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not send an empty message and disables the button', async () => {
    const store = setup()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Сообщение'), '   {Enter}')
    expect(messagesOf(store)).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks a message over the limit and explains why', async () => {
    const store = setup()
    await userEvent.click(screen.getByLabelText('Сообщение'))
    await userEvent.paste('x'.repeat(4097))
    expect(screen.getByRole('alert')).toHaveTextContent('Максимум 4096')
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    expect(messagesOf(store)).toHaveLength(0)
  })

  it('sends with the button too', async () => {
    reply({ idMessage: 'srv-2' })
    const store = setup()
    await userEvent.type(screen.getByLabelText('Сообщение'), 'hi')
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(messagesOf(store)[0].status).toBe('sent'))
  })
})

describe('failed delivery and retry', () => {
  function Harness() {
    const { retry } = useSendMessage()
    return (
      <>
        <MessageInput chatId="c1" />
        <Bubbles retry={retry} />
      </>
    )
  }

  function Bubbles({ retry }: { retry: ReturnType<typeof useSendMessage>['retry'] }) {
    // Компактная замена виджета чата: показывает сообщения с кнопкой «Повторить».
    const messages = useSelector(selectMessages('c1'))
    return messages.map((m) => <MessageBubble key={m.id} message={m} onRetry={retry} />)
  }

  it('marks the message as error and retries successfully', async () => {
    reply({ message: 'boom' }, 500)
    const store = makeStore()
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    )

    await userEvent.type(screen.getByLabelText('Сообщение'), 'hello{Enter}')
    await waitFor(() => expect(messagesOf(store)[0].status).toBe('error'))

    reply({ idMessage: 'srv-3' })
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }))

    await waitFor(() => expect(messagesOf(store)[0].status).toBe('sent'))
    expect(messagesOf(store)).toHaveLength(1)
    expect(messagesOf(store)[0].id).toBe('srv-3')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('marks as error without credentials and makes no request', async () => {
    const store = setup(makeStore(false))
    await userEvent.type(screen.getByLabelText('Сообщение'), 'hello{Enter}')
    await waitFor(() => expect(messagesOf(store)[0].status).toBe('error'))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
