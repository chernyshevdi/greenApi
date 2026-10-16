import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addChat, chatsSlice, selectActiveChatId, touchChat } from '@/entities/chat'
import { connectionSlice } from '@/entities/connection'
import { sessionSlice, setCredentials } from '@/entities/session'
import { ChatList } from '.'

const fetchMock = vi.fn()
beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

function setup() {
  const store = configureStore({
    reducer: {
      chats: chatsSlice.reducer,
      session: sessionSlice.reducer,
      connection: connectionSlice.reducer,
    },
  })
  store.dispatch(
    setCredentials({ idInstance: '1', apiTokenInstance: 't', apiUrl: 'https://api.green-api.com' }),
  )
  const onLogout = vi.fn()
  render(
    <Provider store={store}>
      <ChatList onLogout={onLogout} />
    </Provider>,
  )
  return { store, onLogout }
}

describe('ChatList', () => {
  it('shows a hint when there are no chats', () => {
    setup()
    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument()
  })

  it('lists chats and opens one on click', async () => {
    const { store } = setup()
    store.dispatch(addChat({ chatId: '1', title: 'Anna' }))
    store.dispatch(addChat({ chatId: '2', title: 'Boris' }))
    await userEvent.click(await screen.findByRole('button', { name: /Boris/ }))

    expect(selectActiveChatId(store.getState())).toBe('2')
    expect(screen.getByRole('button', { name: /Boris/ })).toHaveAttribute('aria-current', 'true')
  })

  it('shows the most recently active chat first', async () => {
    const { store } = setup()
    store.dispatch(addChat({ chatId: '1', title: 'Anna' }))
    store.dispatch(addChat({ chatId: '2', title: 'Boris' }))
    store.dispatch(
      touchChat({
        chatId: '1',
        lastMessage: { text: 'x', timestamp: 9_999_999_999, direction: 'in' },
      }),
    )
    const items = await screen.findAllByRole('button', { name: /Anna|Boris/ })
    expect(items[0]).toHaveTextContent('Anna')
  })

  it('replaces the list with the new chat panel and returns back', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Новый чат' }))
    expect(screen.getByLabelText('Номер телефона')).toBeInTheDocument()
    expect(screen.queryByText(/Чатов пока нет/)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(screen.getByText(/Чатов пока нет/)).toBeInTheDocument()
  })

  it('creates a chat from the panel and returns to the list with it opened', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ exist: true, chatId: '10000000' })),
    )
    const { store } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Новый чат' }))
    await userEvent.type(screen.getByLabelText('Номер телефона'), '79876543210')
    await userEvent.click(screen.getByRole('button', { name: 'Создать чат' }))

    await waitFor(() => expect(screen.queryByLabelText('Номер телефона')).toBeNull())
    expect(selectActiveChatId(store.getState())).toBe('10000000')
    expect(screen.getByRole('button', { name: /79876543210/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('calls onLogout', async () => {
    const { onLogout } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })
})
