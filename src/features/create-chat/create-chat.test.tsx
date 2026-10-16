import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chatsSlice, selectActiveChat } from '@/entities/chat'
import { sessionSlice, setCredentials } from '@/entities/session'
import type { Credentials } from '@/shared/api'
import { NewChatForm } from '.'

const credentials: Credentials = {
  idInstance: '4100000001',
  apiTokenInstance: 'tok',
  apiUrl: 'https://api.green-api.com',
}

const fetchMock = vi.fn()
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function setup(onCreated = vi.fn()) {
  const store = configureStore({
    reducer: { chats: chatsSlice.reducer, session: sessionSlice.reducer },
  })
  store.dispatch(setCredentials(credentials))
  render(
    <Provider store={store}>
      <NewChatForm onCreated={onCreated} />
    </Provider>,
  )
  return { store, onCreated }
}

async function submit(phone: string) {
  await userEvent.type(screen.getByLabelText('Номер телефона'), phone)
  await userEvent.click(screen.getByRole('button', { name: 'Создать чат' }))
}

describe('NewChatForm', () => {
  it('creates and opens a chat using chatId from checkAccount', async () => {
    reply({ exist: true, chatId: '10000000' })
    const { store, onCreated } = setup()
    await submit('+7 (987) 654-32-10')

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('10000000'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ phoneNumber: 79876543210 })
    expect(selectActiveChat(store.getState())).toMatchObject({
      chatId: '10000000',
      title: '79876543210',
      phone: '79876543210',
    })
  })

  it('uses @username as title when available', async () => {
    reply({ exist: true, chatId: '1', username: 'vasilisa' })
    const { store } = setup()
    await submit('79876543210')
    await waitFor(() => expect(store.getState().chats.items).toHaveLength(1))
    expect(store.getState().chats.items[0].title).toBe('@vasilisa')
  })

  it('does not create a chat for a number without Telegram', async () => {
    reply({ exist: false, chatId: '' })
    const { store, onCreated } = setup()
    await submit('79876543210')

    expect(await screen.findByRole('alert')).toHaveTextContent('Номер не найден в Telegram')
    expect(store.getState().chats.items).toEqual([])
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('validates the number without a request', async () => {
    setup()
    await submit('123')
    expect(await screen.findByRole('alert')).toHaveTextContent('международном формате')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows API errors', async () => {
    reply({ status: false, data: { reason: 'rate_limit_exceeded' } })
    setup()
    await submit('79876543210')
    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много проверок')
  })

  it('does not duplicate an existing chat', async () => {
    reply({ exist: true, chatId: '10000000' })
    reply({ exist: true, chatId: '10000000' })
    const { store } = setup()
    await submit('79876543210')
    await waitFor(() => expect(store.getState().chats.items).toHaveLength(1))
    await submit('79876543210')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(store.getState().chats.items).toHaveLength(1)
  })
})

describe('NewChatForm without session', () => {
  it('asks to log in and makes no request', async () => {
    const store = configureStore({
      reducer: { chats: chatsSlice.reducer, session: sessionSlice.reducer },
    })
    render(
      <Provider store={store}>
        <NewChatForm />
      </Provider>,
    )
    await submit('79876543210')
    expect(await screen.findByRole('alert')).toHaveTextContent('Сначала войдите')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
